import {
  DEFAULT_DEFICIT_KCAL,
  DEFAULT_FAT_G_PER_KG,
  DEFAULT_PROTEIN_G_PER_KG,
  ageFromBirthDate,
  computeNutritionTargets,
  copyDaySchema,
  foodLogInputSchema,
  foodLogSchema,
  journalDaySchema,
  foodSchema,
  journalTotals,
  macrosForFood,
  targetsFromSettings,
  totalsBySlot,
  type FoodLog,
  type JournalDay,
  type NutritionTargets,
} from '@betterfit/shared';
import { and, asc, desc, eq, isNotNull, or } from 'drizzle-orm';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { currentUser } from '../auth/plugin.js';
import { db } from '../db/client.js';
import {
  foodFavorites,
  foodLogs,
  foods,
  nutritionDetails,
  profiles,
  programs,
  weightEntries,
  type FoodLogRow,
} from '../db/schema.js';
import { badRequest, notFound } from '../errors.js';
import { toFood } from './foods.js';

/**
 * Le journal alimentaire.
 *
 * Il fonctionne **sans programme** : quelqu'un qui n'a aucun plan doit
 * pouvoir noter ce qu'il mange, avec des cibles déduites de son profil. Un
 * programme de nutrition actif prend le dessus quand il y en a un.
 */

function toLog(row: FoodLogRow): FoodLog {
  return foodLogSchema.parse({
    id: row.id,
    date: row.date,
    slot: row.slot,
    foodId: row.foodId,
    label: row.label,
    quantityG: row.quantityG,
    quantityText: row.quantityText,
    kcal: row.kcal,
    proteinG: row.proteinG,
    carbsG: row.carbsG,
    fatG: row.fatG,
  });
}

/**
 * Les cibles du jour.
 *
 * Priorité au programme de nutrition actif : c'est ce que le coach a décidé.
 * À défaut, on calcule depuis le profil et le dernier poids — mieux vaut une
 * cible approchée que pas de cible du tout. `null` seulement quand il manque
 * le profil ou le poids.
 */
async function targetsFor(
  userId: string,
): Promise<{ targets: NutritionTargets | null; from: 'program' | 'profile' | 'none' }> {
  const [active] = await db
    .select({ details: nutritionDetails })
    .from(programs)
    .innerJoin(nutritionDetails, eq(nutritionDetails.programId, programs.id))
    .where(
      and(
        eq(programs.kind, 'nutrition'),
        eq(programs.isTemplate, false),
        or(eq(programs.ownerId, userId), eq(programs.assignedToUserId, userId)),
      ),
    )
    .orderBy(desc(programs.updatedAt))
    .limit(1);

  if (active) {
    const details = active.details;

    return {
      targets: targetsFromSettings({
        sex: details.sex,
        age: details.age,
        weightKg: details.weightKg,
        heightCm: details.heightCm,
        activityLevel: details.activityLevel,
        deficitKcal: details.deficitKcal,
        proteinGPerKg: details.proteinGPerKg,
        fatGPerKg: details.fatGPerKg,
        fiberG: details.fiberG,
        waterLiters: details.waterLiters,
        goalTitle: details.goalTitle,
        goalText: details.goalText,
        preferred: details.preferred,
        limited: details.limited,
        coachNote: details.coachNote,
        shoppingDays: details.shoppingDays,
        budgetCents: details.budgetCents,
      }),
      from: 'program',
    };
  }

  const [profile] = await db.select().from(profiles).where(eq(profiles.userId, userId));
  if (!profile) return { targets: null, from: 'none' };

  const [weight] = await db
    .select({ weightKg: weightEntries.weightKg })
    .from(weightEntries)
    .where(eq(weightEntries.userId, userId))
    .orderBy(desc(weightEntries.date))
    .limit(1);

  const age = ageFromBirthDate(profile.birthDate);
  if (!weight || age === null) return { targets: null, from: 'none' };

  return {
    targets: computeNutritionTargets({
      sex: profile.sex,
      age,
      weightKg: weight.weightKg,
      heightCm: profile.heightCm,
      activityLevel: profile.activityLevel,
      deficitKcal: DEFAULT_DEFICIT_KCAL[profile.goal],
      proteinGPerKg: DEFAULT_PROTEIN_G_PER_KG,
      fatGPerKg: DEFAULT_FAT_G_PER_KG,
      waterLiters: null,
    }),
    from: 'profile',
  };
}

