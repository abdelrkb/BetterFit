import {
  booleanQueryParam,
  programInputSchema,
  programListSchema,
  programSchema,
  trainingSessionLabel,
  type Program,
  type ProgramInput,
  type Schedule,
} from '@betterfit/shared';
import { and, asc, desc, eq, inArray, or } from 'drizzle-orm';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { currentUser } from '../auth/plugin.js';
import { db } from '../db/client.js';
import {
  exercises,
  programs,
  sessionExercises,
  sessions,
  trainingDetails,
  weeklySchedule,
  type ExerciseRow,
} from '../db/schema.js';
import { badRequest, notFound } from '../errors.js';
import { toExerciseSummary } from '../exercises/to-exercise.js';

/**
 * Un programme est lu et écrit **d'un bloc**.
 *
 * L'éditeur manipule un document entier : on remplace séances, exercices et
 * planning à chaque enregistrement, dans une transaction. C'est beaucoup plus
 * simple que vingt routes de détail, et ça convient tant qu'une seule personne
 * édite un programme à la fois — ce qui est le cas : un programme a un
 * propriétaire unique.
 */

export async function loadProgram(programId: string): Promise<Program | null> {
  const [program] = await db.select().from(programs).where(eq(programs.id, programId));
  // Un programme de nutrition se lit par ses propres routes : le renvoyer ici
  // le ferait apparaître sans séances dans l'onglet Entraînement.
  if (!program || program.kind !== 'training') return null;

  const [details] = await db
    .select()
    .from(trainingDetails)
    .where(eq(trainingDetails.programId, programId));

  const sessionRows = await db
    .select()
    .from(sessions)
    .where(eq(sessions.programId, programId))
    .orderBy(asc(sessions.position));

  const sessionIds = sessionRows.map((row) => row.id);

  const exerciseRows = sessionIds.length
    ? await db
        .select({ line: sessionExercises, exercise: exercises })
        .from(sessionExercises)
        .innerJoin(exercises, eq(exercises.id, sessionExercises.exerciseId))
        .where(inArray(sessionExercises.sessionId, sessionIds))
        .orderBy(asc(sessionExercises.position))
    : [];

  const scheduleRows = await db
    .select()
    .from(weeklySchedule)
    .where(eq(weeklySchedule.programId, programId));

  // Le planning est renvoyé en indices de séances : c'est ce que l'éditeur
  // manipule, et ça reste juste même pour des séances qu'il vient de créer.
  const indexOfSession = new Map(sessionRows.map((row, index) => [row.id, index]));
  const schedule: Schedule = [null, null, null, null, null, null, null];

  for (const row of scheduleRows) {
    const day = row.dayOfWeek - 1;
    if (day < 0 || day > 6) continue;
    schedule[day] = row.sessionId ? (indexOfSession.get(row.sessionId) ?? null) : null;
  }

  return programSchema.parse({
    id: program.id,
    ownerId: program.ownerId,
    kind: program.kind,
    title: program.title,
    isTemplate: program.isTemplate,
    sourceProgramId: program.sourceProgramId,
    assignedToUserId: program.assignedToUserId,
    details: {
      goal: details?.goal ?? 'general',
      level: details?.level ?? 'beginner',
      place: details?.place ?? 'gym',
      sessionMinutes: details?.sessionMinutes ?? 60,
      weeks: details?.weeks ?? 8,
      coachNote: details?.coachNote ?? '',
    },
    sessions: sessionRows.map((session, index) => ({
      id: session.id,
      label: trainingSessionLabel(index),
      name: session.name,
      targetMuscles: session.targetMuscles,
      durationMinutes: session.durationMinutes,
      warmup: session.warmup,
      cooldown: session.cooldown,
      exercises: exerciseRows
        .filter((row) => row.line.sessionId === session.id)
        .map((row) => ({
          id: row.line.id,
          exerciseId: row.line.exerciseId,
          sets: row.line.sets,
          reps: row.line.reps,
          load: row.line.load,
          restSeconds: row.line.restSeconds,
          tempo: row.line.tempo,
          notes: row.line.notes,
          exercise: toExerciseSummary(row.exercise as ExerciseRow),
        })),
    })),
    schedule,
    createdAt: program.createdAt.toISOString(),
    updatedAt: program.updatedAt.toISOString(),
  });
}

/**
 * Écrit séances, exercices et planning. Tout est remplacé : c'est ce qui rend
 * l'opération idempotente, et qui évite d'avoir à deviner ce qui a changé.
 */
