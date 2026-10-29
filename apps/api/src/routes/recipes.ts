import { createReadStream } from 'node:fs';
import { resolve } from 'node:path';
import {
  priceInputSchema,
  priceKey,
  priceListSchema,
  recipeInputSchema,
  recipeListSchema,
  recipeSchema,
  type Recipe,
} from '@betterfit/shared';
import { and, asc, desc, eq, inArray, isNull, or } from 'drizzle-orm';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { currentUser } from '../auth/plugin.js';
import { db } from '../db/client.js';
import { foodPrices, recipeIngredients, recipeSteps, recipes } from '../db/schema.js';
import { badRequest, notFound } from '../errors.js';
import {
  isSafePhotoName,
  photoUrl,
  recipesDir,
  verifyPhotoUrl,
  writePhoto,
} from '../recipes/photos.js';

/**
 * Recettes et prix.
 *
 * Une recette appartient à son auteur et se réutilise d'un programme à
 * l'autre. Elle s'écrit d'un bloc, comme un programme : ingrédients et étapes
 * sont remplacés à chaque enregistrement.
 */

/** La photo acceptée à l'enregistrement : une image en `data:`, ou rien. */
const recipeBodySchema = recipeInputSchema.extend({
  /** `null` efface la photo, `undefined` la laisse telle quelle. */
  photoDataUrl: z.string().max(3_000_000).nullable().optional(),
});

async function loadRecipe(recipeId: string): Promise<Recipe | null> {
  const [recipe] = await db.select().from(recipes).where(eq(recipes.id, recipeId));
  if (!recipe) return null;

  const ingredients = await db
    .select()
    .from(recipeIngredients)
    .where(eq(recipeIngredients.recipeId, recipeId))
    .orderBy(asc(recipeIngredients.position));

  const steps = await db
    .select()
    .from(recipeSteps)
    .where(eq(recipeSteps.recipeId, recipeId))
    .orderBy(asc(recipeSteps.position));

  return recipeSchema.parse({
    id: recipe.id,
    ownerId: recipe.ownerId,
    title: recipe.title,
    category: recipe.category,
    prepMinutes: recipe.prepMinutes,
    cookMinutes: recipe.cookMinutes,
    servings: recipe.servings,
    kcal: recipe.kcal,
    proteinG: recipe.proteinG,
    carbsG: recipe.carbsG,
    fatG: recipe.fatG,
    tip: recipe.tip,
    photoUrl: photoUrl(recipe.photoPath),
    ingredients: ingredients.map((row) => ({
      id: row.id,
      foodId: row.foodId,
      label: row.label,
      quantity: row.quantity,
      quantityG: row.quantityG,
    })),
    steps: steps.map((row) => row.text),
    updatedAt: recipe.updatedAt.toISOString(),
  });
}

async function writeContents(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  recipeId: string,
  input: z.infer<typeof recipeInputSchema>,
): Promise<void> {
  await tx.delete(recipeIngredients).where(eq(recipeIngredients.recipeId, recipeId));
  await tx.delete(recipeSteps).where(eq(recipeSteps.recipeId, recipeId));

  if (input.ingredients.length > 0) {
    await tx.insert(recipeIngredients).values(
      input.ingredients.map((ingredient, position) => ({
        recipeId,
        position,
        foodId: ingredient.foodId,
        label: ingredient.label,
        quantity: ingredient.quantity,
        quantityG: ingredient.quantityG,
      })),
    );
  }

  if (input.steps.length > 0) {
    await tx
      .insert(recipeSteps)
      .values(input.steps.map((text, position) => ({ recipeId, position, text })));
  }
}

/** La recette, si elle appartient bien à cette personne. */
async function owned(recipeId: string, userId: string) {
  const [recipe] = await db.select().from(recipes).where(eq(recipes.id, recipeId));

  // Introuvable plutôt qu'interdit : la réponse ne révèle pas l'existence de
  // la recette de quelqu'un d'autre.
  if (!recipe || recipe.ownerId !== userId) {
    throw notFound('recipe/not-found', 'Recette introuvable.');
  }

  return recipe;
}

