import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { App } from '../src/app.js';
import { API, authHeaders, register, startApp } from './helpers.js';

let app: App;

beforeAll(async () => {
  app = await startApp();
});

afterAll(async () => {
  await app.close();
});

function post(session: Awaited<ReturnType<typeof register>>, body: Record<string, unknown>) {
  return app.inject({
    method: 'POST',
    url: `${API}/me/weight`,
    headers: authHeaders(session),
    payload: body,
  });
}

function history(session: Awaited<ReturnType<typeof register>>) {
  return app.inject({ method: 'GET', url: `${API}/me/weight`, headers: authHeaders(session) });
}

describe('accès refusé', () => {
  const routes = [
    { method: 'GET' as const, url: `${API}/me/weight` },
    { method: 'POST' as const, url: `${API}/me/weight`, payload: { weightKg: 78 } },
    { method: 'DELETE' as const, url: `${API}/me/weight/2026-10-20` },
  ];

  it.each(routes)('$method $url refuse sans jeton', async (route) => {
    expect((await app.inject(route)).statusCode).toBe(401);
  });

  it.each(routes)('$method $url refuse un jeton inventé', async (route) => {
    const response = await app.inject({
      ...route,
      headers: { authorization: 'Bearer ce-nest-pas-un-jeton' },
    });
    expect(response.statusCode).toBe(401);
  });

  it('ne laisse jamais voir les pesées d’un autre compte', async () => {
    const julie = await register(app);
    const marc = await register(app, { email: 'marc@exemple.fr', name: 'Marc' });

    await post(julie, { weightKg: 68.4, date: '2026-10-20' });

    const response = await history(marc);
    expect(response.statusCode).toBe(200);
    expect(response.json().points).toHaveLength(0);
    expect(response.json().latestWeightKg).toBeNull();
  });

  it('ne laisse pas supprimer la pesée d’un autre', async () => {
    const julie = await register(app);
    const marc = await register(app, { email: 'marc@exemple.fr', name: 'Marc' });

    await post(julie, { weightKg: 68.4, date: '2026-10-20' });

    const removed = await app.inject({
      method: 'DELETE',
      url: `${API}/me/weight/2026-10-20`,
      headers: authHeaders(marc),
    });
    expect(removed.statusCode).toBe(404);

    // Celle de Julie est toujours là.
    expect((await history(julie)).json().points).toHaveLength(1);
  });
});

describe('POST /me/weight', () => {
  it('enregistre une pesée et la rend avec sa tendance', async () => {
    const session = await register(app);

    const response = await post(session, { weightKg: 78.6, date: '2026-10-20' });

    expect(response.statusCode).toBe(200);
    expect(response.json().latestWeightKg).toBeCloseTo(78.6, 1);
    expect(response.json().points[0].trendKg).toBeCloseTo(78.6, 1);
  });

  it('corrige la pesée du jour au lieu d’en ajouter une seconde', async () => {
    const session = await register(app);

    await post(session, { weightKg: 79, date: '2026-10-20' });
    const second = await post(session, { weightKg: 78.2, date: '2026-10-20' });

    expect(second.json().points).toHaveLength(1);
    expect(second.json().latestWeightKg).toBeCloseTo(78.2, 1);
  });

  it('prend aujourd’hui quand aucune date n’est donnée', async () => {
    const session = await register(app);

    const response = await post(session, { weightKg: 80 });

    expect(response.json().points[0].date).toBe(new Date().toISOString().slice(0, 10));
  });

  it('refuse un poids aberrant', async () => {
    const session = await register(app);

    const response = await post(session, { weightKg: 7 });

    expect(response.statusCode).toBe(400);
    expect(response.json().fields).toHaveProperty('weightKg');
  });

  it('refuse une date mal formée', async () => {
    const session = await register(app);

    expect((await post(session, { weightKg: 78, date: '20/10/2026' })).statusCode).toBe(400);
  });

  it('annonce la variation hebdomadaire une fois la semaine passée', async () => {
    const session = await register(app);

    await post(session, { weightKg: 80, date: '2026-10-01' });
    const response = await post(session, { weightKg: 78.5, date: '2026-10-15' });

    expect(response.json().weeklyChangeKg).toBeCloseTo(-1.5, 1);
  });

  it('ne tire aucune conclusion de deux pesées rapprochées', async () => {
    const session = await register(app);

    await post(session, { weightKg: 80, date: '2026-10-01' });
    const response = await post(session, { weightKg: 78.5, date: '2026-10-03' });

    expect(response.json().weeklyChangeKg).toBeNull();
  });
});

describe('GET /me/weight', () => {
  it('rend les pesées du plus ancien au plus récent', async () => {
    const session = await register(app);

    await post(session, { weightKg: 79, date: '2026-10-15' });
    await post(session, { weightKg: 80, date: '2026-10-01' });

    const points = (await history(session)).json().points;
    expect(points.map((point: { date: string }) => point.date)).toEqual([
      '2026-10-01',
      '2026-10-15',
    ]);
  });

  it('ne remonte pas au-delà de la fenêtre demandée', async () => {
    const session = await register(app);

    await post(session, { weightKg: 90, date: '2020-01-01' });
    await post(session, { weightKg: 80 });

    const response = await app.inject({
      method: 'GET',
      url: `${API}/me/weight?days=30`,
      headers: authHeaders(session),
    });

    expect(response.json().points).toHaveLength(1);
    expect(response.json().latestWeightKg).toBe(80);
  });
});

describe('DELETE /me/weight/:date', () => {
  it('efface une pesée', async () => {
    const session = await register(app);

    await post(session, { weightKg: 79, date: '2026-10-15' });
    await post(session, { weightKg: 80, date: '2026-10-01' });

    const response = await app.inject({
      method: 'DELETE',
      url: `${API}/me/weight/2026-10-15`,
      headers: authHeaders(session),
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().points).toHaveLength(1);
    expect(response.json().latestWeightKg).toBe(80);
  });

  it('répond 404 pour un jour sans pesée', async () => {
    const session = await register(app);

    const response = await app.inject({
      method: 'DELETE',
      url: `${API}/me/weight/2026-10-15`,
      headers: authHeaders(session),
    });

    expect(response.statusCode).toBe(404);
  });
});
