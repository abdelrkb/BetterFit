import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { App } from '../src/app.js';
import { closePdfRenderer } from '../src/pdf/render.js';
import { API, authHeaders, register, startApp } from './helpers.js';

let app: App;

beforeAll(async () => {
  app = await startApp();
});

afterAll(async () => {
  await app.close();
  await closePdfRenderer();
});

const nutritionProgram = {
  title: 'Sèche de printemps',
  settings: {
    sex: 'female' as const,
    age: 30,
    weightKg: 65,
    heightCm: 168,
    activityLevel: 'moderate' as const,
    deficitKcal: 400,
    proteinGPerKg: 2,
    fatGPerKg: 0.9,
    goalTitle: 'Perte de gras',
    coachNote: 'Bois avant d’avoir soif.',
    preferred: ['Légumes verts'],
    limited: ['Sodas'],
  },
  meals: [
    {
      name: 'Petit-déjeuner',
      time: '07h30',
      items: [
        { label: 'Flocons d’avoine', quantity: '60 g', kcal: 228, alternative: 'Pain complet' },
      ],
    },
  ],
  shopping: [
    {
      name: 'Protéines',
      items: [{ label: 'Blanc de poulet', quantity: '1 kg', priceCents: 899, store: 'Lidl' }],
    },
  ],
};

async function createExercise() {
  const { db } = await import('../src/db/client.js');
  const { exercises } = await import('../src/db/schema.js');
  const { buildSearchText } = await import('../src/exercises/search-text.js');

  const [row] = await db
    .insert(exercises)
    .values({
      source: 'library',
      externalId: `squat-${Math.random()}`,
      name: 'Squat à la barre',
      primaryMuscles: ['quadriceps'],
      equipment: 'barbell',
      level: 'intermediate',
      category: 'strength',
      searchText: buildSearchText({ name: 'Squat à la barre' }),
    })
    .returning({ id: exercises.id });

  return row!.id;
}

async function createTrainingProgram(session: Awaited<ReturnType<typeof register>>) {
  const exerciseId = await createExercise();

  const response = await app.inject({
    method: 'POST',
    url: `${API}/programs`,
    headers: authHeaders(session),
    payload: {
      title: 'Prise de masse',
      details: { goal: 'gain_muscle', level: 'intermediate', coachNote: 'La technique d’abord.' },
      sessions: [
        {
          name: 'Bas du corps',
          targetMuscles: ['quadriceps'],
          warmup: 'Dix minutes de vélo.',
          exercises: [
            { exerciseId, sets: 4, reps: '8', load: '80 kg', restSeconds: 120, notes: '' },
          ],
        },
      ],
      schedule: [0, null, null, 0, null, null, null],
    },
  });

  return response.json().id as string;
}

/** Demande un lien signé, puis le suit. C'est ce que fait l'app. */
async function fetchPdf(
  session: Awaited<ReturnType<typeof register>>,
  kind: 'training' | 'nutrition',
  id: string,
  pages?: string[],
) {
  const link = await app.inject({
    method: 'POST',
    url: `${API}/pdf/${kind}/${id}/link`,
    headers: authHeaders(session),
    payload: pages ? { pages } : {},
  });

  if (link.statusCode !== 200) return link;

  return app.inject({ method: 'GET', url: link.json().url });
}

/** Un PDF commence par « %PDF- » : on vérifie l'octet, pas l'en-tête HTTP. */
function isPdf(body: Buffer | string): boolean {
  return Buffer.from(body).subarray(0, 5).toString('latin1') === '%PDF-';
}

describe('accès refusé', () => {
  it('refuse de délivrer un lien sans jeton', async () => {
    const session = await register(app);
    const id = await createTrainingProgram(session);

    const response = await app.inject({ method: 'POST', url: `${API}/pdf/training/${id}/link` });
    expect(response.statusCode).toBe(401);
  });

  it('refuse un lien non signé', async () => {
    const session = await register(app);
    const id = await createTrainingProgram(session);

    const response = await app.inject({
      method: 'GET',
      url: `${API}/pdf/training/${id}?user=${session.user.id}&expires=9999999999&token=invente`,
    });

    expect(response.statusCode).toBe(404);
  });

  it('refuse un lien expiré', async () => {
    const session = await register(app);
    const id = await createTrainingProgram(session);

    const link = await app.inject({
      method: 'POST',
      url: `${API}/pdf/training/${id}/link`,
      headers: authHeaders(session),
      payload: {},
    });

    const expired = String(link.json().url).replace(/expires=\d+/, 'expires=1000000000');
    expect((await app.inject({ method: 'GET', url: expired })).statusCode).toBe(404);
  });

  it('ne laisse pas exporter le programme d’un autre', async () => {
    const julie = await register(app);
    const marc = await register(app, { email: 'marc@exemple.fr', name: 'Marc' });

    const id = await createTrainingProgram(julie);

    const response = await fetchPdf(marc, 'training', id);

    expect(response.statusCode).toBe(404);
  });

  it('ne laisse pas exporter le plan alimentaire d’un autre', async () => {
    const julie = await register(app);
    const marc = await register(app, { email: 'marc@exemple.fr', name: 'Marc' });

    const created = await app.inject({
      method: 'POST',
      url: `${API}/nutrition-programs`,
      headers: authHeaders(julie),
      payload: nutritionProgram,
    });

    const response = await fetchPdf(marc, 'nutrition', created.json().id);

    expect(response.statusCode).toBe(404);
  });
});

