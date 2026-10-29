import {
  emptySchedule,
  trainingSessionLabel,
  type ExerciseSummary,
  type Program,
  type ProgramInput,
  type Schedule,
  type TrainingSessionInput,
} from '@betterfit/shared';

/**
 * Le brouillon manipulé par l'éditeur.
 *
 * Il ressemble à `ProgramInput`, mais garde en plus l'exercice complet de
 * chaque ligne : sans lui, l'éditeur afficherait des identifiants au lieu de
 * noms. Au moment d'enregistrer, `toInput` ne renvoie que ce que l'API attend.
 */

export type DraftLine = {
  exerciseId: string;
  exercise: ExerciseSummary | null;
  sets: number;
  reps: string;
  load: string;
  restSeconds: number;
  tempo: string;
  notes: string;
};

export type DraftSession = Omit<TrainingSessionInput, 'exercises' | 'id' | 'label'> & {
  exercises: DraftLine[];
};

export type Draft = {
  title: string;
  isTemplate: boolean;
  details: ProgramInput['details'];
  sessions: DraftSession[];
  schedule: Schedule;
};

export function emptyDraft(): Draft {
  return {
    title: '',
    isTemplate: false,
    details: {
      goal: 'general',
      level: 'beginner',
      place: 'gym',
      sessionMinutes: 60,
      weeks: 8,
      coachNote: '',
    },
    sessions: [emptySession('Séance A')],
    schedule: emptySchedule(),
  };
}

export function emptySession(name: string): DraftSession {
  return {
    name,
    targetMuscles: [],
    durationMinutes: 60,
    warmup: '',
    cooldown: '',
    exercises: [],
  };
}

export function draftFromProgram(program: Program): Draft {
  return {
    title: program.title,
    isTemplate: program.isTemplate,
    details: program.details,
    sessions: program.sessions.map((session) => ({
      name: session.name,
      targetMuscles: session.targetMuscles,
      durationMinutes: session.durationMinutes,
      warmup: session.warmup,
      cooldown: session.cooldown,
      exercises: session.exercises.map((line) => ({
        exerciseId: line.exerciseId,
        exercise: line.exercise,
        sets: line.sets,
        reps: line.reps,
        load: line.load,
        restSeconds: line.restSeconds,
        tempo: line.tempo,
        notes: line.notes,
      })),
    })),
    schedule: program.schedule,
  };
}

export function toInput(draft: Draft): ProgramInput {
  return {
    title: draft.title.trim(),
    isTemplate: draft.isTemplate,
    details: draft.details,
    sessions: draft.sessions.map((session, index) => ({
      label: trainingSessionLabel(index),
      name: session.name.trim(),
      targetMuscles: session.targetMuscles,
      durationMinutes: session.durationMinutes,
      warmup: session.warmup.trim(),
      cooldown: session.cooldown.trim(),
      exercises: session.exercises.map((line) => ({
        exerciseId: line.exerciseId,
        sets: line.sets,
        reps: line.reps.trim(),
        load: line.load.trim(),
        restSeconds: line.restSeconds,
        tempo: line.tempo.trim(),
        notes: line.notes.trim(),
      })),
    })),
    schedule: draft.schedule,
  };
}

/** Déplace un élément d'un cran, et renvoie la liste inchangée si c'est impossible. */
export function move<T>(items: T[], from: number, direction: -1 | 1): T[] {
  const to = from + direction;
  if (to < 0 || to >= items.length) return items;

  const next = [...items];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved!);

  return next;
}

/**
 * Supprimer une séance décale les suivantes : le planning doit suivre, sinon
 * le mardi pointerait soudain sur la mauvaise séance.
 */
export function scheduleAfterRemoval(schedule: Schedule, removed: number): Schedule {
  return schedule.map((index) => {
    if (index === null) return null;
    if (index === removed) return null;
    return index > removed ? index - 1 : index;
  }) as Schedule;
}

/** Même chose après un déplacement : les jours suivent la séance déplacée. */
export function scheduleAfterMove(schedule: Schedule, from: number, to: number): Schedule {
  return schedule.map((index) => {
    if (index === null) return null;
    if (index === from) return to;
    if (index === to) return from;
    return index;
  }) as Schedule;
}
