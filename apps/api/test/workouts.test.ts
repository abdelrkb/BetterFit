import { randomUUID } from 'node:crypto';
import { workoutResultSchema, type WorkoutInput } from '@betterfit/shared';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { App } from '../src/app.js';
import { db } from '../src/db/client.js';
import { exercises } from '../src/db/schema.js';
import { buildSearchText } from '../src/exercises/search-text.js';
import { API, authHeaders, register, startApp } from './helpers.js';

let app: App;
let squatId = '';

beforeAll(async () => {
  app = await startApp();
});

afterAll(async () => {
  await app.close();
});

beforeEach(async () => {
  const [row] = await db
    .insert(exercises)
    .values({
      source: 'library',
      externalId: 'Barbell_Squat',
      name: 'Squat à la barre',
      nameEn: 'Barbell Squat',
      primaryMuscles: ['quadriceps'],
      secondaryMuscles: [],
      equipment: 'barbell',
      level: 'intermediate',
      category: 'strength',
      instructionsEn: ['Squat.'],
      images: [],
      searchText: buildSearchText({ name: 'Squat à la barre' }),
    })
    .returning({ id: exercises.id });

  squatId = row!.id;
});

function workout(overrides: Partial<WorkoutInput> = {}): WorkoutInput {
  const startedAt = new Date('2026-10-20T18:00:00.000Z');
  const finishedAt = new Date('2026-10-20T19:05:00.000Z');

  return {
    id: randomUUID(),
    programId: null,
    sessionId: null,
    sessionName: 'Bas du corps',
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    notes: '',
    exercises: [
      {
        exerciseId: squatId,
        position: 0,
        sets: [
          { setIndex: 1, weightKg: 80, reps: 8, rir: 2, done: true },
          { setIndex: 2, weightKg: 80, reps: 7, rir: 1, done: true },
          { setIndex: 3, weightKg: 80, reps: 6, rir: null, done: false },
        ],
      },
    ],
    ...overrides,
  };
}

async function save(session: Awaited<ReturnType<typeof register>>, input: WorkoutInput) {
  return app.inject({
    method: 'PUT',
    url: `${API}/workouts/${input.id}`,
    headers: authHeaders(session),
    payload: input,
  });
}

describe('accès refusé', () => {
  it('refuse sans jeton', async () => {
    const input = workout();
    const response = await app.inject({
      method: 'PUT',
      url: `${API}/workouts/${input.id}`,
      payload: input,
    });

    expect(response.statusCode).toBe(401);
  });

  it('ne laisse pas voir ni supprimer la séance d’un autre', async () => {
    const julie = await register(app);
    const marc = await register(app, { email: 'marc@exemple.fr', name: 'Marc' });

    const input = workout();
    await save(julie, input);

    const read = await app.inject({
      method: 'GET',
      url: `${API}/workouts/${input.id}`,
      headers: authHeaders(marc),
    });
    expect(read.statusCode).toBe(404);

    const removed = await app.inject({
      method: 'DELETE',
      url: `${API}/workouts/${input.id}`,
      headers: authHeaders(marc),
    });
    expect(removed.statusCode).toBe(404);

    const list = await app.inject({
      method: 'GET',
      url: `${API}/workouts`,
      headers: authHeaders(marc),
    });
    expect(list.json().items).toHaveLength(0);
  });
});

