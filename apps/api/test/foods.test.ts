import { buildFoodSearchText, foodSchema, type CustomFoodInput } from '@betterfit/shared';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { App } from '../src/app.js';
import { db } from '../src/db/client.js';
import { foods } from '../src/db/schema.js';
import { API, authHeaders, register, startApp } from './helpers.js';

let app: App;

beforeAll(async () => {
  app = await startApp();
});

afterAll(async () => {
  await app.close();
});

/** Quelques aliments Ciqual, avec leurs vraies valeurs. */
beforeEach(async () => {
  await db.insert(foods).values(
    [
      { externalId: '9644', name: 'Riz blanc, cuit, non salé', category: 'pâtes, riz et céréales', kcal: 130, proteinG: 2.7, carbsG: 28, fatG: 0.3 },
      { externalId: '36018', name: 'Blanc de poulet, rôti', category: 'viandes', kcal: 165, proteinG: 31, carbsG: 0, fatG: 3.6 },
      { externalId: '19024', name: 'Crème fraîche épaisse', category: 'produits laitiers', kcal: 300, proteinG: 2.3, carbsG: 3, fatG: 30 },
    ].map((food) => ({
      source: 'ciqual' as const,
      ownerId: null,
      barcode: null,
      ...food,
      searchText: buildFoodSearchText(food),
    })),
  );
});

function customFood(overrides: Partial<CustomFoodInput> = {}): CustomFoodInput {
  return {
    name: 'Ma barre maison',
    brand: '',
    category: 'Collations',
    kcal: 420,
    proteinG: 18,
    carbsG: 45,
    sugarsG: 12,
    fatG: 16,
    saturatedFatG: 3,
    fiberG: 6,
    saltG: 0.2,
    servingLabel: 'une barre',
    servingG: 60,
    barcode: null,
    ...overrides,
  };
}

function search(session: Awaited<ReturnType<typeof register>>, query: string) {
  return app.inject({
    method: 'GET',
    url: `${API}/foods?${query}`,
    headers: authHeaders(session),
  });
}

describe('accès refusé', () => {
  const routes = [
    { method: 'GET' as const, url: `${API}/foods` },
    { method: 'POST' as const, url: `${API}/foods`, payload: customFood() },
    { method: 'GET' as const, url: `${API}/foods/barcode/3017620422003` },
  ];

  it.each(routes)('$method $url refuse sans jeton', async (route) => {
    expect((await app.inject(route)).statusCode).toBe(401);
  });

  it('ne laisse pas voir, modifier ni supprimer l’aliment d’un autre', async () => {
    const julie = await register(app);
    const marc = await register(app, { email: 'marc@exemple.fr', name: 'Marc' });

    const created = await app.inject({
      method: 'POST',
      url: `${API}/foods`,
      headers: authHeaders(julie),
      payload: customFood(),
    });
    const id = created.json().id;

    for (const route of [
      { method: 'GET' as const, url: `${API}/foods/${id}` },
      { method: 'PUT' as const, url: `${API}/foods/${id}`, payload: customFood() },
      { method: 'DELETE' as const, url: `${API}/foods/${id}` },
    ]) {
      const response = await app.inject({ ...route, headers: authHeaders(marc) });
      expect(response.statusCode).toBe(404);
    }
  });

  it('n’expose pas l’aliment perso d’un autre dans la recherche', async () => {
    const julie = await register(app);
    const marc = await register(app, { email: 'marc@exemple.fr', name: 'Marc' });

    await app.inject({
      method: 'POST',
      url: `${API}/foods`,
      headers: authHeaders(julie),
      payload: customFood({ name: 'Barre secrète de Julie' }),
    });

    const response = await search(marc, 'q=barre');
    expect(response.json().items).toHaveLength(0);
  });

  it('ne laisse personne réécrire la base Ciqual', async () => {
    const session = await register(app);

    const [ciqual] = await db.select().from(foods).limit(1);

    const response = await app.inject({
      method: 'PUT',
      url: `${API}/foods/${ciqual!.id}`,
      headers: authHeaders(session),
      payload: customFood({ name: 'Riz truqué', kcal: 1 }),
    });

    expect(response.statusCode).toBe(404);

    const [unchanged] = await db.select().from(foods).limit(1);
    expect(unchanged!.name).toBe('Riz blanc, cuit, non salé');
  });
});

