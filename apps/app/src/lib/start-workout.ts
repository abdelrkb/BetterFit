import { lastPerformancesSchema, type Program, type TrainingSession } from '@betterfit/shared';
import * as Crypto from 'expo-crypto';
import { NetworkError } from './api';
import { useSession } from '../stores/session';
import type { LiveExercise, LiveWorkout } from '../stores/workout';

/**
 * Prépare une séance guidée à partir d'une séance du programme.
 *
 * Les dernières valeurs saisies sont demandées au serveur pour préremplir les
 * séries. Si le réseau manque — on démarre souvent une séance en salle, en
 * sous-sol —, on part sur les charges conseillées du programme : mieux vaut
 * une séance sans repère que pas de séance du tout.
 */
export async function buildLiveWorkout(
  program: Program,
  session: TrainingSession,
): Promise<LiveWorkout> {
  const exerciseIds = session.exercises.map((line) => line.exerciseId);
  const lastByExercise = await fetchLastPerformances(exerciseIds);

  const exercises: LiveExercise[] = session.exercises.map((line) => {
    const last = lastByExercise.get(line.exerciseId) ?? [];

    return {
      exerciseId: line.exerciseId,
      name: line.exercise?.name ?? '',
      imageUrl: line.exercise?.images[0] ?? null,
      mascotPose: line.exercise?.mascotPose ?? null,
      plannedSets: line.sets,
      reps: line.reps,
      load: line.load,
      restSeconds: line.restSeconds,
      tempo: line.tempo,
      notes: line.notes,
      lastSets: last,
      sets: Array.from({ length: Math.max(1, line.sets) }, (_, i) => {
        const previous = last.find((item) => item.setIndex === i + 1);

        return {
          setIndex: i + 1,
          // Préremplir avec la dernière fois : on vient pour faire au moins
          // aussi bien, et retaper les mêmes chiffres est pénible.
          weightKg: previous?.weightKg ?? null,
          reps: previous?.reps ?? null,
          rir: null,
          done: false,
        };
      }),
    };
  });

  return {
    id: Crypto.randomUUID(),
    programId: program.id,
    sessionId: session.id,
    sessionName: session.name,
    startedAt: new Date().toISOString(),
    exercises,
    currentIndex: 0,
    notes: '',
  };
}

async function fetchLastPerformances(exerciseIds: string[]) {
  const result = new Map<string, { setIndex: number; weightKg: number | null; reps: number | null }[]>();

  if (exerciseIds.length === 0) return result;

  try {
    const data = await useSession
      .getState()
      .authedRequest(
        `/workouts/last-performances?exerciseIds=${exerciseIds.join(',')}`,
        {},
        (value) => lastPerformancesSchema.parse(value),
      );

    for (const item of data.items) result.set(item.exerciseId, item.sets);
  } catch (error) {
    // Hors ligne : on démarre quand même, sans les repères.
    if (!(error instanceof NetworkError)) throw error;
  }

  return result;
}

/** Jour de la semaine au format ISO : lundi = 1, dimanche = 7. */
export function isoWeekday(date = new Date()): number {
  const day = date.getDay();
  return day === 0 ? 7 : day;
}

/** La séance prévue aujourd'hui par le planning, s'il y en a une. */
export function todaySession(program: Program, date = new Date()): TrainingSession | null {
  const index = program.schedule[isoWeekday(date) - 1];
  if (index === null || index === undefined) return null;

  return program.sessions[index] ?? null;
}
