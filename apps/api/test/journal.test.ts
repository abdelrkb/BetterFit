import { buildFoodSearchText } from '@betterfit/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { App } from '../src/app.js';
import { db } from '../src/db/client.js';
import { foods } from '../src/db/schema.js';
import { API, authHeaders, profileInput, register, startApp } from './helpers.js';

let app: App;

beforeAll(async () => {
  app = await startApp();
});

afterAll(async () => {
  await app.close();
});

/** Le riz de la table Ciqual : 130 kcal pour 100 g. */
async function insertRice(): Promise<string> {
  const name = 'Riz blanc, cuit, non salé';

  const [row] = await db
    .insert(foods)
    .values({
      source: 'ciqual',
      ownerId: null,
      externalId: `9644-${Math.random()}`,
      name,
      category: 'pâtes, riz et céréales',
      kcal: 130,
      proteinG: 2.7,
      carbsG: 28,
      fatG: 0.3,
      searchText: buildFoodSearchText({ name }),
    })
    .returning({ id: foods.id });

  return row!.id;
}

function add(
  session: Awaited<ReturnType<typeof register>>,
  body: Record<string, unknown>,
) {
  return app.inject({
    method: 'POST',
    url: `${API}/journal`,
    headers: authHeaders(session),
    payload: { date: '2026-10-29', slot: 'lunch', ...body },
  });
}

function day(session: Awaited<ReturnType<typeof register>>, date = '2026-10-29') {
  return app.inject({
    method: 'GET',
    url: `${API}/journal?date=${date}`,
    headers: authHeaders(session),
  });
}

describe('accès refusé', () => {
  const routes = [
    { method: 'GET' as const, url: `${API}/journal?date=2026-10-29` },
    { method: 'POST' as const, url: `${API}/journal`, payload: { date: '2026-10-29', slot: 'lunch', label: 'x' } },
    { method: 'GET' as const, url: `${API}/journal/recents` },
    { method: 'GET' as const, url: `${API}/favorites` },
  ];

  it.each(routes)('$method $url refuse sans jeton', async (route) => {
    expect((await app.inject(route)).statusCode).toBe(401);
  });

  it('ne laisse jamais voir le journal d’un autre', async () => {
    const julie = await register(app);
    const marc = await register(app, { email: 'marc@exemple.fr', name: 'Marc' });

    await add(julie, { label: 'Pizza', kcal: 800 });

    expect((await day(marc)).json().entries).toHaveLength(0);
  });

  it('ne laisse pas supprimer la ligne d’un autre', async () => {
    const julie = await register(app);
    const marc = await register(app, { email: 'marc@exemple.fr', name: 'Marc' });

    const created = await add(julie, { label: 'Pizza', kcal: 800 });
    const id = created.json().entries[0].id;

    const response = await app.inject({
      method: 'DELETE',
      url: `${API}/journal/${id}`,
      headers: authHeaders(marc),
    });

    expect(response.statusCode).toBe(404);
    expect((await day(julie)).json().entries).toHaveLength(1);
  });

  it('ne laisse pas loguer l’aliment perso d’un autre', async () => {
    const julie = await register(app);
    const marc = await register(app, { email: 'marc@exemple.fr', name: 'Marc' });

    const created = await app.inject({
      method: 'POST',
      url: `${API}/foods`,
      headers: authHeaders(julie),
      payload: { name: 'Barre de Julie', kcal: 400 },
    });

    const response = await add(marc, { foodId: created.json().id, quantityG: 100 });

    expect(response.statusCode).toBe(404);
  });
});

describe('saisie rapide', () => {
  it('accepte un nom et des calories, sans macros', async () => {
    const session = await register(app);

    // Au restaurant, on ne connaît jamais les macros.
    const response = await add(session, { label: 'Pizza du resto', kcal: 800 });

    expect(response.statusCode).toBe(201);
    expect(response.json().totals.kcal).toBe(800);
    expect(response.json().entries[0].label).toBe('Pizza du resto');
  });

  it('refuse une ligne sans nom ni aliment', async () => {
    const session = await register(app);

    const response = await add(session, { kcal: 500 });

    expect(response.statusCode).toBe(400);
    expect(response.json().code).toBe('journal/label-required');
  });
});

