import {
  WEIGHT_HISTORY_DAYS,
  weeklyChangeKg,
  weightEntryInputSchema,
  weightHistorySchema,
  weightTrend,
} from '@betterfit/shared';
import { and, eq, gte } from 'drizzle-orm';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { currentUser } from '../auth/plugin.js';
import { db } from '../db/client.js';
import { weightEntries } from '../db/schema.js';
import { notFound } from '../errors.js';

/** Date du jour au format `AAAA-MM-JJ`, dans le fuseau du serveur. */
function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Même format, pour une date reculée de `days` jours. */
function daysAgo(days: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

async function loadHistory(userId: string, days: number) {
  const rows = await db
    .select({ date: weightEntries.date, weightKg: weightEntries.weightKg })
    .from(weightEntries)
    .where(and(eq(weightEntries.userId, userId), gte(weightEntries.date, daysAgo(days))))
    .orderBy(weightEntries.date);

  const points = weightTrend(rows);

  return weightHistorySchema.parse({
    points,
    latestWeightKg: points[points.length - 1]?.weightKg ?? null,
    weeklyChangeKg: weeklyChangeKg(points),
  });
}

export const weightRoutes: FastifyPluginAsyncZod = async (app) => {
  app.addHook('onRequest', app.requireAuth);

  app.get(
    '/me/weight',
    {
      schema: {
        querystring: z.object({
          days: z.coerce.number().int().min(1).max(3650).default(WEIGHT_HISTORY_DAYS),
        }),
        response: { 200: weightHistorySchema },
      },
    },
    async (request) => loadHistory(currentUser(request).id, request.query.days),
  );

  /**
   * Enregistre une pesée. Une seule par jour : repeser le soir corrige la
   * mesure du matin au lieu d'en ajouter une seconde.
   */
  app.post(
    '/me/weight',
    { schema: { body: weightEntryInputSchema, response: { 200: weightHistorySchema } } },
    async (request) => {
      const user = currentUser(request);
      const date = request.body.date ?? today();

      await db
        .insert(weightEntries)
        .values({ userId: user.id, date, weightKg: request.body.weightKg })
        .onConflictDoUpdate({
          target: [weightEntries.userId, weightEntries.date],
          set: { weightKg: request.body.weightKg },
        });

      return loadHistory(user.id, WEIGHT_HISTORY_DAYS);
    },
  );

  /** Efface une pesée, par exemple une faute de frappe d'un autre jour. */
  app.delete(
    '/me/weight/:date',
    {
      schema: {
        params: z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }),
        response: { 200: weightHistorySchema },
      },
    },
    async (request) => {
      const user = currentUser(request);

      const [removed] = await db
        .delete(weightEntries)
        .where(
          and(eq(weightEntries.userId, user.id), eq(weightEntries.date, request.params.date)),
        )
        .returning({ date: weightEntries.date });

      if (!removed) throw notFound('weight/not-found', 'Aucune pesée ce jour-là.');

      return loadHistory(user.id, WEIGHT_HISTORY_DAYS);
    },
  );
};
