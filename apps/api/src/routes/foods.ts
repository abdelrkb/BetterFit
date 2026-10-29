import {
  FOOD_PAGE_SIZE,
  buildFoodSearchText,
  customFoodSchema,
  foodListSchema,
  foodSchema,
  foodSearchSchema,
} from '@betterfit/shared';
import { and, asc, count, desc, eq, isNull, or, sql as raw, type SQL } from 'drizzle-orm';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { currentUser } from '../auth/plugin.js';
import { db } from '../db/client.js';
import { foods, type FoodRow } from '../db/schema.js';
import { notFound } from '../errors.js';

/**
 * La base d'aliments : Ciqual, les produits déjà scannés, et les aliments
 * personnels.
 *
 * La recherche se fait **toujours chez nous**, jamais chez Open Food Facts :
 * leur serveur limite à dix recherches par minute et par IP, ce qui est
 * incompatible avec une recherche au fil de la frappe. Seule la lecture d'un
 * code-barres les interroge, depuis l'appareil, et le résultat est mis en
 * cache ici.
 */

/**
 * Seuil de ressemblance, comme pour les exercices. `word_similarity` compare
 * au meilleur morceau du texte indexé : « poullet » reste proche de « blanc
 * de poulet », là où la similarité classique s'effondrerait sur le reste de
 * la ligne.
 */
const SIMILARITY_THRESHOLD = 0.45;

function normalizeQuery(query: string): string {
  return query
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim();
}

export function toFood(row: FoodRow) {
  return foodSchema.parse({
    id: row.id,
    source: row.source,
    ownerId: row.ownerId,
    externalId: row.externalId,
    barcode: row.barcode,
    name: row.name,
    brand: row.brand,
    category: row.category,
    kcal: row.kcal,
    proteinG: row.proteinG,
    carbsG: row.carbsG,
    sugarsG: row.sugarsG,
    fatG: row.fatG,
    saturatedFatG: row.saturatedFatG,
    fiberG: row.fiberG,
    saltG: row.saltG,
    servingLabel: row.servingLabel,
    servingG: row.servingG,
  });
}

