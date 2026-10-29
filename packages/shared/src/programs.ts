import { z } from 'zod';
import { exerciseSummarySchema, levelSchema, muscleSchema } from './exercises.js';

/**
 * Les programmes.
 *
 * Un programme est enregistré **d'un bloc** : infos, séances, exercices et
 * planning partent dans la même requête. L'éditeur manipule un document
 * entier (comme le prototype), et ça évite de gérer vingt routes et autant
 * d'états intermédiaires pour une liste d'exercices qu'on réordonne.
 */

export const programKindSchema = z.enum(['training', 'nutrition']);
export type ProgramKind = z.infer<typeof programKindSchema>;

export const placeSchema = z.enum(['gym', 'home', 'outdoor', 'mixed']);
export type Place = z.infer<typeof placeSchema>;

export const PLACE_LABELS_FR: Record<Place, string> = {
  gym: 'En salle',
  home: 'À la maison',
  outdoor: 'En extérieur',
  mixed: 'Un peu partout',
};

export const trainingGoalSchema = z.enum([
  'lose_fat',
  'gain_muscle',
  'strength',
  'endurance',
  'general',
]);
export type TrainingGoal = z.infer<typeof trainingGoalSchema>;

export const TRAINING_GOAL_LABELS_FR: Record<TrainingGoal, string> = {
  lose_fat: 'Perdre du gras',
  gain_muscle: 'Prendre du muscle',
  strength: 'Gagner en force',
  endurance: 'Gagner en endurance',
  general: 'Rester en forme',
};

/** Lundi = 1, dimanche = 7, comme la norme ISO. */
export const WEEK_DAYS = [1, 2, 3, 4, 5, 6, 7] as const;
export type WeekDay = (typeof WEEK_DAYS)[number];

export const WEEK_DAY_LABELS_FR: Record<WeekDay, string> = {
  1: 'Lundi',
  2: 'Mardi',
  3: 'Mercredi',
  4: 'Jeudi',
  5: 'Vendredi',
  6: 'Samedi',
  7: 'Dimanche',
};

export const WEEK_DAY_SHORT_FR: Record<WeekDay, string> = {
  1: 'Lun',
  2: 'Mar',
  3: 'Mer',
  4: 'Jeu',
  5: 'Ven',
  6: 'Sam',
  7: 'Dim',
};

/** Un exercice posé dans une séance, avec ses consignes de travail. */
export const trainingSessionExerciseSchema = z.object({
  /** Absent tant que la ligne n'a pas été enregistrée. */
  id: z.uuid().optional(),
  exerciseId: z.uuid(),
  sets: z.number().int().min(1).max(20),
  /** Texte libre : « 8-10 », « 10 / jambe », « 40 s ». */
  reps: z.string().trim().max(40).default(''),
  /** Charge conseillée, en texte : « 40 kg », « élastique rouge », « RPE 8 ». */
  load: z.string().trim().max(60).default(''),
  restSeconds: z.number().int().min(0).max(900).default(90),
  /** Tempo, par exemple « 3-0-1-0 ». */
  tempo: z.string().trim().max(20).default(''),
  notes: z.string().trim().max(400).default(''),
});
export type TrainingSessionExerciseInput = z.infer<typeof trainingSessionExerciseSchema>;

/** Ce que l'API renvoie : la ligne, plus l'exercice pour l'afficher. */
export const trainingSessionExerciseOutSchema = trainingSessionExerciseSchema.extend({
  id: z.uuid(),
  exercise: exerciseSummarySchema.nullable(),
});
export type TrainingSessionExercise = z.infer<typeof trainingSessionExerciseOutSchema>;

