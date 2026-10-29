import { z } from 'zod';
import { booleanQueryParam } from './constants.js';

/**
 * La bibliothèque d'exercices.
 *
 * Les valeurs viennent de free-exercise-db (873 exercices, licence Unlicense).
 * Elles sont figées : ce sont des listes fermées, pas du texte libre, ce qui
 * permet de filtrer et de traduire proprement.
 */

export const muscleSchema = z.enum([
  'abdominals',
  'abductors',
  'adductors',
  'biceps',
  'calves',
  'chest',
  'forearms',
  'glutes',
  'hamstrings',
  'lats',
  'lower back',
  'middle back',
  'neck',
  'quadriceps',
  'shoulders',
  'traps',
  'triceps',
]);
export type Muscle = z.infer<typeof muscleSchema>;

export const MUSCLE_LABELS_FR: Record<Muscle, string> = {
  abdominals: 'Abdominaux',
  abductors: 'Abducteurs',
  adductors: 'Adducteurs',
  biceps: 'Biceps',
  calves: 'Mollets',
  chest: 'Pectoraux',
  forearms: 'Avant-bras',
  glutes: 'Fessiers',
  hamstrings: 'Ischio-jambiers',
  lats: 'Grands dorsaux',
  'lower back': 'Bas du dos',
  'middle back': 'Milieu du dos',
  neck: 'Cou',
  quadriceps: 'Quadriceps',
  shoulders: 'Épaules',
  traps: 'Trapèzes',
  triceps: 'Triceps',
};

/**
 * Regroupement par grande zone, pour les filtres : « Dos » est plus parlant
 * que « grands dorsaux, milieu du dos, bas du dos, trapèzes ».
 */
export const muscleGroupSchema = z.enum([
  'chest',
  'back',
  'shoulders',
  'arms',
  'legs',
  'glutes',
  'core',
  'other',
]);
export type MuscleGroup = z.infer<typeof muscleGroupSchema>;

export const MUSCLE_GROUP_LABELS_FR: Record<MuscleGroup, string> = {
  chest: 'Pectoraux',
  back: 'Dos',
  shoulders: 'Épaules',
  arms: 'Bras',
  legs: 'Jambes',
  glutes: 'Fessiers',
  core: 'Abdos et gainage',
  other: 'Autre',
};

export const MUSCLE_TO_GROUP: Record<Muscle, MuscleGroup> = {
  chest: 'chest',
  lats: 'back',
  'middle back': 'back',
  'lower back': 'back',
  traps: 'back',
  shoulders: 'shoulders',
  biceps: 'arms',
  triceps: 'arms',
  forearms: 'arms',
  quadriceps: 'legs',
  hamstrings: 'legs',
  calves: 'legs',
  adductors: 'legs',
  abductors: 'legs',
  glutes: 'glutes',
  abdominals: 'core',
  neck: 'other',
};

export const equipmentSchema = z.enum([
  'barbell',
  'dumbbell',
  'kettlebells',
  'cable',
  'machine',
  'body only',
  'bands',
  'medicine ball',
  'exercise ball',
  'foam roll',
  'e-z curl bar',
  'other',
]);
export type Equipment = z.infer<typeof equipmentSchema>;

export const EQUIPMENT_LABELS_FR: Record<Equipment, string> = {
  barbell: 'Barre',
  dumbbell: 'Haltères',
  kettlebells: 'Kettlebell',
  cable: 'Poulie',
  machine: 'Machine',
  'body only': 'Poids du corps',
  bands: 'Élastique',
  'medicine ball': 'Médecine-ball',
  'exercise ball': 'Swiss ball',
  'foam roll': 'Rouleau de massage',
  'e-z curl bar': 'Barre EZ',
  other: 'Autre',
};

export const levelSchema = z.enum(['beginner', 'intermediate', 'expert']);
export type Level = z.infer<typeof levelSchema>;

export const LEVEL_LABELS_FR: Record<Level, string> = {
  beginner: 'Débutant',
  intermediate: 'Intermédiaire',
  expert: 'Confirmé',
};

export const categorySchema = z.enum([
  'strength',
  'stretching',
  'plyometrics',
  'powerlifting',
  'olympic weightlifting',
  'strongman',
  'cardio',
]);
export type Category = z.infer<typeof categorySchema>;

export const CATEGORY_LABELS_FR: Record<Category, string> = {
  strength: 'Musculation',
  stretching: 'Étirement',
  plyometrics: 'Pliométrie',
  powerlifting: 'Force athlétique',
  'olympic weightlifting': 'Haltérophilie',
  strongman: 'Strongman',
  cardio: 'Cardio',
};

export const forceSchema = z.enum(['push', 'pull', 'static']);
export type Force = z.infer<typeof forceSchema>;

export const FORCE_LABELS_FR: Record<Force, string> = {
  push: 'Poussée',
  pull: 'Tirage',
  static: 'Statique',
};