describe('enregistrement', () => {
  it('calcule la durée, le volume et les séries validées', async () => {
    const session = await register(app);
    const response = await save(session, workout());

    expect(response.statusCode).toBe(200);

    const { workout: saved } = workoutResultSchema.parse(response.json());
    expect(saved.durationSeconds).toBe(65 * 60);
    // (80×8) + (80×7) = 1200 ; la série non validée ne compte pas.
    expect(saved.totalVolumeKg).toBe(1200);
    expect(saved.completedSets).toBe(2);
    expect(saved.exercises[0]?.exercise?.name).toBe('Squat à la barre');
  });

  it('rejoué avec le même identifiant, ne crée pas de doublon', async () => {
    const session = await register(app);
    const input = workout();

    await save(session, input);
    const second = await save(session, input);

    expect(second.statusCode).toBe(200);

    const list = await app.inject({
      method: 'GET',
      url: `${API}/workouts`,
      headers: authHeaders(session),
    });
    expect(list.json().items).toHaveLength(1);
  });

  it('rejoué, annonce exactement les mêmes records', async () => {
    const session = await register(app);

    await save(session, workout());

    const heavier = workout({
      id: randomUUID(),
      startedAt: '2026-10-27T18:00:00.000Z',
      finishedAt: '2026-10-27T19:00:00.000Z',
      exercises: [
        {
          exerciseId: squatId,
          position: 0,
          sets: [{ setIndex: 1, weightKg: 90, reps: 5, rir: null, done: true }],
        },
      ],
    });

    const first = await save(session, heavier);
    const second = await save(session, heavier);

    // La séance ne se compare jamais à elle-même : un renvoi depuis la file
    // hors ligne donne la même réponse, pas un record inventé.
    expect(second.json().records).toEqual(first.json().records);
    expect(second.json().records.find((r: { kind: string }) => r.kind === 'weight').value).toBe(90);
  });

  it('refuse un identifiant qui ne correspond pas à l’adresse', async () => {
    const session = await register(app);
    const input = workout();

    const response = await app.inject({
      method: 'PUT',
      url: `${API}/workouts/${randomUUID()}`,
      headers: authHeaders(session),
      payload: input,
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().code).toBe('workout/id-mismatch');
  });
});

describe('records', () => {
  it('annonce un record de charge battu', async () => {
    const session = await register(app);

    await save(session, workout());

    const heavier = workout({
      id: randomUUID(),
      startedAt: '2026-10-27T18:00:00.000Z',
      finishedAt: '2026-10-27T19:00:00.000Z',
      exercises: [
        {
          exerciseId: squatId,
          position: 0,
          sets: [{ setIndex: 1, weightKg: 90, reps: 5, rir: null, done: true }],
        },
      ],
    });

    const response = await save(session, heavier);
    const { records } = workoutResultSchema.parse(response.json());

    const weightRecord = records.find((record) => record.kind === 'weight');
    expect(weightRecord?.value).toBe(90);
    expect(weightRecord?.previous).toBe(80);
  });

  it('n’annonce rien quand la séance est plus légère', async () => {
    const session = await register(app);

    await save(session, workout());

    const lighter = workout({
      id: randomUUID(),
      startedAt: '2026-10-27T18:00:00.000Z',
      finishedAt: '2026-10-27T19:00:00.000Z',
      exercises: [
        {
          exerciseId: squatId,
          position: 0,
          sets: [{ setIndex: 1, weightKg: 60, reps: 5, rir: null, done: true }],
        },
      ],
    });

    const response = await save(session, lighter);
    expect(response.json().records).toHaveLength(0);
  });
});

describe('dernières valeurs', () => {
  it('rend les séries de la dernière séance, pour préremplir', async () => {
    const session = await register(app);
    await save(session, workout());

    const response = await app.inject({
      method: 'GET',
      url: `${API}/workouts/last-performances?exerciseIds=${squatId}`,
      headers: authHeaders(session),
    });

    const [item] = response.json().items;
    expect(item.exerciseId).toBe(squatId);
    // Seules les séries validées sont proposées.
    expect(item.sets).toHaveLength(2);
    expect(item.sets[0].weightKg).toBe(80);
  });

  it('rend une liste vide pour un exercice jamais fait', async () => {
    const session = await register(app);

    const response = await app.inject({
      method: 'GET',
      url: `${API}/workouts/last-performances?exerciseIds=${squatId}`,
      headers: authHeaders(session),
    });

    expect(response.json().items[0].performedAt).toBeNull();
    expect(response.json().items[0].sets).toHaveLength(0);
  });
});

describe('progression', () => {
  it('rend un point par jour, avec charge max, 1RM estimé et volume', async () => {
    const session = await register(app);

    await save(session, workout());
    await save(
      session,
      workout({
        id: randomUUID(),
        startedAt: '2026-10-27T18:00:00.000Z',
        finishedAt: '2026-10-27T19:00:00.000Z',
        exercises: [
          {
            exerciseId: squatId,
            position: 0,
            sets: [{ setIndex: 1, weightKg: 90, reps: 5, rir: null, done: true }],
          },
        ],
      }),
    );

    const response = await app.inject({
      method: 'GET',
      url: `${API}/exercises/${squatId}/progress`,
      headers: authHeaders(session),
    });

    const progress = response.json();
    expect(progress.points).toHaveLength(2);
    expect(progress.points[0].date).toBe('2026-10-20');
    expect(progress.points[0].maxWeightKg).toBe(80);
    expect(progress.points[1].maxWeightKg).toBe(90);
    // 90 × (1 + 5/30) = 105
    expect(progress.points[1].estimatedOneRepMaxKg).toBeCloseTo(105, 1);
    expect(progress.bestWeightKg).toBe(90);
  });

  it('ne mélange pas la progression de deux personnes', async () => {
    const julie = await register(app);
    const marc = await register(app, { email: 'marc@exemple.fr', name: 'Marc' });

    await save(julie, workout());

    const response = await app.inject({
      method: 'GET',
      url: `${API}/exercises/${squatId}/progress`,
      headers: authHeaders(marc),
    });

    expect(response.json().points).toHaveLength(0);
    expect(response.json().bestWeightKg).toBeNull();
  });
});