async function loadDay(userId: string, date: string): Promise<JournalDay> {
  const rows = await db
    .select()
    .from(foodLogs)
    .where(and(eq(foodLogs.userId, userId), eq(foodLogs.date, date)))
    .orderBy(asc(foodLogs.slot), asc(foodLogs.position), asc(foodLogs.createdAt));

  const entries = rows.map(toLog);
  const { targets, from } = await targetsFor(userId);

  return journalDaySchema.parse({
    date,
    entries,
    slotTotals: totalsBySlot(entries),
    totals: journalTotals(entries),
    targets,
    targetsFrom: from,
  });
}

/**
 * Complète une ligne depuis l'aliment cité.
 *
 * Quand la ligne vient de la base avec une quantité en grammes, le serveur
 * calcule les valeurs lui-même : c'est lui qui fait foi. En saisie rapide on
 * garde ce qui est envoyé — un nom et des calories suffisent.
 */
async function freeze(userId: string, input: z.infer<typeof foodLogInputSchema>) {
  if (input.foodId === null) {
    if (input.label.trim().length === 0) {
      throw badRequest('journal/label-required', 'Il faut au moins un nom.');
    }

    return input;
  }

  const [food] = await db.select().from(foods).where(eq(foods.id, input.foodId));

  // La base partagée a `ownerId` nul ; un aliment perso n'appartient qu'à
  // son créateur. On ne loge jamais l'aliment de quelqu'un d'autre.
  if (!food || (food.ownerId !== null && food.ownerId !== userId)) {
    throw notFound('journal/food-not-found', 'Aliment introuvable.');
  }

  if (input.quantityG === null) {
    return { ...input, label: input.label.trim().length > 0 ? input.label : food.name };
  }

  const macros = macrosForFood(food, input.quantityG);

  return {
    ...input,
    label: input.label.trim().length > 0 ? input.label : food.name,
    kcal: macros.kcal,
    proteinG: macros.proteinG,
    carbsG: macros.carbsG,
    fatG: macros.fatG,
  };
}

