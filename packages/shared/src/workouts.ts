import { z } from 'zod';
import { exerciseSummarySchema } from './exercises.js';

/**
 * Les séances réalisées.
 *
 * Une séance est **créée sur l'appareil**, avec son identifiant : c'est ce qui
 * permet de s'entraîner hors ligne puis d'envoyer le tout au retour du réseau,
 * sans risquer de créer deux fois la même séance si l'envoi est rejoué.
 */

export const setLogSchema = z.object({
  /** Numéro de la série dans l'exercice, à partir de 1. */
  setIndex: z.number().int().min(1).max(50),
  weightKg: z.number().min(0).max(1000).nullable(),
  reps: z.number().int().min(0).max(500).nullable(),
  /** Répétitions en réserve. Facultatif. */
  rir: z.number().int().min(0).max(10).nullable(),
  done: z.boolean(),
});
export type SetLog = z.infer<typeof setLogSchema>;

export const workoutExerciseSchema = z.object({
  exerciseId: z.uuid(),
  position: z.number().int().min(0).max(100),
  sets: z.array(setLogSchema).max(50),
});
export type WorkoutExerciseInput = z.infer<typeof workoutExerciseSchema>;

export const workoutExerciseOutSchema = workoutExerciseSchema.extend({
  exercise: exerciseSummarySchema.nullable(),
});
export type WorkoutExercise = z.infer<typeof workoutExerciseOutSchema>;

export const workoutInputSchema = z.object({
  /** Fabriqué sur l'appareil : rend l'envoi rejouable sans doublon. */
  id: z.uuid(),
  programId: z.uuid().nullable(),
  /** Séance du programme d'où vient l'entraînement, si elle existe encore. */
  sessionId: z.uuid().nullable(),
  /** Nom figé au moment de la séance : il survit à la suppression du programme. */
  sessionName: z.string().trim().max(80).default(''),
  startedAt: z.iso.datetime(),
  finishedAt: z.iso.datetime(),
  notes: z.string().trim().max(1000).default(''),
  exercises: z.array(workoutExerciseSchema).max(40),
});
export type WorkoutInput = z.infer<typeof workoutInputSchema>;

export const workoutSchema = z.object({
  id: z.uuid(),
  programId: z.uuid().nullable(),
  sessionId: z.uuid().nullable(),
  sessionName: z.string(),
  startedAt: z.string(),
  finishedAt: z.string(),
  durationSeconds: z.number().int().min(0),
  /** Somme des poids × répétitions des séries validées, en kilogrammes. */
  totalVolumeKg: z.number().min(0),
  /** Nombre de séries validées. */
  completedSets: z.number().int().min(0),
  notes: z.string(),
  exercises: z.array(workoutExerciseOutSchema),
});
export type Workout = z.infer<typeof workoutSchema>;

export const workoutSummarySchema = workoutSchema.omit({ exercises: true });
export type WorkoutSummary = z.infer<typeof workoutSummarySchema>;

export const workoutListSchema = z.object({
  items: z.array(workoutSummarySchema),
});
export type WorkoutList = z.infer<typeof workoutListSchema>;

/** Dernières valeurs saisies pour un exercice, pour préremplir les séries. */
export const lastPerformanceSchema = z.object({
  exerciseId: z.uuid(),
  /** `null` si l'exercice n'a jamais été fait. */
  performedAt: z.string().nullable(),
  sets: z.array(
    z.object({
      setIndex: z.number().int(),
      weightKg: z.number().nullable(),
      reps: z.number().int().nullable(),
    }),
  ),
});
export type LastPerformance = z.infer<typeof lastPerformanceSchema>;

export const lastPerformancesSchema = z.object({
  items: z.array(lastPerformanceSchema),
});

/** Un point de la courbe de progression d'un exercice. */
export const progressPointSchema = z.object({
  date: z.string(),
  /** Charge la plus lourde de la séance, en kilogrammes. */
  maxWeightKg: z.number(),
  /** Meilleur 1RM estimé de la séance. */
  estimatedOneRepMaxKg: z.number(),
  /** Volume de l'exercice sur la séance. */
  volumeKg: z.number(),
});
export type ProgressPoint = z.infer<typeof progressPointSchema>;

export const progressSchema = z.object({
  exercise: exerciseSummarySchema.nullable(),
  points: z.array(progressPointSchema),
  /** Record de charge, toutes séances confondues. */
  bestWeightKg: z.number().nullable(),
  bestOneRepMaxKg: z.number().nullable(),
});
export type Progress = z.infer<typeof progressSchema>;

/**
 * 1RM estimé par la formule d'Epley : `charge × (1 + répétitions / 30)`.
 *
 * Elle devient fausse au-delà d'une dizaine de répétitions, où elle
 * surestime ; on la borne donc à 12, comme le fait le prototype.
 */
export const ONE_REP_MAX_REP_LIMIT = 12;

export function estimateOneRepMax(weightKg: number, reps: number): number {
  if (weightKg <= 0 || reps <= 0) return 0;
  if (reps === 1) return weightKg;

  const usable = Math.min(reps, ONE_REP_MAX_REP_LIMIT);

  return round(weightKg * (1 + usable / 30));
}

/** Volume d'une série : charge × répétitions. Une série non validée ne compte pas. */
export function setVolume(set: Pick<SetLog, 'weightKg' | 'reps' | 'done'>): number {
  if (!set.done || set.weightKg === null || set.reps === null) return 0;

  return round(set.weightKg * set.reps);
}

/** Volume total d'une séance. */
export function workoutVolume(exercises: { sets: SetLog[] }[]): number {
  return round(
    exercises.reduce(
      (total, exercise) => total + exercise.sets.reduce((sum, set) => sum + setVolume(set), 0),
      0,
    ),
  );
}

export function countCompletedSets(exercises: { sets: SetLog[] }[]): number {
  return exercises.reduce(
    (total, exercise) => total + exercise.sets.filter((set) => set.done).length,
    0,
  );
}

/** Arrondi au dixième : on ne prétend pas à plus de précision qu'une barre. */
function round(value: number): number {
  return Math.round(value * 10) / 10;
}

/** Un record battu, annoncé en fin de séance. */
export const personalRecordSchema = z.object({
  exerciseId: z.uuid(),
  exerciseName: z.string(),
  kind: z.enum(['weight', 'oneRepMax', 'volume']),
  value: z.number(),
  previous: z.number().nullable(),
});
export type PersonalRecord = z.infer<typeof personalRecordSchema>;

export const workoutResultSchema = z.object({
  workout: workoutSchema,
  records: z.array(personalRecordSchema),
});
export type WorkoutResult = z.infer<typeof workoutResultSchema>;