export const mechanicSchema = z.enum(['compound', 'isolation']);
export type Mechanic = z.infer<typeof mechanicSchema>;

export const MECHANIC_LABELS_FR: Record<Mechanic, string> = {
  compound: 'Polyarticulaire',
  isolation: 'Isolation',
};

/** `library` : les 873 exercices importés. `custom` : créés dans l'app. */
export const exerciseSourceSchema = z.enum(['library', 'custom']);
export type ExerciseSource = z.infer<typeof exerciseSourceSchema>;

export const exerciseSchema = z.object({
  id: z.uuid(),
  source: exerciseSourceSchema,
  /** `null` pour la bibliothèque partagée. */
  ownerId: z.uuid().nullable(),
  name: z.string(),
  /** Nom d'origine, gardé pour la recherche : beaucoup de coachs cherchent en anglais. */
  nameEn: z.string().nullable(),
  primaryMuscles: z.array(muscleSchema),
  secondaryMuscles: z.array(muscleSchema),
  equipment: equipmentSchema,
  level: levelSchema,
  category: categorySchema,
  force: forceSchema.nullable(),
  mechanic: mechanicSchema.nullable(),
  /** Consignes en français : ce que l'app affiche quand elles existent. */
  instructions: z.array(z.string()),
  /** Consignes d'origine en anglais, affichées tant que la traduction manque. */
  instructionsEn: z.array(z.string()),
  /** Adresses des photos (début et fin du mouvement). */
  images: z.array(z.string()),
  /** Pose de la mascotte, utilisée quand il n'y a pas de photo. */
  mascotPose: z.string().nullable(),
  /** Vrai quand les consignes françaises ont été écrites. */
  translated: z.boolean(),
});
export type Exercise = z.infer<typeof exerciseSchema>;

/** Version allégée pour les listes : pas les consignes. */
export const exerciseSummarySchema = exerciseSchema.omit({
  instructions: true,
  instructionsEn: true,
});
export type ExerciseSummary = z.infer<typeof exerciseSummarySchema>;

export const EXERCISE_PAGE_SIZE = 30;

export const exerciseSearchSchema = z.object({
  /** Recherche par nom, insensible aux accents et à la casse. */
  q: z.string().trim().max(100).optional(),
  muscleGroup: muscleGroupSchema.optional(),
  equipment: equipmentSchema.optional(),
  level: levelSchema.optional(),
  category: categorySchema.optional(),
  /** `true` pour ne voir que ses propres exercices. */
  mine: booleanQueryParam().optional(),
  page: z.coerce.number().int().min(1).default(1),
});
export type ExerciseSearch = z.infer<typeof exerciseSearchSchema>;

export const exerciseListSchema = z.object({
  items: z.array(exerciseSummarySchema),
  total: z.number().int().min(0),
  page: z.number().int().min(1),
  pageSize: z.number().int().min(1),
});
export type ExerciseList = z.infer<typeof exerciseListSchema>;

/** Création ou modification d'un exercice personnel. */
export const customExerciseSchema = z.object({
  name: z.string().trim().min(2).max(120),
  primaryMuscles: z.array(muscleSchema).min(1, 'Choisis au moins un muscle.').max(4),
  secondaryMuscles: z.array(muscleSchema).max(6).default([]),
  equipment: equipmentSchema,
  level: levelSchema,
  category: categorySchema.default('strength'),
  instructions: z.array(z.string().trim().min(1).max(600)).max(15).default([]),
  /** Pose de la mascotte choisie dans la liste, puisqu'il n'y a pas de photo. */
  mascotPose: z.string().max(40).nullable().default(null),
});
export type CustomExerciseInput = z.infer<typeof customExerciseSchema>;

export const customExerciseUpdateSchema = customExerciseSchema.partial();
export type CustomExerciseUpdate = z.infer<typeof customExerciseUpdateSchema>;

/**
 * Traduction d'un exercice de la bibliothèque, écrite dans l'app.
 *
 * Réservée aux comptes qui ont le droit d'éditer la bibliothèque : elle est
 * partagée par tout le monde.
 */
export const exerciseTranslationSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  instructions: z.array(z.string().trim().min(1).max(600)).max(20).optional(),
});
export type ExerciseTranslationInput = z.infer<typeof exerciseTranslationSchema>;

/** Les filtres proposés dans l'app, dans l'ordre d'affichage. */
export const MUSCLE_GROUP_ORDER: MuscleGroup[] = [
  'chest',
  'back',
  'shoulders',
  'arms',
  'legs',
  'glutes',
  'core',
  'other',
];

/** Les muscles d'un groupe, pour traduire un filtre en condition de recherche. */
export function musclesOfGroup(group: MuscleGroup): Muscle[] {
  return (Object.keys(MUSCLE_TO_GROUP) as Muscle[]).filter(
    (muscle) => MUSCLE_TO_GROUP[muscle] === group,
  );
}