describe('depuis la base d’aliments', () => {
  it('calcule les valeurs depuis l’aliment et la quantité', async () => {
    const session = await register(app);
    const foodId = await insertRice();

    const response = await add(session, { foodId, quantityG: 160, quantityText: '160 g' });

    const entry = response.json().entries[0];
    expect(entry.kcal).toBe(208);
    expect(entry.proteinG).toBeCloseTo(4.3, 1);
    expect(entry.label).toBe('Riz blanc, cuit, non salé');
  });

  it('ignore les valeurs envoyées par l’app', async () => {
    const session = await register(app);
    const foodId = await insertRice();

    const response = await add(session, { foodId, quantityG: 160, kcal: 5 });

    // Le serveur fait foi : un client modifié ne doit pas pouvoir annoncer
    // 5 kcal pour 160 g de riz.
    expect(response.json().entries[0].kcal).toBe(208);
  });

  it('fige les valeurs : corriger l’aliment ne change pas le passé', async () => {
    const session = await register(app);
    const foodId = await insertRice();

    await add(session, { foodId, quantityG: 160 });

    // L'aliment change — une nouvelle version de la table, par exemple.
    const { eq } = await import('drizzle-orm');
    await db.update(foods).set({ kcal: 999 }).where(eq(foods.id, foodId));

    // La journée déjà passée ne bouge pas : on ne réécrit pas l'histoire de
    // ce que quelqu'un a mangé.
    expect((await day(session)).json().entries[0].kcal).toBe(208);
  });
});

