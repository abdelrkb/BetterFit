import {
  countCompletedSets,
  estimateOneRepMax,
  lastPerformancesSchema,
  progressSchema,
  workoutInputSchema,
  workoutListSchema,
  workoutResultSchema,
  workoutSchema,
  workoutVolume,
  type PersonalRecord,
  type ProgressPoint,
  type SetLog,
  type WorkoutInput,
} from '@betterfit/shared';
import { and, asc, desc, eq, inArray, lt, ne } from 'drizzle-orm';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { currentUser } from '../auth/plugin.js';
import { db } from '../db/client.js';
import { exercises, setLogs, workoutLogs, type ExerciseRow } from '../db/schema.js';
import { badRequest, notFound } from '../errors.js';
import { toExerciseSummary } from '../exercises/to-exercise.js';

/** Jour d'une date, en UTC, au format `AAAA-MM-JJ`. */
function dayOf(date: Date): string {
  return date.toISOString().slice(0, 10);
}

async function loadWorkout(userId: string, workoutId: string) {
  const [workout] = await db
    .select()
    .from(workoutLogs)
    .where(and(eq(workoutLogs.id, workoutId), eq(workoutLogs.userId, userId)));

  if (!workout) return null;

  const rows = await db
    .select({ set: setLogs, exercise: exercises })
    .from(setLogs)
    .innerJoin(exercises, eq(exercises.id, setLogs.exerciseId))
    .where(eq(setLogs.workoutLogId, workoutId))
    .orderBy(asc(setLogs.position), asc(setLogs.setIndex));

  const byExercise = new Map<string, { position: number; row: ExerciseRow; sets: SetLog[] }>();

  for (const row of rows) {
    const key = row.set.exerciseId;
    const entry = byExercise.get(key) ?? {
      position: row.set.position,
      row: row.exercise as ExerciseRow,
      sets: [],
    };

    entry.sets.push({
      setIndex: row.set.setIndex,
      weightKg: row.set.weightKg,
      reps: row.set.reps,
      rir: row.set.rir,
      done: row.set.done,
    });

    byExercise.set(key, entry);
  }

  return workoutSchema.parse({
    id: workout.id,
    programId: workout.programId,
    sessionId: workout.sessionId,
    sessionName: workout.sessionName,
    startedAt: workout.startedAt.toISOString(),
    finishedAt: workout.finishedAt.toISOString(),
    durationSeconds: workout.durationSeconds,
    totalVolumeKg: workout.totalVolumeKg,
    completedSets: workout.completedSets,
    notes: workout.notes,
    exercises: [...byExercise.entries()]
      .sort((a, b) => a[1].position - b[1].position)
      .map(([exerciseId, entry]) => ({
        exerciseId,
        position: entry.position,
        sets: entry.sets,
        exercise: toExerciseSummary(entry.row),
      })),
  });
}

/**
 * Records battus pendant cette séance.
 *
 * Les valeurs du jour viennent de ce qui est **reçu**, pas de la base : la
 * fonction est appelée avant l'écriture, pour que rejouer l'envoi d'une séance
 * ne la fasse pas se comparer à elle-même.
 */
async function findRecords(
  userId: string,
  workoutId: string,
  finishedAt: Date,
  input: WorkoutInput['exercises'],
): Promise<PersonalRecord[]> {
  const doneSets = input.map((exercise) => ({
    exerciseId: exercise.exerciseId,
    sets: exercise.sets.filter((set) => set.done && (set.weightKg ?? 0) > 0),
  }));

  const exerciseIds = doneSets.filter((item) => item.sets.length > 0).map((item) => item.exerciseId);
  if (exerciseIds.length === 0) return [];

  const named = await db
    .select({ id: exercises.id, name: exercises.name })
    .from(exercises)
    .where(inArray(exercises.id, exerciseIds));

  const previous = await db
    .select({ set: setLogs })
    .from(setLogs)
    .innerJoin(workoutLogs, eq(workoutLogs.id, setLogs.workoutLogId))
    .where(
      and(
        eq(workoutLogs.userId, userId),
        ne(workoutLogs.id, workoutId),
        lt(workoutLogs.finishedAt, finishedAt),
        eq(setLogs.done, true),
        inArray(setLogs.exerciseId, exerciseIds),
      ),
    );

  const maxWeight = (sets: { weightKg: number | null }[]) =>
    sets.reduce((max, set) => Math.max(max, set.weightKg ?? 0), 0);

  const maxOneRepMax = (sets: { weightKg: number | null; reps: number | null }[]) =>
    sets.reduce((max, set) => Math.max(max, estimateOneRepMax(set.weightKg ?? 0, set.reps ?? 0)), 0);

  const records: PersonalRecord[] = [];

  for (const exerciseId of exerciseIds) {
    const name = named.find((row) => row.id === exerciseId)?.name ?? '';
    const todaySets = doneSets.find((item) => item.exerciseId === exerciseId)?.sets ?? [];
    const earlierSets = previous
      .filter((row) => row.set.exerciseId === exerciseId)
      .map((row) => row.set);

    const weightNow = maxWeight(todaySets);
    const weightBefore = maxWeight(earlierSets);

    if (weightNow > weightBefore) {
      records.push({
        exerciseId,
        exerciseName: name,
        kind: 'weight',
        value: weightNow,
        previous: weightBefore > 0 ? weightBefore : null,
      });
    }

    const rmNow = maxOneRepMax(todaySets);
    const rmBefore = maxOneRepMax(earlierSets);

    if (rmNow > rmBefore) {
      records.push({
        exerciseId,
        exerciseName: name,
        kind: 'oneRepMax',
        value: rmNow,
        previous: rmBefore > 0 ? rmBefore : null,
      });
    }
  }

  return records;
}

