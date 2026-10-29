import { programSchema, type ProgramInput } from '@betterfit/shared';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { App } from '../src/app.js';
import { db } from '../src/db/client.js';
import { exercises, sessions } from '../src/db/schema.js';
import { buildSearchText } from '../src/exercises/search-text.js';
import { API, authHeaders, register, startApp } from './helpers.js';

let app: App;

beforeAll(async () => {
  app = await startApp();
});

afterAll(async () => {
  await app.close();
});

let squatId = '';
let pullupId = '';

beforeEach(async () => {
  const rows = await db
    .insert(exercises)
    .values([
      {
        source: 'library',
        externalId: 'Barbell_Squat',
        name: 'Squat à la barre',
        nameEn: 'Barbell Squat',
        primaryMuscles: ['quadriceps'],
        secondaryMuscles: ['glutes'],
        equipment: 'barbell',
        level: 'intermediate',
        category: 'strength',
        instructionsEn: ['Squat down.'],
        images: [],
        searchText: buildSearchText({ name: 'Squat à la barre', nameEn: 'Barbell Squat' }),
      },
      {
        source: 'library',
        externalId: 'Pullups',
        name: 'Tractions',
        nameEn: 'Pullups',
        primaryMuscles: ['lats'],
        secondaryMuscles: ['biceps'],
        equipment: 'body only',
        level: 'intermediate',
        category: 'strength',
        instructionsEn: ['Hang.'],
        images: [],
        searchText: buildSearchText({ name: 'Tractions', nameEn: 'Pullups' }),
      },
    ])
    .returning({ id: exercises.id, externalId: exercises.externalId });

  squatId = rows.find((row) => row.externalId === 'Barbell_Squat')!.id;
  pullupId = rows.find((row) => row.externalId === 'Pullups')!.id;
});

function programInput(overrides: Partial<ProgramInput> = {}): ProgramInput {
  return {
    title: 'Prise de masse 3 séances',
    isTemplate: false,
    details: {
      goal: 'gain_muscle',
      level: 'intermediate',
      place: 'gym',
      sessionMinutes: 75,
      weeks: 8,
      coachNote: 'La technique avant la charge.',
    },
    sessions: [
      {
        label: '',
        name: 'Haut du corps',
        targetMuscles: ['chest', 'lats'],
        durationMinutes: 70,
        warmup: '10 minutes de vélo.',
        cooldown: 'Étirements.',
        exercises: [
          {
            exerciseId: pullupId,
            sets: 4,
            reps: '8-10',
            load: 'Poids du corps',
            restSeconds: 120,
            tempo: '2-0-1-0',
            notes: 'Amplitude complète.',
          },
        ],
      },
      {
        label: '',
        name: 'Bas du corps',
        targetMuscles: ['quadriceps'],
        durationMinutes: 80,
        warmup: '',
        cooldown: '',
        exercises: [
          {
            exerciseId: squatId,
            sets: 5,
            reps: '5',
            load: '80 kg',
            restSeconds: 180,
            tempo: '',
            notes: '',
          },
        ],
      },
    ],
    schedule: [0, null, 1, null, 0, null, null],
    ...overrides,
  };
}