export const recipeRoutes: FastifyPluginAsyncZod = async (app) => {
  /**
   * La photo : adresse signée, pas de jeton d'authentification.
   *
   * Déclarée **avant** le hook d'authentification, et c'est volontaire : une
   * balise `<img>` ne peut pas porter d'en-tête `Authorization`. C'est la
   * signature qui tient lieu de droit d'accès, et elle expire.
   */
  app.get(
    '/recipes/photos/:name',
    {
      schema: {
        params: z.object({ name: z.string().max(64) }),
        querystring: z.object({ expires: z.coerce.number().int(), token: z.string().max(128) }),
      },
    },
    async (request, reply) => {
      const { name } = request.params;
      const { expires, token } = request.query;

      if (!isSafePhotoName(name) || !verifyPhotoUrl(name, expires, token)) {
        throw notFound('recipe/photo-not-found', 'Photo introuvable.');
      }

      const extension = name.split('.').pop();
      const type = extension === 'png' ? 'png' : extension === 'webp' ? 'webp' : 'jpeg';

      return (
        reply
          .type(`image/${type}`)
          // Privée : jamais mise en cache par un intermédiaire partagé.
          .header('cache-control', 'private, max-age=3600')
          .send(createReadStream(resolve(recipesDir(), name)))
      );
    },
  );

  /*
   * Tout le reste exige une authentification. Le hook est posé dans un
   * périmètre imbriqué, et pas sur `app` : en Fastify, un hook s'applique à
   * **toutes** les routes de son périmètre, y compris celles déclarées plus
   * haut dans le fichier. Posé sur `app`, il protégerait aussi la route des
   * photos, dont l'adresse signée est justement là pour s'en passer.
   */
  const secureRoutes: FastifyPluginAsyncZod = async (secure) => {
    secure.addHook('onRequest', secure.requireAuth);

    secure.get('/recipes', { schema: { response: { 200: recipeListSchema } } }, async (request) => {
      const user = currentUser(request);

      const rows = await db
        .select({ id: recipes.id })
        .from(recipes)
        .where(eq(recipes.ownerId, user.id))
        .orderBy(desc(recipes.updatedAt));

      const items = await Promise.all(rows.map((row) => loadRecipe(row.id)));

      return { items: items.filter((item): item is Recipe => item !== null) };
    });

    secure.post(
      '/recipes',
      { schema: { body: recipeBodySchema, response: { 201: recipeSchema } } },
      async (request, reply) => {
        const user = currentUser(request);
        const { photoDataUrl, ...input } = request.body;

        const recipeId = await db.transaction(async (tx) => {
          const [recipe] = await tx
            .insert(recipes)
            .values({
              ownerId: user.id,
              title: input.title,
              category: input.category,
              prepMinutes: input.prepMinutes,
              cookMinutes: input.cookMinutes,
              servings: input.servings,
              kcal: input.kcal,
              proteinG: input.proteinG,
              carbsG: input.carbsG,
              fatG: input.fatG,
              tip: input.tip,
            })
            .returning({ id: recipes.id });

          if (!recipe) throw badRequest('recipe/save-failed', 'Création impossible.');

          await writeContents(tx, recipe.id, input);

          if (photoDataUrl) {
            const photoPath = writePhoto(recipe.id, photoDataUrl);
            await tx.update(recipes).set({ photoPath }).where(eq(recipes.id, recipe.id));
          }

          return recipe.id;
        });

        const saved = await loadRecipe(recipeId);
        if (!saved) throw notFound('recipe/not-found', 'Recette introuvable.');

        return reply.status(201).send(saved);
      },
    );

    secure.get(
      '/recipes/:id',
      { schema: { params: z.object({ id: z.uuid() }), response: { 200: recipeSchema } } },
      async (request) => {
        const user = currentUser(request);
        await owned(request.params.id, user.id);

        const recipe = await loadRecipe(request.params.id);
        if (!recipe) throw notFound('recipe/not-found', 'Recette introuvable.');

        return recipe;
      },
    );

    secure.put(
      '/recipes/:id',
      {
        schema: {
          params: z.object({ id: z.uuid() }),
          body: recipeBodySchema,
          response: { 200: recipeSchema },
        },
      },
      async (request) => {
        const user = currentUser(request);
        const existing = await owned(request.params.id, user.id);
        const { photoDataUrl, ...input } = request.body;

        await db.transaction(async (tx) => {
          await tx
            .update(recipes)
            .set({
              title: input.title,
              category: input.category,
              prepMinutes: input.prepMinutes,
              cookMinutes: input.cookMinutes,
              servings: input.servings,
              kcal: input.kcal,
              proteinG: input.proteinG,
              carbsG: input.carbsG,
              fatG: input.fatG,
              tip: input.tip,
              // `undefined` laisse la photo, `null` l'efface.
              photoPath:
                photoDataUrl === undefined
                  ? existing.photoPath
                  : photoDataUrl === null
                    ? null
                    : writePhoto(existing.id, photoDataUrl),
              updatedAt: new Date(),
            })
            .where(eq(recipes.id, existing.id));

          await writeContents(tx, existing.id, input);
        });

        const saved = await loadRecipe(existing.id);
        if (!saved) throw notFound('recipe/not-found', 'Recette introuvable.');

        return saved;
      },
    );

    secure.delete(
      '/recipes/:id',
      { schema: { params: z.object({ id: z.uuid() }), response: { 204: z.null() } } },
      async (request, reply) => {
        const user = currentUser(request);
        const existing = await owned(request.params.id, user.id);

        await db.delete(recipes).where(eq(recipes.id, existing.id));

        return reply.status(204).send(null);
      },
    );

    /* ---------------------------------------------------------------- */
    /* Les prix                                                          */
    /* ---------------------------------------------------------------- */

    /**
     * Les prix connus pour une liste d'articles.
     *
     * On renvoie les prix saisis par la personne **et** les prix publics
     * (Open Prices, `owner_id` nul). C'est l'app qui choisit lequel retenir,
     * avec `bestPrice`.
     */
    secure.get(
      '/prices',
      {
        schema: {
          querystring: z.object({ labels: z.string().max(2000) }),
          response: { 200: priceListSchema },
        },
      },
      async (request) => {
        const user = currentUser(request);

        const keys = [
          ...new Set(
            request.query.labels
              .split(',')
              .map((label) => priceKey(label))
              .filter((label) => label.length > 0),
          ),
        ].slice(0, 100);

        if (keys.length === 0) return { items: [] };

        const rows = await db
          .select()
          .from(foodPrices)
          .where(
            and(
              inArray(foodPrices.label, keys),
              or(eq(foodPrices.ownerId, user.id), isNull(foodPrices.ownerId)),
            ),
          )
          .orderBy(desc(foodPrices.updatedAt));

        return {
          items: rows.map((row) => ({
            id: row.id,
            label: row.label,
            store: row.store,
            priceCents: row.priceCents,
            unit: row.unit,
            source: row.source === 'open_prices' ? ('open_prices' as const) : ('manual' as const),
            updatedAt: row.updatedAt.toISOString(),
          })),
        };
      },
    );

    /** Mémorise un prix saisi à la main, pour ne plus le redemander. */
    secure.post(
      '/prices',
      { schema: { body: priceInputSchema, response: { 204: z.null() } } },
      async (request, reply) => {
        const user = currentUser(request);
        const { label, store, priceCents, unit } = request.body;

        await db
          .insert(foodPrices)
          .values({
            ownerId: user.id,
            label: priceKey(label),
            store,
            priceCents,
            unit,
            source: 'manual',
          })
          .onConflictDoUpdate({
            target: [foodPrices.ownerId, foodPrices.label, foodPrices.store],
            set: { priceCents, unit, updatedAt: new Date() },
          });

        return reply.status(204).send(null);
      },
    );
  };

  await app.register(secureRoutes);
};
