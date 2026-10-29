import {
  booleanQueryParam,
  dayTotals,
  nutritionProgramInputSchema,
  nutritionProgramSchema,
  nutritionProgramSummarySchema,
  targetsFromSettings,
  type NutritionProgram,
  type NutritionProgramInput,
} from '@betterfit/shared';
import { and, asc, desc, eq, inArray, or } from 'drizzle-orm';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { currentUser } from '../auth/plugin.js';
import { db } from '../db/client.js';
import {
  mealItems,
  meals,
  nutritionDetails,
  programRecipes,
  programs,
  shoppingCategories,
  shoppingItems,
  type NutritionDetailsRow,
} from '../db/schema.js';
import { badRequest, notFound } from '../errors.js';

/**
 * Les programmes de nutrition.
 *
 * Comme les programmes de musculation, ils sont lus et écrits **d'un bloc** :
 * l'éditeur manipule un document entier, et l'enregistrement remplace repas,
 * lignes et liste de courses dans une transaction.
 *
 * Une exception : cocher un article de la liste de courses. C'est le client
 * qui coche, en faisant ses courses, y compris sur un plan que son coach lui
 * a assigné et qu'il ne peut pas modifier. Ça passe donc par sa propre route.
 */

/** Les réglages, tels que le schéma partagé les attend. */
function toSettings(details: NutritionDetailsRow) {
  return {
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
  };
}

export async function loadNutritionProgram(programId: string): Promise<NutritionProgram | null> {
  const [program] = await db.select().from(programs).where(eq(programs.id, programId));
  if (!program || program.kind !== 'nutrition') return null;

  const [details] = await db
    .select()
    .from(nutritionDetails)
    .where(eq(nutritionDetails.programId, programId));

  if (!details) return null;

  const mealRows = await db
    .select()
    .from(meals)
    .where(eq(meals.programId, programId))
    .orderBy(asc(meals.position));

  const mealIds = mealRows.map((row) => row.id);

  const itemRows = mealIds.length
    ? await db
        .select()
        .from(mealItems)
        .where(inArray(mealItems.mealId, mealIds))
        .orderBy(asc(mealItems.position))
    : [];

  const categoryRows = await db
    .select()
    .from(shoppingCategories)
    .where(eq(shoppingCategories.programId, programId))
    .orderBy(asc(shoppingCategories.position));

  const categoryIds = categoryRows.map((row) => row.id);

  const shoppingRows = categoryIds.length
    ? await db
        .select()
        .from(shoppingItems)
        .where(inArray(shoppingItems.categoryId, categoryIds))
        .orderBy(asc(shoppingItems.position))
    : [];

  const recipeRows = await db
    .select({ recipeId: programRecipes.recipeId })
    .from(programRecipes)
    .where(eq(programRecipes.programId, programId))
    .orderBy(asc(programRecipes.position));

  const settings = toSettings(details);

  const programMeals = mealRows.map((meal) => ({
    id: meal.id,
    name: meal.name,
    time: meal.time,
    kcalOverride: meal.kcalOverride,
    items: itemRows
      .filter((item) => item.mealId === meal.id)
      .map((item) => ({
        id: item.id,
        foodId: item.foodId,
        label: item.label,
        quantity: item.quantity,
        quantityG: item.quantityG,
        alternative: item.alternative,
        kcal: item.kcal,
        proteinG: item.proteinG,
        carbsG: item.carbsG,
        fatG: item.fatG,
      })),
  }));

  return nutritionProgramSchema.parse({
    id: program.id,
    ownerId: program.ownerId,
    title: program.title,
    isTemplate: program.isTemplate,
    startDate: program.startDate,
    endDate: program.endDate,
    assignedToUserId: program.assignedToUserId,
    settings,
    targets: targetsFromSettings(settings),
    meals: programMeals,
    shopping: categoryRows.map((category) => ({
      id: category.id,
      name: category.name,
      items: shoppingRows
        .filter((item) => item.categoryId === category.id)
        .map((item) => ({
          id: item.id,
          label: item.label,
          quantity: item.quantity,
          checked: item.checked,
          priceCents: item.priceCents,
          store: item.store,
        })),
    })),
    recipeIds: recipeRows.map((row) => row.recipeId),
    dayTotals: dayTotals(programMeals),
    updatedAt: program.updatedAt.toISOString(),
  });
}

/**
 * Écrit réglages, repas, lignes et liste de courses. Tout est remplacé, ce
 * qui rend l'opération idempotente et évite de deviner ce qui a changé.
 */