export const trainingSessionSchema = z.object({
  id: z.uuid().optional(),
  /** « A », « B », « C »… attribué automatiquement selon la position. */
  label: z.string().trim().max(4).default(''),
  name: z.string().trim().min(1, 'Donne un nom à la séance.').max(80),
  targetMuscles: z.array(muscleSchema).max(8).default([]),
  durationMinutes: z.number().int().min(5).max(240).default(60),
  warmup: z.string().trim().max(600).default(''),
  cooldown: z.string().trim().max(600).default(''),
  exercises: z.array(trainingSessionExerciseSchema).max(40).default([]),
});
export type TrainingSessionInput = z.infer<typeof trainingSessionSchema>;

export const trainingSessionOutSchema = trainingSessionSchema.extend({
  id: z.uuid(),
  exercises: z.array(trainingSessionExerciseOutSchema),
});
export type TrainingSession = z.infer<typeof trainingSessionOutSchema>;

export const trainingDetailsSchema = z.object({
  goal: trainingGoalSchema.default('general'),
  level: levelSchema.default('beginner'),
  place: placeSchema.default('gym'),
  /** Durée visée d'une séance, en minutes. */
  sessionMinutes: z.number().int().min(10).max(240).default(60),
  /** Durée du cycle, en semaines. */
  weeks: z.number().int().min(1).max(52).default(8),
  coachNote: z.string().trim().max(2000).default(''),
});
export type TrainingDetails = z.infer<typeof trainingDetailsSchema>;

/**
 * Le planning : pour chaque jour, l'indice de la séance dans la liste, ou
 * `null` pour un jour de repos.
 *
 * On range un **indice** et non un identifiant : l'éditeur crée des séances qui
 * n'ont pas encore d'identifiant, et le planning doit pouvoir les désigner.
 */
export const scheduleSchema = z
  .array(z.number().int().min(0).nullable())
  .length(7, 'Le planning couvre les sept jours de la semaine.');
export type Schedule = z.infer<typeof scheduleSchema>;

export const programInputSchema = z.object({
  title: z.string().trim().min(1, 'Donne un titre au programme.').max(120),
  isTemplate: z.boolean().default(false),
  details: trainingDetailsSchema,
  sessions: z.array(trainingSessionSchema).min(1, 'Ajoute au moins une séance.').max(14),
  schedule: scheduleSchema,
});
export type ProgramInput = z.infer<typeof programInputSchema>;

export const programSchema = z.object({
  id: z.uuid(),
  ownerId: z.uuid(),
  kind: programKindSchema,
  title: z.string(),
  isTemplate: z.boolean(),
  /** Renseigné quand le programme est une copie assignée à un client (étape 6). */
  sourceProgramId: z.uuid().nullable(),
  assignedToUserId: z.uuid().nullable(),
  details: trainingDetailsSchema,
  sessions: z.array(trainingSessionOutSchema),
  schedule: scheduleSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Program = z.infer<typeof programSchema>;

/** Version courte pour la liste. */
export const programSummarySchema = z.object({
  id: z.uuid(),
  kind: programKindSchema,
  title: z.string(),
  isTemplate: z.boolean(),
  assignedToUserId: z.uuid().nullable(),
  sessionCount: z.number().int().min(0),
  /** Nombre de jours d'entraînement dans la semaine. */
  trainingDays: z.number().int().min(0).max(7),
  goal: trainingGoalSchema,
  level: levelSchema,
  updatedAt: z.string(),
});
export type ProgramSummary = z.infer<typeof programSummarySchema>;

export const programListSchema = z.object({
  items: z.array(programSummarySchema),
});
export type ProgramList = z.infer<typeof programListSchema>;

/** Étiquette d'une séance d'après sa position : A, B, C… */
export function trainingSessionLabel(index: number): string {
  return String.fromCharCode('A'.charCodeAt(0) + (index % 26));
}

/** Nombre de jours où une séance est prévue. */
export function countTrainingDays(schedule: Schedule): number {
  return schedule.filter((day) => day !== null).length;
}

/** Un planning vide : sept jours de repos. */
export function emptySchedule(): Schedule {
  return [null, null, null, null, null, null, null];
}
