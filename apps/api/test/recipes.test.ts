import { recipeSchema, type RecipeInput } from '@betterfit/shared';
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

/** Un PNG d'un pixel : assez pour vérifier le trajet complet d'une photo. */
const PIXEL_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

function recipe(overrides: Partial<RecipeInput> = {}): RecipeInput {
  return {
    title: 'Poulet basmati',
    category: 'Déjeuner',
    prepMinutes: 10,
    cookMinutes: 20,
    servings: 2,
    kcal: 520,
    proteinG: 45,
    carbsG: 55,
    fatG: 12,
    tip: 'Fais mariner le poulet la veille.',
    ingredients: [
      { foodId: null, label: 'Blanc de poulet', quantity: '300 g', quantityG: 300 },
      { foodId: null, label: 'Riz basmati', quantity: '160 g', quantityG: 160 },
    ],
    steps: ['Fais cuire le riz.', 'Poêle le poulet.', 'Mélange et sers.'],
    ...overrides,
  };
}

function create(session: Awaited<ReturnType<typeof register>>, body: unknown = recipe()) {
  return app.inject({
    method: 'POST',
    url: `${API}/recipes`,
    headers: authHeaders(session),
    payload: body as Record<string, unknown>,
  });
}

describe('accès refusé', () => {
  const routes = [
    { method: 'GET' as const, url: `${API}/recipes` },
    { method: 'POST' as const, url: `${API}/recipes`, payload: recipe() },
    { method: 'GET' as const, url: `${API}/prices?labels=riz` },
  ];

  it.each(routes)('$method $url refuse sans jeton', async (route) => {
    expect((await app.inject(route)).statusCode).toBe(401);
  });

  it('ne laisse pas voir, modifier ni supprimer la recette d’un autre', async () => {
    const julie = await register(app);
    const marc = await register(app, { email: 'marc@exemple.fr', name: 'Marc' });

    const id = (await create(julie)).json().id;

    for (const route of [
      { method: 'GET' as const, url: `${API}/recipes/${id}` },
      { method: 'PUT' as const, url: `${API}/recipes/${id}`, payload: recipe() },
      { method: 'DELETE' as const, url: `${API}/recipes/${id}` },
    ]) {
      const response = await app.inject({ ...route, headers: authHeaders(marc) });
      expect(response.statusCode).toBe(404);
    }

    const list = await app.inject({
      method: 'GET',
      url: `${API}/recipes`,
      headers: authHeaders(marc),
    });
    expect(list.json().items).toHaveLength(0);
  });
});