async function writeContents(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  programId: string,
  input: NutritionProgramInput,
): Promise<void> {
  const details = {
    sex: input.settings.sex,
    age: input.settings.age,
    weightKg: input.settings.weightKg,
    heightCm: input.settings.heightCm,
    activityLevel: input.settings.activityLevel,
    deficitKcal: input.settings.deficitKcal,
    proteinGPerKg: input.settings.proteinGPerKg,
    fatGPerKg: input.settings.fatGPerKg,
    fiberG: input.settings.fiberG,
    waterLiters: input.settings.waterLiters,
    goalTitle: input.settings.goalTitle,
    goalText: input.settings.goalText,
    preferred: input.settings.preferred,
    limited: input.settings.limited,
    coachNote: input.settings.coachNote,
    shoppingDays: input.settings.shoppingDays,
    budgetCents: input.settings.budgetCents,
  };

  await tx
    .insert(nutritionDetails)
    .values({ programId, ...details })
    .onConflictDoUpdate({ target: nutritionDetails.programId, set: details });

  // Supprimer les repas et les rayons emporte leurs lignes (cascade).
  await tx.delete(meals).where(eq(meals.programId, programId));
  await tx.delete(shoppingCategories).where(eq(shoppingCategories.programId, programId));
  await tx.delete(programRecipes).where(eq(programRecipes.programId, programId));

  for (const [position, meal] of input.meals.entries()) {
    const [row] = await tx
      .insert(meals)
      .values({
        programId,
        position,
        name: meal.name,
        time: meal.time,
        kcalOverride: meal.kcalOverride,
      })
      .returning({ id: meals.id });

    if (!row) throw badRequest('nutrition/save-failed', 'Enregistrement du repas impossible.');

    if (meal.items.length > 0) {
      await tx.insert(mealItems).values(
        meal.items.map((item, index) => ({
          mealId: row.id,
          position: index,
          foodId: item.foodId,
          label: item.label,
          quantity: item.quantity,
          quantityG: item.quantityG,
          alternative: item.alternative,
          kcal: item.kcal,
          proteinG: item.proteinG,
          carbsG: item.carbsG,
          fatG: item.fatG,
        })),
      );
    }
  }

  for (const [position, category] of input.shopping.entries()) {
    const [row] = await tx
      .insert(shoppingCategories)
      .values({ programId, position, name: category.name })
      .returning({ id: shoppingCategories.id });

    if (!row) throw badRequest('nutrition/save-failed', 'Enregistrement du rayon impossible.');

    if (category.items.length > 0) {
      await tx.insert(shoppingItems).values(
        category.items.map((item, index) => ({
          categoryId: row.id,
          position: index,
          label: item.label,
          quantity: item.quantity,
          checked: item.checked,
          priceCents: item.priceCents,
          store: item.store,
        })),
      );
    }
  }

  if (input.recipeIds.length > 0) {
    await tx
      .insert(programRecipes)
      .values(input.recipeIds.map((recipeId, position) => ({ programId, recipeId, position })));
  }
}

/** Le programme, s'il est lisible par cette personne. Sinon « introuvable ». */
async function readable(programId: string, userId: string): Promise<NutritionProgram> {
  const program = await loadNutritionProgram(programId);

  // Introuvable plutôt qu'interdit : la réponse ne doit pas révéler qu'un
  // programme existe chez quelqu'un d'autre.
  if (!program || (program.ownerId !== userId && program.assignedToUserId !== userId)) {
    throw notFound('nutrition/not-found', 'Programme de nutrition introuvable.');
  }

  return program;
}

/** Idem, mais pour modifier : seul le propriétaire le peut. */
async function editable(programId: string, userId: string) {
  const [existing] = await db.select().from(programs).where(eq(programs.id, programId));

  if (!existing || existing.kind !== 'nutrition' || existing.ownerId !== userId) {
    throw notFound('nutrition/not-found', 'Programme de nutrition introuvable.');
  }

  return existing;
}