describe('PDF de musculation', () => {
  it('produit un vrai PDF', async () => {
    const session = await register(app);
    const id = await createTrainingProgram(session);

    const response = await fetchPdf(session, 'training', id);

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('application/pdf');
    expect(isPdf(response.rawPayload)).toBe(true);
    // Un document de plusieurs pages pèse forcément plus que quelques octets.
    expect(response.rawPayload.byteLength).toBeGreaterThan(10_000);
  });

  it('propose un nom de fichier lisible', async () => {
    const session = await register(app);
    const id = await createTrainingProgram(session);

    const response = await fetchPdf(session, 'training', id);

    expect(response.headers['content-disposition']).toContain('prise-de-masse-muscu.pdf');
  });

  it('n’inclut que les pages demandées', async () => {
    const session = await register(app);
    const id = await createTrainingProgram(session);

    const full = await fetchPdf(session, 'training', id);
    const coverOnly = await fetchPdf(session, 'training', id, ['cover']);

    expect(coverOnly.statusCode).toBe(200);
    expect(coverOnly.rawPayload.byteLength).toBeLessThan(full.rawPayload.byteLength);
  });

  it('rend tout le document quand les pages demandées n’existent pas', async () => {
    const session = await register(app);
    const id = await createTrainingProgram(session);

    const response = await fetchPdf(session, 'training', id, ['nimportequoi']);

    // Mieux vaut un document complet qu'un document vide.
    expect(response.statusCode).toBe(200);
    expect(isPdf(response.rawPayload)).toBe(true);
  });
});

describe('PDF de nutrition', () => {
  it('produit un vrai PDF', async () => {
    const session = await register(app);

    const created = await app.inject({
      method: 'POST',
      url: `${API}/nutrition-programs`,
      headers: authHeaders(session),
      payload: nutritionProgram,
    });

    const response = await fetchPdf(session, 'nutrition', created.json().id);

    expect(response.statusCode).toBe(200);
    expect(isPdf(response.rawPayload)).toBe(true);
    expect(response.headers['content-disposition']).toContain('seche-de-printemps-nutrition.pdf');
  });

  it('exporte aussi un plan sans repas ni courses', async () => {
    const session = await register(app);

    const created = await app.inject({
      method: 'POST',
      url: `${API}/nutrition-programs`,
      headers: authHeaders(session),
      payload: { ...nutritionProgram, meals: [], shopping: [] },
    });

    const response = await fetchPdf(session, 'nutrition', created.json().id);

    expect(response.statusCode).toBe(200);
    expect(isPdf(response.rawPayload)).toBe(true);
  });

  it('ne laisse pas réutiliser le lien d’un autre en changeant l’identifiant', async () => {
    const julie = await register(app);
    const marc = await register(app, { email: 'marc@exemple.fr', name: 'Marc' });

    const hers = await app.inject({
      method: 'POST',
      url: `${API}/nutrition-programs`,
      headers: authHeaders(julie),
      payload: nutritionProgram,
    });

    const his = await app.inject({
      method: 'POST',
      url: `${API}/nutrition-programs`,
      headers: authHeaders(marc),
      payload: nutritionProgram,
    });

    const link = await app.inject({
      method: 'POST',
      url: `${API}/pdf/nutrition/${his.json().id}/link`,
      headers: authHeaders(marc),
      payload: {},
    });

    // Marc change l'identifiant du programme dans son propre lien : la
    // signature ne couvre plus l'adresse, elle doit être refusée.
    const detourned = String(link.json().url).replace(his.json().id, hers.json().id);

    expect((await app.inject({ method: 'GET', url: detourned })).statusCode).toBe(404);
  });
});
