import {
  customExerciseSchema,
  customExerciseUpdateSchema,
  exerciseListSchema,
  exerciseSchema,
  exerciseSearchSchema,
  exerciseTranslationSchema,
  EXERCISE_PAGE_SIZE,
  MUSCLE_LABELS_FR,
  musclesOfGroup,
  type Muscle,
} from '@betterfit/shared';
import {
  and,
  arrayOverlaps,
  asc,
  count,
  desc,
  eq,
  isNull,
  or,
  sql as raw,
  type SQL,
} from 'drizzle-orm';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { currentUser } from '../auth/plugin.js';
import { buildSearchText } from '../exercises/search-text.js';
import { db } from '../db/client.js';
import { exercises } from '../db/schema.js';
import { forbidden, notFound } from '../errors.js';
import { toExercise, toExerciseSummary } from '../exercises/to-exercise.js';

/**
 * Seuil de ressemblance pour tolérer les fautes de frappe.
 *
 * On compare avec `word_similarity`, qui cherche le **meilleur morceau** du
 * texte indexé : « tracion » ressemble à 0,50 à « tractions », là où la
 * similarité classique tomberait à 0,12 parce qu'elle compare aussi tout le
 * reste de la ligne. En dessous de 0,45, on ramasse du bruit.
 */
const SIMILARITY_THRESHOLD = 0.45;

/** Normalise une recherche comme `search_text` : minuscules, sans accents. */
function normalizeQuery(query: string): string {
  return query.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
}