describe('la journée', () => {
  it('sépare les quatre moments et totalise', async () => {
    const session = await register(app);

    await add(session, { slot: 'breakfast', label: 'Flocons', kcal: 300 });
    await add(session, { slot: 'lunch', label: 'Poulet riz', kcal: 650 });
    await add(session, { slot: 'snack', label: 'Pomme', kcal: 95 });
    await add(session, { slot: 'snack', label: 'Amandes', kcal: 170 });

    const result = (await day(session)).json();

    expect(result.totals.kcal).toBe(1215);
    expect(result.slotTotals.breakfast.kcal).toBe(300);
    expect(result.slotTotals.snack.kcal).toBe(265);
    expect(result.slotTotals.dinner.kcal).toBe(0);
  });

  it('ne mélange pas deux journées', async () => {
    const session = await register(app);

    await add(session, { date: '2026-10-29', label: 'Lundi', kcal: 500 });
    await add(session, { date: '2026-10-30', label: 'Mardi', kcal: 700 });

    expect((await day(session, '2026-10-29')).json().totals.kcal).toBe(500);
    expect((await day(session, '2026-10-30')).json().totals.kcal).toBe(700);
  });

  it('supprime une ligne', async () => {
    const session = await register(app);

    const created = await add(session, { label: 'Erreur', kcal: 900 });
    const id = created.json().entries[0].id;

    const response = await app.inject({
      method: 'DELETE',
      url: `${API}/journal/${id}`,
      headers: authHeaders(session),
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().totals.kcal).toBe(0);
  });
});

describe('les cibles', () => {
  it('fonctionne sans aucun programme, avec les cibles du profil', async () => {
    const session = await register(app);

    await app.inject({
      method: 'POST',
      url: `${API}/me/onboarding`,
      headers: authHeaders(session),
      payload: { ...profileInput, name: 'Julie', weightKg: 65 },
    });

    const result = (await day(session)).json();

    expect(result.targetsFrom).toBe('profile');
    expect(result.targets).not.toBeNull();
    expect(result.targets.targetKcal).toBeGreaterThan(1000);
  });

  it('préfère le programme de nutrition actif', async () => {
    const session = await register(app);

    await app.inject({
      method: 'POST',
      url: `${API}/me/onboarding`,
      headers: authHeaders(session),
      payload: { ...profileInput, name: 'Julie', weightKg: 65 },
    });

    await app.inject({
      method: 'POST',
      url: `${API}/nutrition-programs`,
      headers: authHeaders(session),
      payload: {
        title: 'Plan',
        settings: {
          sex: 'female',
          age: 30,
          weightKg: 65,
          heightCm: 168,
          activityLevel: 'moderate',
          deficitKcal: 400,
          proteinGPerKg: 2,
          fatGPerKg: 0.9,
        },
      },
    });

    const result = (await day(session)).json();

    expect(result.targetsFrom).toBe('program');
    expect(result.targets.targetKcal).toBe(1753);
  });

  it('se passe de cible quand le profil manque', async () => {
    const session = await register(app);

    const result = (await day(session)).json();

    // Le journal doit rester utilisable : on note ce qu'on mange même sans
    // objectif.
    expect(result.targetsFrom).toBe('none');
    expect(result.targets).toBeNull();
    expect(result.entries).toHaveLength(0);
  });
});

describe('recopier une journée', () => {
  it('recopie tout un jour vers un autre', async () => {
    const session = await register(app);

    await add(session, { slot: 'breakfast', label: 'Flocons', kcal: 300 });
    await add(session, { slot: 'lunch', label: 'Poulet', kcal: 650 });

    const response = await app.inject({
      method: 'POST',
      url: `${API}/journal/copy`,
      headers: authHeaders(session),
      payload: { from: '2026-10-29', to: '2026-10-30' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().totals.kcal).toBe(950);
    // L'original reste intact.
    expect((await day(session, '2026-10-29')).json().totals.kcal).toBe(950);
  });

  it('recopie un seul repas', async () => {
    const session = await register(app);

    await add(session, { slot: 'breakfast', label: 'Flocons', kcal: 300 });
    await add(session, { slot: 'lunch', label: 'Poulet', kcal: 650 });

    const response = await app.inject({
      method: 'POST',
      url: `${API}/journal/copy`,
      headers: authHeaders(session),
      payload: { from: '2026-10-29', to: '2026-10-30', slot: 'breakfast' },
    });

    expect(response.json().totals.kcal).toBe(300);
  });

  it('refuse de recopier une journée vide', async () => {
    const session = await register(app);

    const response = await app.inject({
      method: 'POST',
      url: `${API}/journal/copy`,
      headers: authHeaders(session),
      payload: { from: '2026-10-01', to: '2026-10-30' },
    });

    expect(response.statusCode).toBe(400);
  });
});

describe('récents et favoris', () => {
  it('rend les aliments logués récemment, une seule fois chacun', async () => {
    const session = await register(app);
    const foodId = await insertRice();

    await add(session, { foodId, quantityG: 100 });
    await add(session, { foodId, quantityG: 200 });
    await add(session, { label: 'Saisie rapide', kcal: 100 });

    const response = await app.inject({
      method: 'GET',
      url: `${API}/journal/recents`,
      headers: authHeaders(session),
    });

    // Une seule entrée pour le riz, et pas la saisie rapide, qui ne
    // correspond à aucun aliment réutilisable.
    expect(response.json().items).toHaveLength(1);
    expect(response.json().items[0].foodId).toBe(foodId);
  });

  it('met un aliment en favori, puis l’enlève', async () => {
    const session = await register(app);
    const foodId = await insertRice();

    const added = await app.inject({
      method: 'POST',
      url: `${API}/favorites/${foodId}`,
      headers: authHeaders(session),
    });
    expect(added.statusCode).toBe(204);

    const list = await app.inject({
      method: 'GET',
      url: `${API}/favorites`,
      headers: authHeaders(session),
    });
    expect(list.json().items).toHaveLength(1);

    await app.inject({
      method: 'DELETE',
      url: `${API}/favorites/${foodId}`,
      headers: authHeaders(session),
    });

    const after = await app.inject({
      method: 'GET',
      url: `${API}/favorites`,
      headers: authHeaders(session),
    });
    expect(after.json().items).toHaveLength(0);
  });

  it('ne met pas deux fois le même favori', async () => {
    const session = await register(app);
    const foodId = await insertRice();

    await app.inject({
      method: 'POST',
      url: `${API}/favorites/${foodId}`,
      headers: authHeaders(session),
    });
    await app.inject({
      method: 'POST',
      url: `${API}/favorites/${foodId}`,
      headers: authHeaders(session),
    });

    const list = await app.inject({
      method: 'GET',
      url: `${API}/favorites`,
      headers: authHeaders(session),
    });
    expect(list.json().items).toHaveLength(1);
  });

  it('ne laisse pas mettre en favori l’aliment d’un autre', async () => {
    const julie = await register(app);
    const marc = await register(app, { email: 'marc@exemple.fr', name: 'Marc' });

    const created = await app.inject({
      method: 'POST',
      url: `${API}/foods`,
      headers: authHeaders(julie),
      payload: { name: 'Barre de Julie', kcal: 400 },
    });

    const response = await app.inject({
      method: 'POST',
      url: `${API}/favorites/${created.json().id}`,
      headers: authHeaders(marc),
    });

    expect(response.statusCode).toBe(404);
  });
});