describe('recherche', () => {
  it('trouve un aliment par son nom', async () => {
    const session = await register(app);

    const response = await search(session, 'q=riz');

    expect(response.statusCode).toBe(200);
    expect(response.json().items[0].name).toBe('Riz blanc, cuit, non salé');
  });

  it('trouve malgré les accents manquants', async () => {
    const session = await register(app);

    // Personne ne tape « crème fraîche » avec ses accents sur un téléphone.
    const response = await search(session, 'q=creme fraiche');

    expect(response.json().items[0].name).toBe('Crème fraîche épaisse');
  });

  it('trouve malgré une faute de frappe', async () => {
    const session = await register(app);

    const response = await search(session, 'q=poullet');

    expect(response.json().items.length).toBeGreaterThan(0);
    expect(response.json().items[0].name).toContain('poulet');
  });

  it('rend les valeurs pour 100 g', async () => {
    const session = await register(app);

    const food = foodSchema.parse((await search(session, 'q=riz')).json().items[0]);

    expect(food.kcal).toBe(130);
    expect(food.proteinG).toBeCloseTo(2.7, 1);
    expect(food.source).toBe('ciqual');
  });

  it('ne rend rien pour une recherche qui ne correspond à rien', async () => {
    const session = await register(app);

    expect((await search(session, 'q=zzzzqqqq')).json().items).toHaveLength(0);
  });

  it('mélange base partagée et aliments perso', async () => {
    const session = await register(app);

    await app.inject({
      method: 'POST',
      url: `${API}/foods`,
      headers: authHeaders(session),
      payload: customFood({ name: 'Riz de ma recette' }),
    });

    const names = (await search(session, 'q=riz')).json().items.map((f: { name: string }) => f.name);

    expect(names).toContain('Riz blanc, cuit, non salé');
    expect(names).toContain('Riz de ma recette');
  });

  it('peut ne montrer que mes aliments', async () => {
    const session = await register(app);

    await app.inject({
      method: 'POST',
      url: `${API}/foods`,
      headers: authHeaders(session),
      payload: customFood(),
    });

    const response = await search(session, 'mine=true');

    expect(response.json().items).toHaveLength(1);
    expect(response.json().items[0].source).toBe('custom');
  });
});

describe('aliments perso', () => {
  it('crée, modifie et supprime', async () => {
    const session = await register(app);

    const created = await app.inject({
      method: 'POST',
      url: `${API}/foods`,
      headers: authHeaders(session),
      payload: customFood(),
    });
    expect(created.statusCode).toBe(201);
    const id = created.json().id;

    const updated = await app.inject({
      method: 'PUT',
      url: `${API}/foods/${id}`,
      headers: authHeaders(session),
      payload: customFood({ name: 'Ma barre revue', kcal: 400 }),
    });
    expect(updated.json().name).toBe('Ma barre revue');
    expect(updated.json().kcal).toBe(400);

    const removed = await app.inject({
      method: 'DELETE',
      url: `${API}/foods/${id}`,
      headers: authHeaders(session),
    });
    expect(removed.statusCode).toBe(204);

    const gone = await app.inject({
      method: 'GET',
      url: `${API}/foods/${id}`,
      headers: authHeaders(session),
    });
    expect(gone.statusCode).toBe(404);
  });

  it('refuse un nom trop court', async () => {
    const session = await register(app);

    const response = await app.inject({
      method: 'POST',
      url: `${API}/foods`,
      headers: authHeaders(session),
      payload: customFood({ name: 'x' }),
    });

    expect(response.statusCode).toBe(400);
  });

  it('refuse un code-barres qui n’en est pas un', async () => {
    const session = await register(app);

    const response = await app.inject({
      method: 'POST',
      url: `${API}/foods`,
      headers: authHeaders(session),
      payload: { ...customFood(), barcode: 'abc' },
    });

    expect(response.statusCode).toBe(400);
  });

  it('accepte un aliment sans aucune valeur nutritionnelle', async () => {
    const session = await register(app);

    const response = await app.inject({
      method: 'POST',
      url: `${API}/foods`,
      headers: authHeaders(session),
      payload: { name: 'Plat du resto' },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json().kcal).toBeNull();
  });
});

describe('code-barres', () => {
  it('retrouve un produit déjà enregistré', async () => {
    const session = await register(app);

    await app.inject({
      method: 'POST',
      url: `${API}/foods`,
      headers: authHeaders(session),
      payload: customFood({ name: 'Skyr nature', barcode: '3033710065967' }),
    });

    const response = await app.inject({
      method: 'GET',
      url: `${API}/foods/barcode/3033710065967`,
      headers: authHeaders(session),
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().name).toBe('Skyr nature');
  });

  it('répond 404 pour un code inconnu', async () => {
    const session = await register(app);

    const response = await app.inject({
      method: 'GET',
      url: `${API}/foods/barcode/3017620422003`,
      headers: authHeaders(session),
    });

    expect(response.statusCode).toBe(404);
  });
});