export async function writeContents(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  programId: string,
  input: ProgramInput,
): Promise<void> {
  await tx
    .insert(trainingDetails)
    .values({ programId, ...input.details })
    .onConflictDoUpdate({ target: trainingDetails.programId, set: input.details });

  // Supprimer les séances emporte leurs exercices et leur planning (cascade).
  await tx.delete(sessions).where(eq(sessions.programId, programId));
  await tx.delete(weeklySchedule).where(eq(weeklySchedule.programId, programId));

  const createdIds: string[] = [];

  for (const [index, session] of input.sessions.entries()) {
    const [row] = await tx
      .insert(sessions)
      .values({
        programId,
        position: index,
        name: session.name,
        targetMuscles: session.targetMuscles,
        durationMinutes: session.durationMinutes,
        warmup: session.warmup,
        cooldown: session.cooldown,
      })
      .returning({ id: sessions.id });

    if (!row) throw badRequest('program/save-failed', 'Enregistrement de la séance impossible.');
    createdIds.push(row.id);

    if (session.exercises.length > 0) {
      await tx.insert(sessionExercises).values(
        session.exercises.map((line, position) => ({
          sessionId: row.id,
          exerciseId: line.exerciseId,
          position,
          sets: line.sets,
          reps: line.reps,
          load: line.load,
          restSeconds: line.restSeconds,
          tempo: line.tempo,
          notes: line.notes,
        })),
      );
    }
  }

  await tx.insert(weeklySchedule).values(
    input.schedule.map((sessionIndex, day) => ({
      programId,
      dayOfWeek: day + 1,
      sessionId: sessionIndex === null ? null : (createdIds[sessionIndex] ?? null),
    })),
  );
}

/** Vérifie que tous les exercices cités existent et sont visibles par l'auteur. */
export async function assertExercisesVisible(userId: string, input: ProgramInput): Promise<void> {
  const ids = [
    ...new Set(
      input.sessions.flatMap((session) => session.exercises.map((line) => line.exerciseId)),
    ),
  ];

  if (ids.length === 0) return;

  const rows = await db
    .select({ id: exercises.id })
    .from(exercises)
    .where(
      and(
        inArray(exercises.id, ids),
        // La bibliothèque partagée, ou ses propres exercices : on ne glisse
        // pas l'exercice personnel de quelqu'un d'autre dans un programme.
        or(eq(exercises.source, 'library'), eq(exercises.ownerId, userId)),
      ),
    );

  if (rows.length !== ids.length) {
    throw badRequest('program/unknown-exercise', 'Un exercice du programme est introuvable.');
  }
}