export const foodRoutes: FastifyPluginAsyncZod = async (app) => {
  app.addHook('onRequest', app.requireAuth);

  app.get(
    '/foods',
    { schema: { querystring: foodSearchSchema, response: { 200: foodListSchema } } },
    async (request) => {
      const user = currentUser(request);
      const { q, mine, source, page } = request.query;

      // Chacun voit la base partagée et **ses** aliments, jamais ceux des
      // autres.
      const visible = mine
        ? eq(foods.ownerId, user.id)
        : or(isNull(foods.ownerId), eq(foods.ownerId, user.id));

      const filters: (SQL | undefined)[] = [visible];
      if (source) filters.push(eq(foods.source, source));

      const needle = q ? normalizeQuery(q) : null;

      if (needle && needle.length > 0) {
        filters.push(
          or(
            raw`${foods.searchText} ilike ${'%' + needle + '%'}`,
            raw`word_similarity(${needle}, ${foods.searchText}) > ${SIMILARITY_THRESHOLD}`,
          ),
        );
      }

      const where = and(...filters.filter((filter): filter is SQL => filter !== undefined));

      const [totals] = await db.select({ total: count() }).from(foods).where(where);

      const rows = await db
        .select()
        .from(foods)
        .where(where)
        .orderBy(
          // Les plus proches de la recherche d'abord. Sans recherche, ses
          // propres aliments passent devant la base générique : on cherche
          // plus souvent ce qu'on a créé soi-même.
          ...(needle
            ? [desc(raw`word_similarity(${needle}, ${foods.searchText})`), asc(foods.name)]
            : [desc(foods.source), asc(foods.name)]),
        )
        .limit(FOOD_PAGE_SIZE)
        .offset((page - 1) * FOOD_PAGE_SIZE);

      return {
        items: rows.map(toFood),
        total: totals?.total ?? 0,
        page,
        pageSize: FOOD_PAGE_SIZE,
      };
    },
  );

  /** Un produit déjà connu, par son code-barres. */
  app.get(
    '/foods/barcode/:barcode',
    {
      schema: {
        params: z.object({ barcode: z.string().regex(/^\d{8,14}$/) }),
        response: { 200: foodSchema },
      },
    },
    async (request) => {
      const user = currentUser(request);

      const [row] = await db
        .select()
        .from(foods)
        .where(
          and(
            eq(foods.barcode, request.params.barcode),
            or(isNull(foods.ownerId), eq(foods.ownerId, user.id)),
          ),
        )
        .orderBy(desc(foods.updatedAt))
        .limit(1);

      if (!row) throw notFound('food/not-found', 'Produit inconnu.');

      return toFood(row);
    },
  );

  app.post(
    '/foods',
    { schema: { body: customFoodSchema, response: { 201: foodSchema } } },
    async (request, reply) => {
      const user = currentUser(request);
      const input = request.body;

      const [row] = await db
        .insert(foods)
        .values({
          source: 'custom',
          ownerId: user.id,
          externalId: null,
          barcode: input.barcode,
          name: input.name,
          brand: input.brand,
          category: input.category,
          kcal: input.kcal,
          proteinG: input.proteinG,
          carbsG: input.carbsG,
          sugarsG: input.sugarsG,
          fatG: input.fatG,
          saturatedFatG: input.saturatedFatG,
          fiberG: input.fiberG,
          saltG: input.saltG,
          servingLabel: input.servingLabel,
          servingG: input.servingG,
          searchText: buildFoodSearchText(input),
        })
        .returning();

      if (!row) throw notFound('food/save-failed', 'Création impossible.');

      return reply.status(201).send(toFood(row));
    },
  );

  app.get(
    '/foods/:id',
    { schema: { params: z.object({ id: z.uuid() }), response: { 200: foodSchema } } },
    async (request) => {
      const user = currentUser(request);

      const [row] = await db
        .select()
        .from(foods)
        .where(
          and(
            eq(foods.id, request.params.id),
            or(isNull(foods.ownerId), eq(foods.ownerId, user.id)),
          ),
        );

      if (!row) throw notFound('food/not-found', 'Aliment introuvable.');

      return toFood(row);
    },
  );

  app.put(
    '/foods/:id',
    {
      schema: {
        params: z.object({ id: z.uuid() }),
        body: customFoodSchema,
        response: { 200: foodSchema },
      },
    },
    async (request) => {
      const user = currentUser(request);
      const input = request.body;

      // Seuls ses propres aliments se modifient : la base Ciqual est
      // partagée, et personne ne doit pouvoir la réécrire.
      const [row] = await db
        .update(foods)
        .set({
          barcode: input.barcode,
          name: input.name,
          brand: input.brand,
          category: input.category,
          kcal: input.kcal,
          proteinG: input.proteinG,
          carbsG: input.carbsG,
          sugarsG: input.sugarsG,
          fatG: input.fatG,
          saturatedFatG: input.saturatedFatG,
          fiberG: input.fiberG,
          saltG: input.saltG,
          servingLabel: input.servingLabel,
          servingG: input.servingG,
          searchText: buildFoodSearchText(input),
          updatedAt: new Date(),
        })
        .where(and(eq(foods.id, request.params.id), eq(foods.ownerId, user.id)))
        .returning();

      if (!row) throw notFound('food/not-found', 'Aliment introuvable.');

      return toFood(row);
    },
  );

  app.delete(
    '/foods/:id',
    { schema: { params: z.object({ id: z.uuid() }), response: { 204: z.null() } } },
    async (request, reply) => {
      const user = currentUser(request);

      const [row] = await db
        .delete(foods)
        .where(and(eq(foods.id, request.params.id), eq(foods.ownerId, user.id)))
        .returning({ id: foods.id });

      if (!row) throw notFound('food/not-found', 'Aliment introuvable.');

      return reply.status(204).send(null);
    },
  );
};
