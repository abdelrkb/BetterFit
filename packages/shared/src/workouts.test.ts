import { describe, expect, it } from 'vitest';
import {
  countCompletedSets,
  estimateOneRepMax,
  setVolume,
  workoutVolume,
  ONE_REP_MAX_REP_LIMIT,
} from './workouts.js';

describe('estimateOneRepMax', () => {
  it('rend la charge telle quelle à une répétition', () => {
    expect(estimateOneRepMax(100, 1)).toBe(100);
  });

  it('applique la formule d’Epley', () => {
    // 100 × (1 + 5/30) = 116,67 → 116,7
    expect(estimateOneRepMax(100, 5)).toBeCloseTo(116.7, 1);
  });

  it('plafonne les répétitions : au-delà, la formule surestime', () => {
    const atLimit = estimateOneRepMax(60, ONE_REP_MAX_REP_LIMIT);
    expect(estimateOneRepMax(60, 30)).toBe(atLimit);
  });

  it('rend zéro sans charge ni répétition', () => {
    expect(estimateOneRepMax(0, 10)).toBe(0);
    expect(estimateOneRepMax(80, 0)).toBe(0);
  });
});

describe('setVolume', () => {
  it('compte charge × répétitions', () => {
    expect(setVolume({ weightKg: 80, reps: 8, done: true })).toBe(640);
  });

  it('ne compte pas une série non validée', () => {
    expect(setVolume({ weightKg: 80, reps: 8, done: false })).toBe(0);
  });

  it('ne compte pas une série sans charge saisie', () => {
    expect(setVolume({ weightKg: null, reps: 8, done: true })).toBe(0);
  });
});

describe('workoutVolume', () => {
  const exercises = [
    {
      sets: [
        { setIndex: 1, weightKg: 80, reps: 8, rir: null, done: true },
        { setIndex: 2, weightKg: 80, reps: 7, rir: null, done: true },
        { setIndex: 3, weightKg: 80, reps: 6, rir: null, done: false },
      ],
    },
    {
      sets: [{ setIndex: 1, weightKg: 40, reps: 12, rir: 2, done: true }],
    },
  ];

  it('additionne les séries validées de tous les exercices', () => {
    // (80×8) + (80×7) + (40×12) = 640 + 560 + 480
    expect(workoutVolume(exercises)).toBe(1680);
  });

  it('compte les séries validées', () => {
    expect(countCompletedSets(exercises)).toBe(3);
  });
});