export const workoutRoutes: FastifyPluginAsyncZod = async (app) => {
  app.addHook('onRequest', app.requireAuth);

  /**
   * Enregistre une séance terminée.
   *
   * Rejouable : le même identifiant écrase la séance précédente au lieu d'en
   * créer une seconde. C'est ce qui rend la file d'envoi hors ligne sûre.
   */
  app.put(
    '/workouts/:id',
    {
      schema: {
        params: z.object({ id: z.uuid() }),
        body: workoutInputSchema,
        response: { 200: workoutResultSchema },
      },
    },
    async (request) => {
      const user = currentUser(request);
      const input = request.body;

      if (input.id !== request.params.id) {
        throw badRequest('workout/id-mismatch', 'L’identifiant ne correspond pas à l’adresse.');
      }

      const exerciseIds = [...new Set(input.exercises.map((item) => item.exerciseId))];

      if (exerciseIds.length > 0) {
        const known = await db
          .select({ id: exercises.id })
          .from(exercises)
          .where(inArray(exercises.id, exerciseIds));

        if (known.length !== exerciseIds.length) {
          throw badRequest('workout/unknown-exercise', 'Un exercice de la séance est introuvable.');
        }
      }

      const startedAt = new Date(input.startedAt);
      const finishedAt = new Date(input.finishedAt);
      const durationSeconds = Math.max(
        0,
        Math.round((finishedAt.getTime() - startedAt.getTime()) / 1000),
      );

      // Les records se calculent **avant** d'écrire : sinon la séance se
      // comparerait à elle-même lors d'un renvoi.
      const records = await findRecords(user.id, input.id, finishedAt, input.exercises);

      await db.transaction(async (tx) => {
        await tx
          .insert(workoutLogs)
          .values({
            id: input.id,
            userId: user.id,
            programId: input.programId,
            sessionId: input.sessionId,
            sessionName: input.sessionName,
            startedAt,
            finishedAt,
            durationSeconds,
            totalVolumeKg: workoutVolume(input.exercises),
            completedSets: countCompletedSets(input.exercises),
            notes: input.notes,
          })
          .onConflictDoUpdate({
            target: workoutLogs.id,
            set: {
              programId: input.programId,
              sessionId: input.sessionId,
              sessionName: input.sessionName,
              startedAt,
              finishedAt,
              durationSeconds,
              totalVolumeKg: workoutVolume(input.exercises),
              completedSets: countCompletedSets(input.exercises),
              notes: input.notes,
            },
          });

        await tx.delete(setLogs).where(eq(setLogs.workoutLogId, input.id));

        const rows = input.exercises.flatMap((exercise) =>
          exercise.sets.map((set) => ({
            workoutLogId: input.id,
            exerciseId: exercise.exerciseId,
            position: exercise.position,
            setIndex: set.setIndex,
            weightKg: set.weightKg,
            reps: set.reps,
            rir: set.rir,
            done: set.done,
          })),
        );

        if (rows.length > 0) await tx.insert(setLogs).values(rows);
      });

      const saved = await loadWorkout(user.id, input.id);
      if (!saved) throw notFound('workout/not-found', 'Séance introuvable.');

      return { workout: saved, records };
    },
  );

  app.get(
    '/workouts',
    {
      schema: {
        querystring: z.object({ limit: z.coerce.number().int().min(1).max(100).default(30) }),
        response: { 200: workoutListSchema },
      },
    },
    async (request) => {
      const user = currentUser(request);

      const rows = await db
        .select()
        .from(workoutLogs)
        .where(eq(workoutLogs.userId, user.id))
        .orderBy(desc(workoutLogs.finishedAt))
        .limit(request.query.limit);

      return {
        items: rows.map((row) => ({
          id: row.id,
          programId: row.programId,
          sessionId: row.sessionId,
          sessionName: row.sessionName,
          startedAt: row.startedAt.toISOString(),
          finishedAt: row.finishedAt.toISOString(),
          durationSeconds: row.durationSeconds,
          totalVolumeKg: row.totalVolumeKg,
          completedSets: row.completedSets,
          notes: row.notes,
        })),
      };
    },
  );

  app.get(
    '/workouts/:id',
    { schema: { params: z.object({ id: z.uuid() }), response: { 200: workoutSchema } } },
    async (request) => {
      const user = currentUser(request);
      const workout = await loadWorkout(user.id, request.params.id);

      if (!workout) throw notFound('workout/not-found', 'Séance introuvable.');

      return workout;
    },
  );

  app.delete(
    '/workouts/:id',
    { schema: { params: z.object({ id: z.uuid() }), response: { 204: z.null() } } },
    async (request, reply) => {
      const user = currentUser(request);

      const [existing] = await db
        .select({ id: workoutLogs.id })
        .from(workoutLogs)
        .where(and(eq(workoutLogs.id, request.params.id), eq(workoutLogs.userId, user.id)));

      if (!existing) throw notFound('workout/not-found', 'Séance introuvable.');

      await db.delete(workoutLogs).where(eq(workoutLogs.id, existing.id));

      return reply.status(204).send(null);
    },
  );

  /**
   * Dernières valeurs saisies pour une liste d'exercices.
   *
   * C'est ce qui permet de préremplir les séries : « la dernière fois, tu as
   * fait 80 kg × 8 ».
   */
  app.get(
    '/workouts/last-performances',
    {
      schema: {
        querystring: z.object({
          /** Identifiants séparés par des virgules. */
          exerciseIds: z.string().min(1),
        }),
        response: { 200: lastPerformancesSchema },
      },
    },
    async (request) => {
      const user = currentUser(request);

      const ids = request.query.exerciseIds
        .split(',')
        .map((id) => id.trim())
        .filter((id) => z.uuid().safeParse(id).success);

      if (ids.length === 0) return { items: [] };

      const rows = await db
        .select({ set: setLogs, finishedAt: workoutLogs.finishedAt })
        .from(setLogs)
        .innerJoin(workoutLogs, eq(workoutLogs.id, setLogs.workoutLogId))
        .where(
          and(
            eq(workoutLogs.userId, user.id),
            inArray(setLogs.exerciseId, ids),
            eq(setLogs.done, true),
          ),
        )
        .orderBy(desc(workoutLogs.finishedAt), asc(setLogs.setIndex));

      return {
        items: ids.map((exerciseId) => {
          const forExercise = rows.filter((row) => row.set.exerciseId === exerciseId);
          const latest = forExercise[0]?.finishedAt ?? null;

          return {
            exerciseId,
            performedAt: latest ? latest.toISOString() : null,
            sets: forExercise
              .filter((row) => latest && row.finishedAt.getTime() === latest.getTime())
              .map((row) => ({
                setIndex: row.set.setIndex,
                weightKg: row.set.weightKg,
                reps: row.set.reps,
              })),
          };
        }),
      };
    },
  );

  /** Progression sur un exercice : charge maximale, 1RM estimé et volume. */
  app.get(
    '/exercises/:id/progress',
    { schema: { params: z.object({ id: z.uuid() }), response: { 200: progressSchema } } },
    async (request) => {
      const user = currentUser(request);
      const exerciseId = request.params.id;

      const [exercise] = await db.select().from(exercises).where(eq(exercises.id, exerciseId));

      const rows = await db
        .select({ set: setLogs, finishedAt: workoutLogs.finishedAt })
        .from(setLogs)
        .innerJoin(workoutLogs, eq(workoutLogs.id, setLogs.workoutLogId))
        .where(
          and(
            eq(workoutLogs.userId, user.id),
            eq(setLogs.exerciseId, exerciseId),
            eq(setLogs.done, true),
          ),
        )
        .orderBy(asc(workoutLogs.finishedAt));

      const byDay = new Map<string, ProgressPoint>();

      for (const row of rows) {
        const day = dayOf(row.finishedAt);
        const weight = row.set.weightKg ?? 0;
        const reps = row.set.reps ?? 0;

        const point = byDay.get(day) ?? {
          date: day,
          maxWeightKg: 0,
          estimatedOneRepMaxKg: 0,
          volumeKg: 0,
        };

        point.maxWeightKg = Math.max(point.maxWeightKg, weight);
        point.estimatedOneRepMaxKg = Math.max(
          point.estimatedOneRepMaxKg,
          estimateOneRepMax(weight, reps),
        );
        point.volumeKg = Math.round((point.volumeKg + weight * reps) * 10) / 10;

        byDay.set(day, point);
      }

      const points = [...byDay.values()].sort((a, b) => a.date.localeCompare(b.date));

      return {
        exercise: exercise ? toExerciseSummary(exercise) : null,
        points,
        bestWeightKg: points.length
          ? Math.max(...points.map((point) => point.maxWeightKg))
          : null,
        bestOneRepMaxKg: points.length
          ? Math.max(...points.map((point) => point.estimatedOneRepMaxKg))
          : null,
      };
    },
  );
};