export const nutritionRoutes: FastifyPluginAsyncZod = async (app) => {
  app.addHook('onRequest', app.requireAuth);

  app.get(
    '/nutrition-programs',
    {
      schema: {
        querystring: z.object({ templates: booleanQueryParam().optional() }),
        response: { 200: z.object({ items: z.array(nutritionProgramSummarySchema) }) },
      },
    },
    async (request) => {
      const user = currentUser(request);
      const { templates } = request.query;

      const rows = await db
        .select({ program: programs, details: nutritionDetails })
        .from(programs)
        .innerJoin(nutritionDetails, eq(nutritionDetails.programId, programs.id))
        .where(
          and(
            eq(programs.kind, 'nutrition'),
            // Les siens, et ceux qu'un coach lui a assignés.
            or(eq(programs.ownerId, user.id), eq(programs.assignedToUserId, user.id)),
            templates === undefined ? undefined : eq(programs.isTemplate, templates),
          ),
        )
        .orderBy(desc(programs.updatedAt));

      const ids = rows.map((row) => row.program.id);

      const mealRows = ids.length
        ? await db
            .select({ programId: meals.programId, id: meals.id })
            .from(meals)
            .where(inArray(meals.programId, ids))
        : [];

      return {
        items: rows.map((row) => ({
          id: row.program.id,
          title: row.program.title,
          isTemplate: row.program.isTemplate,
          assignedToUserId: row.program.assignedToUserId,
          targetKcal: targetsFromSettings(toSettings(row.details)).targetKcal,
          mealCount: mealRows.filter((meal) => meal.programId === row.program.id).length,
          updatedAt: row.program.updatedAt.toISOString(),
        })),
      };
    },
  );

  app.post(
    '/nutrition-programs',
    { schema: { body: nutritionProgramInputSchema, response: { 201: nutritionProgramSchema } } },
    async (request, reply) => {
      const user = currentUser(request);
      const input = request.body;

      const programId = await db.transaction(async (tx) => {
        const [program] = await tx
          .insert(programs)
          .values({
            ownerId: user.id,
            kind: 'nutrition',
            title: input.title,
            isTemplate: input.isTemplate,
            startDate: input.startDate,
            endDate: input.endDate,
          })
          .returning({ id: programs.id });

        if (!program) throw badRequest('nutrition/save-failed', 'Création impossible.');

        await writeContents(tx, program.id, input);

        return program.id;
      });

      const saved = await loadNutritionProgram(programId);
      if (!saved) throw notFound('nutrition/not-found', 'Programme introuvable.');

      return reply.status(201).send(saved);
    },
  );

  app.get(
    '/nutrition-programs/:id',
    { schema: { params: z.object({ id: z.uuid() }), response: { 200: nutritionProgramSchema } } },
    async (request) => readable(request.params.id, currentUser(request).id),
  );

  app.put(
    '/nutrition-programs/:id',
    {
      schema: {
        params: z.object({ id: z.uuid() }),
        body: nutritionProgramInputSchema,
        response: { 200: nutritionProgramSchema },
      },
    },
    async (request) => {
      const user = currentUser(request);
      const existing = await editable(request.params.id, user.id);
      const input = request.body;

      await db.transaction(async (tx) => {
        await tx
          .update(programs)
          .set({
            title: input.title,
            isTemplate: input.isTemplate,
            startDate: input.startDate,
            endDate: input.endDate,
            updatedAt: new Date(),
          })
          .where(eq(programs.id, existing.id));

        await writeContents(tx, existing.id, input);
      });

      const saved = await loadNutritionProgram(existing.id);
      if (!saved) throw notFound('nutrition/not-found', 'Programme introuvable.');

      return saved;
    },
  );

  app.delete(
    '/nutrition-programs/:id',
    { schema: { params: z.object({ id: z.uuid() }), response: { 204: z.null() } } },
    async (request, reply) => {
      const user = currentUser(request);
      const existing = await editable(request.params.id, user.id);

      await db.delete(programs).where(eq(programs.id, existing.id));

      return reply.status(204).send(null);
    },
  );

  /**
   * Cocher, décocher ou chiffrer un article de la liste de courses.
   *
   * Accessible au client comme au propriétaire : c'est le client qui fait les
   * courses, même quand le plan vient de son coach.
   */
  app.patch(
    '/nutrition-programs/:id/shopping-items/:itemId',
    {
      schema: {
        params: z.object({ id: z.uuid(), itemId: z.uuid() }),
        body: z.object({
          checked: z.boolean().optional(),
          priceCents: z.number().int().min(0).max(1_000_000).nullable().optional(),
          store: z.string().trim().max(60).optional(),
        }),
        response: { 200: nutritionProgramSchema },
      },
    },
    async (request) => {
      const user = currentUser(request);
      const program = await readable(request.params.id, user.id);

      // L'article doit appartenir à *ce* programme : sans cette vérification,
      // on cocherait l'article d'une liste qu'on n'a pas le droit de voir.
      const belongs = program.shopping.some((category) =>
        category.items.some((item) => item.id === request.params.itemId),
      );

      if (!belongs) throw notFound('nutrition/item-not-found', 'Article introuvable.');

      await db
        .update(shoppingItems)
        .set(request.body)
        .where(eq(shoppingItems.id, request.params.itemId));

      const saved = await loadNutritionProgram(program.id);
      if (!saved) throw notFound('nutrition/not-found', 'Programme introuvable.');

      return saved;
    },
  );
};