describe('enregistrement', () => {
  it('garde ingrédients et étapes dans l’ordre', async () => {
    const session = await register(app);
    const saved = recipeSchema.parse((await create(session)).json());

    expect(saved.ingredients.map((item) => item.label)).toEqual([
      'Blanc de poulet',
      'Riz basmati',
    ]);
    expect(saved.steps).toEqual(['Fais cuire le riz.', 'Poêle le poulet.', 'Mélange et sers.']);
    expect(saved.photoUrl).toBeNull();
  });

  it('remplace tout le contenu à l’enregistrement', async () => {
    const session = await register(app);
    const id = (await create(session)).json().id;

    const response = await app.inject({
      method: 'PUT',
      url: `${API}/recipes/${id}`,
      headers: authHeaders(session),
      payload: recipe({ title: 'Revue', ingredients: [], steps: ['Une seule étape.'] }),
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().title).toBe('Revue');
    expect(response.json().ingredients).toHaveLength(0);
    expect(response.json().steps).toHaveLength(1);
  });

  it('refuse une recette sans titre', async () => {
    const session = await register(app);

    expect((await create(session, recipe({ title: '' }))).statusCode).toBe(400);
  });
});

describe('photo', () => {
  it('accepte une photo et rend une adresse signée', async () => {
    const session = await register(app);
    const saved = (await create(session, { ...recipe(), photoDataUrl: PIXEL_PNG })).json();

    expect(saved.photoUrl).toMatch(/\/recipes\/photos\/.+\.png\?expires=\d+&token=.+/);
  });

  it('sert la photo sans jeton d’authentification, grâce à la signature', async () => {
    const session = await register(app);
    const saved = (await create(session, { ...recipe(), photoDataUrl: PIXEL_PNG })).json();

    // Pas d'en-tête `authorization` : une balise <img> n'en envoie pas.
    const response = await app.inject({ method: 'GET', url: saved.photoUrl });

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toBe('image/png');
  });

  it('refuse une signature trafiquée', async () => {
    const session = await register(app);
    const saved = (await create(session, { ...recipe(), photoDataUrl: PIXEL_PNG })).json();

    const tampered = String(saved.photoUrl).replace(/token=.+$/, 'token=inventé');
    expect((await app.inject({ method: 'GET', url: tampered })).statusCode).toBe(404);
  });

  it('refuse une signature expirée', async () => {
    const session = await register(app);
    const saved = (await create(session, { ...recipe(), photoDataUrl: PIXEL_PNG })).json();

    const expired = String(saved.photoUrl).replace(/expires=\d+/, 'expires=1000000000');
    expect((await app.inject({ method: 'GET', url: expired })).statusCode).toBe(404);
  });

  it('refuse un format d’image qu’on ne sert pas', async () => {
    const session = await register(app);

    const response = await create(session, {
      ...recipe(),
      photoDataUrl: 'data:image/gif;base64,R0lGODlhAQABAAAAACw=',
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().code).toBe('recipe/bad-photo-format');
  });

  it('ne laisse pas remonter dans les dossiers', async () => {
    const response = await app.inject({
      method: 'GET',
      url: `${API}/recipes/photos/..%2F..%2F.env?expires=9999999999&token=peu-importe`,
    });

    expect(response.statusCode).toBe(404);
  });

  it('efface la photo quand on envoie null', async () => {
    const session = await register(app);
    const id = (await create(session, { ...recipe(), photoDataUrl: PIXEL_PNG })).json().id;

    const response = await app.inject({
      method: 'PUT',
      url: `${API}/recipes/${id}`,
      headers: authHeaders(session),
      payload: { ...recipe(), photoDataUrl: null },
    });

    expect(response.json().photoUrl).toBeNull();
  });

  it('garde la photo quand on ne parle pas d’elle', async () => {
    const session = await register(app);
    const id = (await create(session, { ...recipe(), photoDataUrl: PIXEL_PNG })).json().id;

    const response = await app.inject({
      method: 'PUT',
      url: `${API}/recipes/${id}`,
      headers: authHeaders(session),
      payload: recipe({ title: 'Sans toucher à la photo' }),
    });

    expect(response.json().photoUrl).not.toBeNull();
  });
});

describe('prix', () => {
  it('mémorise un prix et le rend ensuite', async () => {
    const session = await register(app);

    const saved = await app.inject({
      method: 'POST',
      url: `${API}/prices`,
      headers: authHeaders(session),
      payload: { label: 'Blanc de Poulet', store: 'Lidl', priceCents: 899, unit: 'le kilo' },
    });
    expect(saved.statusCode).toBe(204);

    // La casse et les accents ne doivent pas empêcher de le retrouver.
    const response = await app.inject({
      method: 'GET',
      url: `${API}/prices?labels=blanc%20de%20poulet`,
      headers: authHeaders(session),
    });

    expect(response.json().items).toHaveLength(1);
    expect(response.json().items[0].priceCents).toBe(899);
    expect(response.json().items[0].source).toBe('manual');
  });

  it('met à jour le prix au lieu d’en empiler un deuxième', async () => {
    const session = await register(app);
    const price = { label: 'Riz basmati', store: 'Lidl', priceCents: 250, unit: 'le kilo' };

    await app.inject({
      method: 'POST',
      url: `${API}/prices`,
      headers: authHeaders(session),
      payload: price,
    });
    await app.inject({
      method: 'POST',
      url: `${API}/prices`,
      headers: authHeaders(session),
      payload: { ...price, priceCents: 279 },
    });

    const response = await app.inject({
      method: 'GET',
      url: `${API}/prices?labels=riz basmati`,
      headers: authHeaders(session),
    });

    expect(response.json().items).toHaveLength(1);
    expect(response.json().items[0].priceCents).toBe(279);
  });

  it('ne rend jamais les prix saisis par quelqu’un d’autre', async () => {
    const julie = await register(app);
    const marc = await register(app, { email: 'marc@exemple.fr', name: 'Marc' });

    await app.inject({
      method: 'POST',
      url: `${API}/prices`,
      headers: authHeaders(julie),
      payload: { label: 'Saumon', store: 'Monoprix', priceCents: 1890, unit: 'les 200 g' },
    });

    const response = await app.inject({
      method: 'GET',
      url: `${API}/prices?labels=saumon`,
      headers: authHeaders(marc),
    });

    expect(response.json().items).toHaveLength(0);
  });
});