export const journalRoutes: FastifyPluginAsyncZod = async (app) => {
  app.addHook('onRequest', app.requireAuth);

  app.get(
    '/journal',
    {
      schema: {
        querystring: z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }),
        response: { 200: journalDaySchema },
      },
    },
    async (request) => loadDay(currentUser(request).id, request.query.date),
  );

  app.post(
    '/journal',
    { schema: { body: foodLogInputSchema, response: { 201: journalDaySchema } } },
    async (request, reply) => {
      const user = currentUser(request);
      const input = await freeze(user.id, request.body);

      await db.insert(foodLogs).values({
        userId: user.id,
        date: input.date,
        slot: input.slot,
        foodId: input.foodId,
        label: input.label,
        quantityG: input.quantityG,
        quantityText: input.quantityText,
        kcal: input.kcal,
        proteinG: input.proteinG,
        carbsG: input.carbsG,
        fatG: input.fatG,
      });

      return reply.status(201).send(await loadDay(user.id, input.date));
    },
  );

  app.delete(
    '/journal/:id',
    { schema: { params: z.object({ id: z.uuid() }), response: { 200: journalDaySchema } } },
    async (request) => {
      const user = currentUser(request);

      const [removed] = await db
        .delete(foodLogs)
        .where(and(eq(foodLogs.id, request.params.id), eq(foodLogs.userId, user.id)))
        .returning({ date: foodLogs.date });

      if (!removed) throw notFound('journal/not-found', 'Ligne introuvable.');

      return loadDay(user.id, removed.date);
    },
  );

  /**
   * Recopie une journée, ou un seul repas, vers un autre jour.
   *
   * Les valeurs sont recopiées telles quelles, pas recalculées : c'est bien
   * la même assiette qu'on remet.
   */
  app.post(
    '/journal/copy',
    { schema: { body: copyDaySchema, response: { 200: journalDaySchema } } },
    async (request) => {
      const user = currentUser(request);
      const { from, to, slot } = request.body;

      const rows = await db
        .select()
        .from(foodLogs)
        .where(
          and(
            eq(foodLogs.userId, user.id),
            eq(foodLogs.date, from),
            slot ? eq(foodLogs.slot, slot) : undefined,
          ),
        )
        .orderBy(asc(foodLogs.position));

      if (rows.length === 0) {
        throw badRequest('journal/nothing-to-copy', 'Il n’y a rien à recopier ce jour-là.');
      }

      await db.insert(foodLogs).values(
        rows.map((row, index) => ({
          userId: user.id,
          date: to,
          slot: row.slot,
          position: index,
          foodId: row.foodId,
          label: row.label,
          quantityG: row.quantityG,
          quantityText: row.quantityText,
          kcal: row.kcal,
          proteinG: row.proteinG,
          carbsG: row.carbsG,
          fatG: row.fatG,
        })),
      );

      return loadDay(user.id, to);
    },
  );

  /**
   * Les aliments logués récemment, du plus récent au plus ancien, une seule
   * fois chacun. C'est le raccourci le plus utile : on mange souvent la même
   * chose.
   */
  app.get(
    '/journal/recents',
    { schema: { response: { 200: z.object({ items: z.array(foodLogSchema) }) } } },
    async (request) => {
      const user = currentUser(request);

      const rows = await db
        .select()
        .from(foodLogs)
        .where(and(eq(foodLogs.userId, user.id), isNotNull(foodLogs.foodId)))
        .orderBy(desc(foodLogs.createdAt))
        .limit(120);

      const seen = new Set<string>();
      const items: FoodLog[] = [];

      for (const row of rows) {
        if (!row.foodId || seen.has(row.foodId)) continue;
        seen.add(row.foodId);
        items.push(toLog(row));
        if (items.length >= 20) break;
      }

      return { items };
    },
  );

  /* ---------------------------------------------------------------- */
  /* Favoris                                                           */
  /* ---------------------------------------------------------------- */

  app.get(
    '/favorites',
    { schema: { response: { 200: z.object({ items: z.array(foodSchema) }) } } },
    async (request) => {
      const user = currentUser(request);

      const rows = await db
        .select({ food: foods })
        .from(foodFavorites)
        .innerJoin(foods, eq(foods.id, foodFavorites.foodId))
        .where(eq(foodFavorites.userId, user.id))
        .orderBy(desc(foodFavorites.createdAt));

      return { items: rows.map((row) => toFood(row.food)) };
    },
  );

  app.post(
    '/favorites/:foodId',
    { schema: { params: z.object({ foodId: z.uuid() }), response: { 204: z.null() } } },
    async (request, reply) => {
      const user = currentUser(request);

      const [food] = await db.select().from(foods).where(eq(foods.id, request.params.foodId));

      if (!food || (food.ownerId !== null && food.ownerId !== user.id)) {
        throw notFound('food/not-found', 'Aliment introuvable.');
      }

      await db
        .insert(foodFavorites)
        .values({ userId: user.id, foodId: food.id })
        .onConflictDoNothing();

      return reply.status(204).send(null);
    },
  );

  app.delete(
    '/favorites/:foodId',
    { schema: { params: z.object({ foodId: z.uuid() }), response: { 204: z.null() } } },
    async (request, reply) => {
      const user = currentUser(request);

      await db
        .delete(foodFavorites)
        .where(
          and(eq(foodFavorites.userId, user.id), eq(foodFavorites.foodId, request.params.foodId)),
        );

      return reply.status(204).send(null);
    },
  );
};