export const programRoutes: FastifyPluginAsyncZod = async (app) => {
  app.addHook('onRequest', app.requireAuth);

  app.get(
    '/programs',
    {
      schema: {
        querystring: z.object({
          kind: z.enum(['training', 'nutrition']).optional(),
          templates: booleanQueryParam().optional(),
        }),
        response: { 200: programListSchema },
      },
    },
    async (request) => {
      const user = currentUser(request);
      const { kind, templates } = request.query;

      const rows = await db
        .select({ program: programs, details: trainingDetails })
        .from(programs)
        .leftJoin(trainingDetails, eq(trainingDetails.programId, programs.id))
        .where(
          and(
            // Ses propres programmes, et ceux qu'un coach lui a assignés.
            or(eq(programs.ownerId, user.id), eq(programs.assignedToUserId, user.id)),
            // Par défaut, la musculation : c'est cette route qui la sert.
            eq(programs.kind, kind ?? 'training'),
            templates === undefined ? undefined : eq(programs.isTemplate, templates),
          ),
        )
        .orderBy(desc(programs.updatedAt));

      const ids = rows.map((row) => row.program.id);

      const sessionRows = ids.length
        ? await db
            .select({ programId: sessions.programId, id: sessions.id })
            .from(sessions)
            .where(inArray(sessions.programId, ids))
        : [];

      const scheduleRows = ids.length
        ? await db
            .select({ programId: weeklySchedule.programId, sessionId: weeklySchedule.sessionId })
            .from(weeklySchedule)
            .where(inArray(weeklySchedule.programId, ids))
        : [];

      return {
        items: rows.map(({ program, details }) => ({
          id: program.id,
          kind: program.kind,
          title: program.title,
          isTemplate: program.isTemplate,
          assignedToUserId: program.assignedToUserId,
          sessionCount: sessionRows.filter((row) => row.programId === program.id).length,
          trainingDays: scheduleRows.filter(
            (row) => row.programId === program.id && row.sessionId !== null,
          ).length,
          goal: details?.goal ?? 'general',
          level: details?.level ?? 'beginner',
          updatedAt: program.updatedAt.toISOString(),
        })),
      };
    },
  );

  app.post(
    '/programs',
    { schema: { body: programInputSchema, response: { 201: programSchema } } },
    async (request, reply) => {
      const user = currentUser(request);
      const input = request.body;

      await assertExercisesVisible(user.id, input);

      const programId = await db.transaction(async (tx) => {
        const [program] = await tx
          .insert(programs)
          .values({
            ownerId: user.id,
            kind: 'training',
            title: input.title,
            isTemplate: input.isTemplate,
          })
          .returning({ id: programs.id });

        if (!program) throw badRequest('program/save-failed', 'Création impossible.');

        await writeContents(tx, program.id, input);

        return program.id;
      });

      const saved = await loadProgram(programId);
      if (!saved) throw notFound('program/not-found', 'Programme introuvable.');

      return reply.status(201).send(saved);
    },
  );

  app.get(
    '/programs/:id',
    { schema: { params: z.object({ id: z.uuid() }), response: { 200: programSchema } } },
    async (request) => {
      const user = currentUser(request);
      const program = await loadProgram(request.params.id);

      // Le propriétaire, et le client à qui il est assigné, peuvent le lire.
      // Introuvable plutôt qu'interdit : on ne révèle pas l'existence du
      // programme de quelqu'un d'autre.
      if (!program || (program.ownerId !== user.id && program.assignedToUserId !== user.id)) {
        throw notFound('program/not-found', 'Programme introuvable.');
      }

      return program;
    },
  );

  app.put(
    '/programs/:id',
    {
      schema: {
        params: z.object({ id: z.uuid() }),
        body: programInputSchema,
        response: { 200: programSchema },
      },
    },
    async (request) => {
      const user = currentUser(request);
      const input = request.body;

      const [existing] = await db.select().from(programs).where(eq(programs.id, request.params.id));
      if (!existing || existing.ownerId !== user.id) {
        throw notFound('program/not-found', 'Programme introuvable.');
      }

      await assertExercisesVisible(user.id, input);

      await db.transaction(async (tx) => {
        await tx
          .update(programs)
          .set({ title: input.title, isTemplate: input.isTemplate, updatedAt: new Date() })
          .where(eq(programs.id, existing.id));

        await writeContents(tx, existing.id, input);
      });

      const saved = await loadProgram(existing.id);
      if (!saved) throw notFound('program/not-found', 'Programme introuvable.');

      return saved;
    },
  );

  app.delete(
    '/programs/:id',
    { schema: { params: z.object({ id: z.uuid() }), response: { 204: z.null() } } },
    async (request, reply) => {
      const user = currentUser(request);

      const [existing] = await db.select().from(programs).where(eq(programs.id, request.params.id));
      if (!existing || existing.ownerId !== user.id) {
        throw notFound('program/not-found', 'Programme introuvable.');
      }

      await db.delete(programs).where(eq(programs.id, existing.id));

      return reply.status(204).send(null);
    },
  );

  /** Duplique un programme : sert à partir d'un modèle, et à l'assignation (étape 6). */
  app.post(
    '/programs/:id/duplicate',
    {
      schema: {
        params: z.object({ id: z.uuid() }),
        body: z.object({ title: z.string().trim().min(1).max(120).optional() }).nullish(),
        response: { 201: programSchema },
      },
    },
    async (request, reply) => {
      const user = currentUser(request);
      const source = await loadProgram(request.params.id);

      if (!source || source.ownerId !== user.id) {
        throw notFound('program/not-found', 'Programme introuvable.');
      }

      const input: ProgramInput = {
        title: request.body?.title ?? `${source.title} (copie)`,
        isTemplate: false,
        details: source.details,
        sessions: source.sessions.map((session) => ({
          label: session.label,
          name: session.name,
          targetMuscles: session.targetMuscles,
          durationMinutes: session.durationMinutes,
          warmup: session.warmup,
          cooldown: session.cooldown,
          exercises: session.exercises.map((line) => ({
            exerciseId: line.exerciseId,
            sets: line.sets,
            reps: line.reps,
            load: line.load,
            restSeconds: line.restSeconds,
            tempo: line.tempo,
            notes: line.notes,
          })),
        })),
        schedule: source.schedule,
      };

      const programId = await db.transaction(async (tx) => {
        const [program] = await tx
          .insert(programs)
          .values({
            ownerId: user.id,
            kind: 'training',
            title: input.title,
            isTemplate: false,
            sourceProgramId: source.id,
          })
          .returning({ id: programs.id });

        if (!program) throw badRequest('program/save-failed', 'Copie impossible.');

        await writeContents(tx, program.id, input);

        return program.id;
      });

      const saved = await loadProgram(programId);
      if (!saved) throw notFound('program/not-found', 'Programme introuvable.');

      return reply.status(201).send(saved);
    },
  );
};