describe('accès refusé', () => {
  const routes = [
    { method: 'GET' as const, url: `${API}/programs` },
    { method: 'POST' as const, url: `${API}/programs` },
  ];

  it.each(routes)('$method $url refuse sans jeton', async (route) => {
    expect((await app.inject(route)).statusCode).toBe(401);
  });

  it('ne laisse pas voir, modifier ni supprimer le programme d’un autre', async () => {
    const julie = await register(app);
    const marc = await register(app, { email: 'marc@exemple.fr', name: 'Marc' });

    const created = await app.inject({
      method: 'POST',
      url: `${API}/programs`,
      headers: authHeaders(julie),
      payload: programInput(),
    });
    const id = created.json().id;

    for (const attempt of [
      { method: 'GET' as const, url: `${API}/programs/${id}` },
      { method: 'PUT' as const, url: `${API}/programs/${id}`, payload: programInput() },
      { method: 'DELETE' as const, url: `${API}/programs/${id}` },
      { method: 'POST' as const, url: `${API}/programs/${id}/duplicate` },
    ]) {
      const response = await app.inject({ ...attempt, headers: authHeaders(marc) });
      expect(response.statusCode).toBe(404);
    }

    const list = await app.inject({
      method: 'GET',
      url: `${API}/programs`,
      headers: authHeaders(marc),
    });
    expect(list.json().items).toHaveLength(0);
  });

  it('refuse qu’un programme contienne l’exercice personnel d’un autre', async () => {
    const julie = await register(app);
    const marc = await register(app, { email: 'marc@exemple.fr', name: 'Marc' });

    const custom = await app.inject({
      method: 'POST',
      url: `${API}/exercises`,
      headers: authHeaders(marc),
      payload: {
        name: 'Mouvement secret',
        primaryMuscles: ['chest'],
        secondaryMuscles: [],
        equipment: 'body only',
        level: 'beginner',
        category: 'strength',
        instructions: [],
        mascotPose: null,
      },
    });

    const input = programInput();
    input.sessions[0]!.exercises[0]!.exerciseId = custom.json().id;

    const response = await app.inject({
      method: 'POST',
      url: `${API}/programs`,
      headers: authHeaders(julie),
      payload: input,
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().code).toBe('program/unknown-exercise');
  });
});

describe('création', () => {
  it('enregistre infos, séances, exercices et planning d’un bloc', async () => {
    const session = await register(app);

    const response = await app.inject({
      method: 'POST',
      url: `${API}/programs`,
      headers: authHeaders(session),
      payload: programInput(),
    });

    expect(response.statusCode).toBe(201);

    const program = programSchema.parse(response.json());
    expect(program.title).toBe('Prise de masse 3 séances');
    expect(program.details.weeks).toBe(8);
    expect(program.sessions).toHaveLength(2);
    expect(program.sessions[0]?.label).toBe('A');
    expect(program.sessions[1]?.label).toBe('B');
    expect(program.sessions[0]?.exercises[0]?.reps).toBe('8-10');
    // L'exercice est joint, pour l'afficher sans un appel de plus.
    expect(program.sessions[0]?.exercises[0]?.exercise?.name).toBe('Tractions');
    expect(program.schedule).toEqual([0, null, 1, null, 0, null, null]);
  });

  it('refuse un programme sans séance', async () => {
    const session = await register(app);

    const response = await app.inject({
      method: 'POST',
      url: `${API}/programs`,
      headers: authHeaders(session),
      payload: programInput({ sessions: [] }),
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().fields).toHaveProperty('sessions');
  });

  it('refuse un planning qui ne couvre pas sept jours', async () => {
    const session = await register(app);

    const response = await app.inject({
      method: 'POST',
      url: `${API}/programs`,
      headers: authHeaders(session),
      payload: programInput({ schedule: [0, null, 1] as never }),
    });

    expect(response.statusCode).toBe(400);
  });
});

describe('modification', () => {
  it('remplace tout le contenu, sans laisser d’orphelin', async () => {
    const session = await register(app);

    const created = await app.inject({
      method: 'POST',
      url: `${API}/programs`,
      headers: authHeaders(session),
      payload: programInput(),
    });
    const id = created.json().id;

    const input = programInput();
    input.sessions = [input.sessions[1]!];
    input.schedule = [0, null, null, null, 0, null, null];
    input.title = 'Programme allégé';

    const updated = await app.inject({
      method: 'PUT',
      url: `${API}/programs/${id}`,
      headers: authHeaders(session),
      payload: input,
    });

    expect(updated.statusCode).toBe(200);
    expect(updated.json().title).toBe('Programme allégé');
    expect(updated.json().sessions).toHaveLength(1);
    expect(updated.json().sessions[0].name).toBe('Bas du corps');

    // Les anciennes séances ont bien disparu de la base.
    const remaining = await db.select().from(sessions).where(eq(sessions.programId, id));
    expect(remaining).toHaveLength(1);
  });

  it('réordonne les séances et met à jour les étiquettes', async () => {
    const session = await register(app);

    const created = await app.inject({
      method: 'POST',
      url: `${API}/programs`,
      headers: authHeaders(session),
      payload: programInput(),
    });

    const input = programInput();
    input.sessions = [input.sessions[1]!, input.sessions[0]!];
    input.schedule = [1, null, 0, null, 1, null, null];

    const updated = await app.inject({
      method: 'PUT',
      url: `${API}/programs/${created.json().id}`,
      headers: authHeaders(session),
      payload: input,
    });

    const program = programSchema.parse(updated.json());
    expect(program.sessions[0]?.name).toBe('Bas du corps');
    expect(program.sessions[0]?.label).toBe('A');
    // Le planning suit : le lundi pointe toujours sur « Haut du corps ».
    expect(program.sessions[program.schedule[0]!]?.name).toBe('Haut du corps');
  });
});

describe('liste', () => {
  it('résume chaque programme', async () => {
    const session = await register(app);

    await app.inject({
      method: 'POST',
      url: `${API}/programs`,
      headers: authHeaders(session),
      payload: programInput(),
    });

    const response = await app.inject({
      method: 'GET',
      url: `${API}/programs`,
      headers: authHeaders(session),
    });

    const [item] = response.json().items;
    expect(item.sessionCount).toBe(2);
    expect(item.trainingDays).toBe(3);
    expect(item.goal).toBe('gain_muscle');
  });

  it('sépare les modèles des programmes ordinaires', async () => {
    const session = await register(app);

    await app.inject({
      method: 'POST',
      url: `${API}/programs`,
      headers: authHeaders(session),
      payload: programInput({ isTemplate: true, title: 'Modèle débutant' }),
    });
    await app.inject({
      method: 'POST',
      url: `${API}/programs`,
      headers: authHeaders(session),
      payload: programInput(),
    });

    const templates = await app.inject({
      method: 'GET',
      url: `${API}/programs?templates=true`,
      headers: authHeaders(session),
    });
    expect(templates.json().items).toHaveLength(1);
    expect(templates.json().items[0].title).toBe('Modèle débutant');

    const ordinary = await app.inject({
      method: 'GET',
      url: `${API}/programs?templates=false`,
      headers: authHeaders(session),
    });
    expect(ordinary.json().items).toHaveLength(1);
  });
});

describe('duplication', () => {
  it('copie tout le contenu et garde le lien vers l’original', async () => {
    const session = await register(app);

    const created = await app.inject({
      method: 'POST',
      url: `${API}/programs`,
      headers: authHeaders(session),
      payload: programInput({ isTemplate: true }),
    });
    const sourceId = created.json().id;

    const copy = await app.inject({
      method: 'POST',
      url: `${API}/programs/${sourceId}/duplicate`,
      headers: authHeaders(session),
      payload: { title: 'Programme de Julie' },
    });

    expect(copy.statusCode).toBe(201);

    const program = programSchema.parse(copy.json());
    expect(program.title).toBe('Programme de Julie');
    expect(program.isTemplate).toBe(false);
    expect(program.sourceProgramId).toBe(sourceId);
    expect(program.sessions).toHaveLength(2);
    expect(program.sessions[0]?.exercises[0]?.exercise?.name).toBe('Tractions');

    // Modifier la copie ne touche pas au modèle.
    const input = programInput();
    input.title = 'Copie modifiée';
    input.sessions = [input.sessions[0]!];
    input.schedule = [0, null, null, null, null, null, null];

    await app.inject({
      method: 'PUT',
      url: `${API}/programs/${program.id}`,
      headers: authHeaders(session),
      payload: input,
    });

    const original = await app.inject({
      method: 'GET',
      url: `${API}/programs/${sourceId}`,
      headers: authHeaders(session),
    });
    expect(original.json().sessions).toHaveLength(2);
    expect(original.json().title).toBe('Prise de masse 3 séances');
  });
});

describe('suppression', () => {
  it('supprime le programme et tout son contenu', async () => {
    const session = await register(app);

    const created = await app.inject({
      method: 'POST',
      url: `${API}/programs`,
      headers: authHeaders(session),
      payload: programInput(),
    });
    const id = created.json().id;

    const removed = await app.inject({
      method: 'DELETE',
      url: `${API}/programs/${id}`,
      headers: authHeaders(session),
    });
    expect(removed.statusCode).toBe(204);

    expect(await db.select().from(sessions).where(eq(sessions.programId, id))).toHaveLength(0);
  });
});

describe('filtre des modèles', () => {
  it('« templates=false » ne renvoie pas les modèles', async () => {
    const session = await register(app);

    await app.inject({
      method: 'POST',
      url: `${API}/programs`,
      headers: authHeaders(session),
      payload: programInput({ isTemplate: true, title: 'Un modèle' }),
    });
    await app.inject({
      method: 'POST',
      url: `${API}/programs`,
      headers: authHeaders(session),
      payload: programInput({ title: 'Un programme' }),
    });

    const response = await app.inject({
      method: 'GET',
      url: `${API}/programs?templates=false`,
      headers: authHeaders(session),
    });

    const titles = response.json().items.map((item: { title: string }) => item.title);
    expect(titles).toEqual(['Un programme']);
  });
});
