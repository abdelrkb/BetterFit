import { exerciseSchema, exerciseSummarySchema, type Exercise, type ExerciseSummary } from '@betterfit/shared';
import type { ExerciseRow } from '../db/schema.js';

/** Adresse publique d'une photo d'exercice. */
function imageUrls(images: string[]): string[] {
  return images.map((image) => `/api/v1/exercises/images/${image}`);
}

export function toExercise(row: ExerciseRow): Exercise {
  return exerciseSchema.parse({
    id: row.id,
    source: row.source,
    ownerId: row.ownerId,
    name: row.name,
    nameEn: row.nameEn,
    primaryMuscles: row.primaryMuscles,
    secondaryMuscles: row.secondaryMuscles,
    equipment: row.equipment,
    level: row.level,
    category: row.category,
    force: row.force,
    mechanic: row.mechanic,
    instructions: row.instructions,
    instructionsEn: row.instructionsEn,
    images: imageUrls(row.images),
    mascotPose: row.mascotPose,
    translated: row.instructions.length > 0,
  });
}

export function toExerciseSummary(row: ExerciseRow): ExerciseSummary {
  const { instructions, instructionsEn, ...summary } = toExercise(row);
  void instructions;
  void instructionsEn;

  return exerciseSummarySchema.parse(summary);
}