export const exerciseRoutes: FastifyPluginAsyncZod = async (app) => {
  app.addHook('onRequest', app.requireAuth);

  app.get(
    '/exercises',
    { schema: { querystring: exerciseSearchSchema, response: { 200: exerciseListSchema } } },
    async (request) => {
      const user = currentUser(request);
      const { q, muscleGroup, equipment, level, category, mine, page } = request.query;

      // Chacun voit la bibliothèque partagée et **ses** exercices, jamais ceux
      // des autres.
      const visible = mine
        ? eq(exercises.ownerId, user.id)
        : or(isNull(exercises.ownerId), eq(exercises.ownerId, user.id));

      const filters: (SQL | undefined)[] = [visible];

      if (muscleGroup) {
        const muscles = musclesOfGroup(muscleGroup);
        filters.push(
          or(
            arrayOverlaps(exercises.primaryMuscles, muscles),
            arrayOverlaps(exercises.secondaryMuscles, muscles),
          ),
        );
      }

      if (equipment) filters.push(eq(exercises.equipment, equipment));
      if (level) filters.push(eq(exercises.level, level));
      if (category) filters.push(eq(exercises.category, category));

      const needle = q ? normalizeQuery(q) : null;

      if (needle && needle.length > 0) {
        // `ilike` attrape les sous-chaînes exactes, `word_similarity` rattrape
        // les fautes de frappe. L'un ou l'autre suffit.
        filters.push(
          or(
            raw`${exercises.searchText} ilike ${'%' + needle + '%'}`,
            raw`word_similarity(${needle}, ${exercises.searchText}) > ${SIMILARITY_THRESHOLD}`,
          ),
        );
      }

      const where = and(...filters.filter((filter): filter is SQL => filter !== undefined));

      /**
       * Quand on filtre par muscle, les exercices dont c'est le muscle
       * **principal** passent devant. Sans ça, filtrer « Dos » remonte des
       * arrachés, qui sollicitent les trapèzes en second : techniquement
       * juste, mais ce n'est pas ce qu'un coach cherche.
       */
      // `desc` sur un booléen : les `true` passent devant.
      const primaryFirst = muscleGroup
        ? [desc(arrayOverlaps(exercises.primaryMuscles, musclesOfGroup(muscleGroup)))]
        : [];

      const [totals] = await db.select({ total: count() }).from(exercises).where(where);

      const rows = await db
        .select()
        .from(exercises)
        .where(where)
        .orderBy(
          // Les plus proches de la recherche d'abord ; sinon, le muscle
          // principal, puis l'ordre alphabétique, en montrant ses exercices
          // perso en tête.
          ...(needle
            ? [desc(raw`word_similarity(${needle}, ${exercises.searchText})`), asc(exercises.name)]
            : [...primaryFirst, desc(exercises.source), asc(exercises.name)]),
        )
        .limit(EXERCISE_PAGE_SIZE)
        .offset((page - 1) * EXERCISE_PAGE_SIZE);

      return {
        items: rows.map(toExerciseSummary),
        total: totals?.total ?? 0,
        page,
        pageSize: EXERCISE_PAGE_SIZE,
      };
    },
  );

  app.get(
    '/exercises/:id',
    {
      schema: {
        params: z.object({ id: z.uuid() }),
        response: { 200: exerciseSchema, 404: z.looseObject({}) },
      },
    },
    async (request) => {
      const user = currentUser(request);
      const [row] = await db.select().from(exercises).where(eq(exercises.id, request.params.id));

      if (!row) throw notFound('exercise/not-found', 'Exercice introuvable.');

      // Un exercice personnel n'appartient qu'à son créateur.
      if (row.ownerId !== null && row.ownerId !== user.id) {
        throw notFound('exercise/not-found', 'Exercice introuvable.');
      }

      return toExercise(row);
    },
  );

  app.post(
    '/exercises',
    { schema: { body: customExerciseSchema, response: { 201: exerciseSchema } } },
    async (request, reply) => {
      const user = currentUser(request);
      const input = request.body;

      const [row] = await db
        .insert(exercises)
        .values({
          source: 'custom',
          ownerId: user.id,
          name: input.name,
          primaryMuscles: input.primaryMuscles,
          secondaryMuscles: input.secondaryMuscles,
          equipment: input.equipment,
          level: input.level,
          category: input.category,
          instructions: input.instructions,
          mascotPose: input.mascotPose,
          searchText: buildSearchText({
            name: input.name,
            muscles: [...input.primaryMuscles, ...input.secondaryMuscles].map(
              (muscle) => MUSCLE_LABELS_FR[muscle as Muscle],
            ),
          }),
        })
        .returning();

      if (!row) throw notFound('exercise/not-created', 'Création impossible.');

      return reply.status(201).send(toExercise(row));
    },
  );

  app.patch(
    '/exercises/:id',
    {
      schema: {
        params: z.object({ id: z.uuid() }),
        body: customExerciseUpdateSchema,
        response: { 200: exerciseSchema },
      },
    },
    async (request) => {
      const user = currentUser(request);
      const [row] = await db.select().from(exercises).where(eq(exercises.id, request.params.id));

      if (!row) throw notFound('exercise/not-found', 'Exercice introuvable.');
      if (row.ownerId !== user.id) {
        throw forbidden('exercise/not-yours', 'Cet exercice ne t’appartient pas.');
      }

      const input = request.body;
      const name = input.name ?? row.name;
      const primaryMuscles = input.primaryMuscles ?? (row.primaryMuscles as Muscle[]);
      const secondaryMuscles = input.secondaryMuscles ?? (row.secondaryMuscles as Muscle[]);

      const [updated] = await db
        .update(exercises)
        .set({
          ...input,
          name,
          searchText: buildSearchText({
            name,
            muscles: [...primaryMuscles, ...secondaryMuscles].map(
              (muscle) => MUSCLE_LABELS_FR[muscle],
            ),
          }),
          updatedAt: new Date(),
        })
        .where(eq(exercises.id, row.id))
        .returning();

      if (!updated) throw notFound('exercise/not-found', 'Exercice introuvable.');

      return toExercise(updated);
    },
  );

  app.delete(
    '/exercises/:id',
    { schema: { params: z.object({ id: z.uuid() }), response: { 204: z.null() } } },
    async (request, reply) => {
      const user = currentUser(request);
      const [row] = await db.select().from(exercises).where(eq(exercises.id, request.params.id));

      if (!row) throw notFound('exercise/not-found', 'Exercice introuvable.');
      if (row.ownerId !== user.id) {
        throw forbidden('exercise/not-yours', 'Cet exercice ne t’appartient pas.');
      }

      await db.delete(exercises).where(eq(exercises.id, row.id));

      return reply.status(204).send(null);
    },
  );

  /**
   * Traduction d'un exercice de la bibliothèque. Ce texte est vu par tout le
   * monde : seul un compte autorisé peut l'écrire.
   */
  app.put(
    '/exercises/:id/translation',
    {
      schema: {
        params: z.object({ id: z.uuid() }),
        body: exerciseTranslationSchema,
        response: { 200: exerciseSchema },
      },
    },
    async (request) => {
      const user = currentUser(request);

      if (!user.canEditLibrary) {
        throw forbidden(
          'exercise/not-editor',
          'Seul un compte autorisé peut corriger la bibliothèque partagée.',
        );
      }

      const [row] = await db.select().from(exercises).where(eq(exercises.id, request.params.id));

      if (!row) throw notFound('exercise/not-found', 'Exercice introuvable.');
      if (row.source !== 'library') {
        throw forbidden(
          'exercise/not-library',
          'Cette route ne concerne que la bibliothèque partagée.',
        );
      }

      const name = request.body.name ?? row.name;

      const [updated] = await db
        .update(exercises)
        .set({
          name,
          instructions: request.body.instructions ?? row.instructions,
          searchText: buildSearchText({
            name,
            nameEn: row.nameEn,
            muscles: [...row.primaryMuscles, ...row.secondaryMuscles].map(
              (muscle) => MUSCLE_LABELS_FR[muscle as Muscle],
            ),
          }),
          updatedAt: new Date(),
        })
        .where(eq(exercises.id, row.id))
        .returning();

      if (!updated) throw notFound('exercise/not-found', 'Exercice introuvable.');

      return toExercise(updated);
    },
  );
};
