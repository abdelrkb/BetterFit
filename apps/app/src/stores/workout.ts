import {
  countCompletedSets,
  workoutResultSchema,
  workoutVolume,
  type PersonalRecord,
  type SetLog,
  type WorkoutInput,
} from '@betterfit/shared';
import { create } from 'zustand';
import { ApiRequestError, NetworkError } from '../lib/api';
import { readKey, writeKey } from '../lib/kv';
import { useSession } from './session';

/**
 * La séance en cours, et la file d'envoi.
 *
 * Tout se passe sur l'appareil : on peut s'entraîner en mode avion. La séance
 * en cours est écrite dans le stockage local à chaque geste, pour survivre à
 * la fermeture de l'app au milieu d'une série. Une fois terminée, elle part
 * dans une file que l'on vide dès que le réseau revient.
 */

const CURRENT_KEY = 'betterfit.workout.current';
const QUEUE_KEY = 'betterfit.workout.queue';

export type LiveExercise = {
  exerciseId: string;
  name: string;
  imageUrl: string | null;
  mascotPose: string | null;
  /** Consignes du programme : « 4 × 8-10 », repos, tempo. */
  plannedSets: number;
  reps: string;
  load: string;
  restSeconds: number;
  tempo: string;
  notes: string;
  sets: SetLog[];
  /** Ce qui a été fait la dernière fois, pour l'afficher en repère. */
  lastSets: { setIndex: number; weightKg: number | null; reps: number | null }[];
};

export type LiveWorkout = {
  id: string;
  programId: string | null;
  sessionId: string | null;
  sessionName: string;
  startedAt: string;
  exercises: LiveExercise[];
  currentIndex: number;
  notes: string;
};

type WorkoutState = {
  current: LiveWorkout | null;
  queue: WorkoutInput[];
  /** Vrai pendant un envoi, pour l'afficher sans bloquer. */
  syncing: boolean;
  lastResultRecords: PersonalRecord[];

  restore: () => Promise<void>;
  start: (workout: LiveWorkout) => Promise<void>;
  updateSet: (exerciseIndex: number, setIndex: number, changes: Partial<SetLog>) => Promise<void>;
  addSet: (exerciseIndex: number) => Promise<void>;
  removeSet: (exerciseIndex: number) => Promise<void>;
  /** Ajoute un exercice en cours de séance : c'est le mode libre. */
  addExercise: (exercise: LiveExercise) => Promise<void>;
  removeExercise: (exerciseIndex: number) => Promise<void>;
  goTo: (index: number) => Promise<void>;
  setNotes: (notes: string) => Promise<void>;
  cancel: () => Promise<void>;
  /** Termine la séance, la met en file et tente l'envoi. */
  finish: () => Promise<{ queued: boolean; records: PersonalRecord[] }>;
  flush: () => Promise<void>;
};

async function readJson<T>(key: string, fallback: T): Promise<T> {
  const raw = await readKey(key);
  if (raw === null) return fallback;

  try {
    return JSON.parse(raw) as T;
  } catch {
    // Donnée abîmée : on repart proprement plutôt que de planter au démarrage.
    return fallback;
  }
}

async function writeJson(key: string, value: unknown): Promise<void> {
  await writeKey(key, JSON.stringify(value));
}

/** Ce qu'on envoie au serveur, à partir de la séance en cours. */
export function toWorkoutInput(live: LiveWorkout, finishedAt: string): WorkoutInput {
  return {
    id: live.id,
    programId: live.programId,
    sessionId: live.sessionId,
    sessionName: live.sessionName,
    startedAt: live.startedAt,
    finishedAt,
    notes: live.notes.trim(),
    exercises: live.exercises.map((exercise, position) => ({
      exerciseId: exercise.exerciseId,
      position,
      sets: exercise.sets,
    })),
  };
}

