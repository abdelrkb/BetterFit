import {
  AUTH_ERROR_CODES,
  apiErrorSchema,
  changePasswordSchema,
  deleteAccountSchema,
  meSchema,
  onboardingSchema,
  profileSchema,
  profileUpdateSchema,
  updateUserSchema,
  userSchema,
} from '@betterfit/shared';
import { desc, eq } from 'drizzle-orm';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { currentUser } from '../auth/plugin.js';
import { hashPassword, verifyPassword } from '../auth/password.js';
import { clearRefreshCookie, toPublicUser } from '../auth/session.js';
import { revokeAllSessions } from '../auth/tokens.js';
import { db } from '../db/client.js';
import { authIdentities, profiles, users, weightEntries, type ProfileRow } from '../db/schema.js';
import { badRequest, notFound, unauthorized } from '../errors.js';

/** Date du jour au format `AAAA-MM-JJ`, dans le fuseau du serveur. */
function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function toPublicProfile(row: ProfileRow) {
  return profileSchema.parse({
    sex: row.sex,
    birthDate: row.birthDate,
    heightCm: row.heightCm,
    activityLevel: row.activityLevel,
    goal: row.goal,
    weeklySessions: row.weeklySessions,
  });
}

async function loadMe(userId: string) {
  const [user] = await db.select().from(users).where(eq(users.id, userId));
  if (!user) throw notFound('user/not-found', 'Compte introuvable.');

  const [profile] = await db.select().from(profiles).where(eq(profiles.userId, userId));

  const [weight] = await db
    .select({ weightKg: weightEntries.weightKg })
    .from(weightEntries)
    .where(eq(weightEntries.userId, userId))
    .orderBy(desc(weightEntries.date))
    .limit(1);

  return {
    user: await toPublicUser(user),
    profile: profile ? toPublicProfile(profile) : null,
    latestWeightKg: weight?.weightKg ?? null,
  };
}

export const meRoutes: FastifyPluginAsyncZod = async (app) => {
  // Toutes les routes de ce module touchent des données personnelles.
  app.addHook('onRequest', app.requireAuth);

  app.get('/me', { schema: { response: { 200: meSchema } } }, async (request) =>
    loadMe(currentUser(request).id),
  );

  app.patch(
    '/me',
    { schema: { body: updateUserSchema, response: { 200: userSchema } } },
    async (request) => {
      const user = currentUser(request);

      const [updated] = await db
        .update(users)
        .set({ ...request.body, updatedAt: new Date() })
        .where(eq(users.id, user.id))
        .returning();

      if (!updated) throw notFound('user/not-found', 'Compte introuvable.');

      return toPublicUser(updated);
    },
  );

  /** L'onboarding : le profil, le prénom et le premier poids, en une fois. */
  app.post(
    '/me/onboarding',
    { schema: { body: onboardingSchema, response: { 200: meSchema } } },
    async (request) => {
      const user = currentUser(request);
      const { name, weightKg, ...profile } = request.body;

      await db.transaction(async (tx) => {
        await tx.update(users).set({ name, updatedAt: new Date() }).where(eq(users.id, user.id));

        await tx
          .insert(profiles)
          .values({ userId: user.id, ...profile })
          .onConflictDoUpdate({
            target: profiles.userId,
            set: { ...profile, updatedAt: new Date() },
          });

        await tx
          .insert(weightEntries)
          .values({ userId: user.id, date: today(), weightKg })
          .onConflictDoUpdate({
            target: [weightEntries.userId, weightEntries.date],
            set: { weightKg },
          });
      });

      return loadMe(user.id);
    },
  );

  app.put(
    '/me/profile',
    { schema: { body: profileUpdateSchema, response: { 200: meSchema, 400: apiErrorSchema } } },
    async (request) => {
      const user = currentUser(request);
      const [existing] = await db.select().from(profiles).where(eq(profiles.userId, user.id));

      if (!existing) {
        throw badRequest('profile/not-created', 'Le questionnaire d’accueil n’a pas été rempli.');
      }

      await db
        .update(profiles)
        .set({ ...request.body, updatedAt: new Date() })
        .where(eq(profiles.userId, user.id));

      return loadMe(user.id);
    },
  );

  app.post(
    '/me/password',
    { schema: { body: changePasswordSchema, response: { 204: z.null(), 401: apiErrorSchema } } },
    async (request, reply) => {
      const user = currentUser(request);

      if (!user.passwordHash) {
        throw badRequest(
          AUTH_ERROR_CODES.noPassword,
          'Ce compte se connecte par Google ou Apple : il n’a pas de mot de passe.',
        );
      }

      if (!(await verifyPassword(user.passwordHash, request.body.currentPassword))) {
        throw unauthorized(AUTH_ERROR_CODES.invalidCredentials, 'Mot de passe actuel incorrect.');
      }

      await db
        .update(users)
        .set({ passwordHash: await hashPassword(request.body.newPassword), updatedAt: new Date() })
        .where(eq(users.id, user.id));

      // Déconnecte tous les appareils, y compris celui-ci.
      await revokeAllSessions(user.id);
      clearRefreshCookie(reply);

      return reply.status(204).send(null);
    },
  );

  /**
   * Export des données (RGPD, droit à la portabilité). Tout ce que nous
   * détenons sur la personne, en JSON lisible.
   */
  app.get('/me/export', { schema: { response: { 200: z.looseObject({}) } } }, async (request) => {
    const user = currentUser(request);

    const [profile] = await db.select().from(profiles).where(eq(profiles.userId, user.id));
    const weights = await db
      .select({ date: weightEntries.date, weightKg: weightEntries.weightKg })
      .from(weightEntries)
      .where(eq(weightEntries.userId, user.id))
      .orderBy(weightEntries.date);
    const identities = await db
      .select({ provider: authIdentities.provider, createdAt: authIdentities.createdAt })
      .from(authIdentities)
      .where(eq(authIdentities.userId, user.id));

    return {
      exportedAt: new Date().toISOString(),
      account: {
        email: user.email,
        name: user.name,
        locale: user.locale,
        healthDataConsentAt: user.healthDataConsentAt?.toISOString() ?? null,
        createdAt: user.createdAt.toISOString(),
      },
      profile: profile ? toPublicProfile(profile) : null,
      weightEntries: weights,
      connectedProviders: identities.map((row) => ({
        provider: row.provider,
        connectedAt: row.createdAt.toISOString(),
      })),
    };
  });

  /**
   * Suppression du compte (RGPD, droit à l'effacement). Le mot de passe est
   * redemandé, et les suppressions en cascade emportent profil, poids,
   * sessions et identités.
   */
  app.delete(
    '/me',
    { schema: { body: deleteAccountSchema, response: { 204: z.null(), 401: apiErrorSchema } } },
    async (request, reply) => {
      const user = currentUser(request);

      if (!user.passwordHash) {
        throw badRequest(
          AUTH_ERROR_CODES.noPassword,
          'Ce compte se connecte par Google ou Apple : il n’a pas de mot de passe.',
        );
      }

      if (!(await verifyPassword(user.passwordHash, request.body.password))) {
        throw unauthorized(AUTH_ERROR_CODES.invalidCredentials, 'Mot de passe incorrect.');
      }

      await db.delete(users).where(eq(users.id, user.id));
      clearRefreshCookie(reply);

      return reply.status(204).send(null);
    },
  );
};