export const useWorkout = create<WorkoutState>((set, get) => {
  async function persist(current: LiveWorkout | null) {
    set({ current });
    await writeJson(CURRENT_KEY, current);
  }

  async function patchExercise(index: number, change: (exercise: LiveExercise) => LiveExercise) {
    const current = get().current;
    if (!current) return;

    await persist({
      ...current,
      exercises: current.exercises.map((exercise, i) =>
        i === index ? change(exercise) : exercise,
      ),
    });
  }

  return {
    current: null,
    queue: [],
    syncing: false,
    lastResultRecords: [],

    async restore() {
      const [current, queue] = await Promise.all([
        readJson<LiveWorkout | null>(CURRENT_KEY, null),
        readJson<WorkoutInput[]>(QUEUE_KEY, []),
      ]);

      // On ne vide pas la file ici : la session n'est pas encore rétablie au
      // démarrage, et `flush` refuserait. C'est l'app qui la déclenche dès
      // qu'elle est connectée.
      set({ current, queue });
    },

    async start(workout) {
      await persist(workout);
    },

    async updateSet(exerciseIndex, setIndex, changes) {
      await patchExercise(exerciseIndex, (exercise) => ({
        ...exercise,
        sets: exercise.sets.map((item) =>
          item.setIndex === setIndex ? { ...item, ...changes } : item,
        ),
      }));
    },

    async addSet(exerciseIndex) {
      await patchExercise(exerciseIndex, (exercise) => {
        const last = exercise.sets[exercise.sets.length - 1];

        return {
          ...exercise,
          sets: [
            ...exercise.sets,
            {
              setIndex: (last?.setIndex ?? 0) + 1,
              // La nouvelle série reprend la charge de la précédente : c'est
              // presque toujours ce qu'on veut.
              weightKg: last?.weightKg ?? null,
              reps: last?.reps ?? null,
              rir: null,
              done: false,
            },
          ],
        };
      });
    },

    async removeSet(exerciseIndex) {
      await patchExercise(exerciseIndex, (exercise) => ({
        ...exercise,
        sets: exercise.sets.slice(0, -1),
      }));
    },

    /**
     * Ajoute un exercice à la séance en cours, et s'y place.
     *
     * C'est le cœur du mode libre : on improvise, on cherche l'exercice au
     * moment de le faire. Ça marche aussi pendant une séance du programme,
     * quand la machine qu'on voulait est prise.
     */
    async addExercise(exercise) {
      const current = get().current;
      if (!current) return;

      const exercises = [...current.exercises, exercise];

      await persist({ ...current, exercises, currentIndex: exercises.length - 1 });
    },

    async removeExercise(exerciseIndex) {
      const current = get().current;
      if (!current) return;

      const exercises = current.exercises.filter((_, index) => index !== exerciseIndex);

      await persist({
        ...current,
        exercises,
        // On ne laisse jamais l'index pointer au-delà de la liste.
        currentIndex: Math.max(0, Math.min(current.currentIndex, exercises.length - 1)),
      });
    },

    async goTo(index) {
      const current = get().current;
      if (!current) return;

      await persist({
        ...current,
        currentIndex: Math.max(0, Math.min(index, current.exercises.length - 1)),
      });
    },

    async setNotes(notes) {
      const current = get().current;
      if (!current) return;

      await persist({ ...current, notes });
    },

    async cancel() {
      await persist(null);
    },

    async finish() {
      const current = get().current;
      if (!current) return { queued: false, records: [] };

      const input = toWorkoutInput(current, new Date().toISOString());

      const queue = [...get().queue.filter((item) => item.id !== input.id), input];
      set({ queue });
      await writeJson(QUEUE_KEY, queue);
      await persist(null);

      await get().flush();

      // Si la file s'est vidée, l'envoi a réussi et on a les records.
      const queued = get().queue.some((item) => item.id === input.id);

      return { queued, records: get().lastResultRecords };
    },

    /**
     * Vide la file. Une séance refusée par le serveur pour cause de données
     * invalides est abandonnée — la garder bloquerait tout le reste —, tandis
     * qu'une panne réseau laisse la file intacte pour le prochain essai.
     */
    async flush() {
      if (get().syncing) return;
      if (useSession.getState().status !== 'signedIn') return;

      const queue = get().queue;
      if (queue.length === 0) return;

      set({ syncing: true });

      const remaining: WorkoutInput[] = [];
      let records: PersonalRecord[] = [];

      for (const item of queue) {
        try {
          const result = await useSession
            .getState()
            .authedRequest(`/workouts/${item.id}`, { method: 'PUT', body: item }, (data) =>
              workoutResultSchema.parse(data),
            );

          records = result.records;
        } catch (error) {
          if (error instanceof NetworkError) {
            remaining.push(item);
            continue;
          }

          // 4xx : la séance ne passera jamais, on ne la garde pas.
          if (error instanceof ApiRequestError && error.status >= 400 && error.status < 500) {
            console.warn('Séance refusée par le serveur, abandonnée :', error.code);
            continue;
          }

          remaining.push(item);
        }
      }

      set({ queue: remaining, syncing: false, lastResultRecords: records });
      await writeJson(QUEUE_KEY, remaining);
    },
  };
});

/** Résumé affiché en fin de séance, calculé sans passer par le serveur. */
export function liveSummary(live: LiveWorkout) {
  const exercises = live.exercises.map((exercise) => ({ sets: exercise.sets }));

  return {
    volumeKg: workoutVolume(exercises),
    completedSets: countCompletedSets(exercises),
  };
}
