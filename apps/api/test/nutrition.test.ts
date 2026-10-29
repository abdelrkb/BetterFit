import {
  nutritionProgramSchema,
  type NutritionProgramInput,
  type NutritionSettings,
} from '@betterfit/shared';
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

/** Le client exemple du prototype. */
const settings: NutritionSettings = {
  sex: 'female',
  age: 30,
  weightKg: 65,
  heightCm: 168,
  activityLevel: 'moderate',
  deficitKcal: 400,
  proteinGPerKg: 2,
  fatGPerKg: 0.9,
  fiberG: 30,
  waterLiters: null,
  goalTitle: 'Perte de gras',
  goalText: 'On vise 400 g par semaine, sans jamais avoir faim.',
  preferred: ['Légumes verts', 'Poisson blanc'],
  limited: ['Sodas'],
  coachNote: 'Bois avant d’avoir soif.',
  shoppingDays: 7,
  budgetCents: null,
};

function program(overrides: Partial<NutritionProgramInput> = {}): NutritionProgramInput {
  return {
    title: 'Plan de Julie',
    isTemplate: false,
    startDate: null,
    endDate: null,
    settings,
    meals: [
      {
        name: 'Petit-déjeuner',
        time: '07h30',
        kcalOverride: null,
        items: [
          {
            foodId: null,
            label: 'Flocons d’avoine',
            quantity: '60 g',
            quantityG: 60,
            alternative: 'Pain complet',
            kcal: 228,
            proteinG: 8.1,
            carbsG: 36,
            fatG: 4.2,
          },
        ],
      },
      {
        name: 'Déjeuner',
        time: '12h30',
        kcalOverride: 650,
        items: [
          {
            foodId: null,
            label: 'Légumes',
            quantity: 'à volonté',
            quantityG: null,
            alternative: '',
            kcal: null,
            proteinG: null,
            carbsG: null,
            fatG: null,
          },
        ],
      },
    ],
    shopping: [
      {
        name: 'Protéines',
        items: [
          {
            label: 'Blanc de poulet',
            quantity: '1 kg',
            checked: false,
            priceCents: 899,
            store: 'Lidl',
          },
        ],
      },
    ],
    recipeIds: [],
    ...overrides,
  };
}

function create(session: Awaited<ReturnType<typeof register>>, input = program()) {
  return app.inject({
    method: 'POST',
    url: `${API}/nutrition-programs`,
    headers: authHeaders(session),
    payload: input,
  });
}

describe('accès refusé', () => {
  it('refuse sans jeton', async () => {
    const routes = [
      { method: 'GET' as const, url: `${API}/nutrition-programs` },
      { method: 'POST' as const, url: `${API}/nutrition-programs`, payload: program() },
    ];

    for (const route of routes) {
      expect((await app.inject(route)).statusCode).toBe(401);
    }
  });

  it('ne laisse pas voir, modifier ni supprimer le plan d’un autre', async () => {
    const julie = await register(app);
    const marc = await register(app, { email: 'marc@exemple.fr', name: 'Marc' });

    const created = await create(julie);
    const id = created.json().id;

    const read = await app.inject({
      method: 'GET',
      url: `${API}/nutrition-programs/${id}`,
      headers: authHeaders(marc),
    });
    expect(read.statusCode).toBe(404);

    const written = await app.inject({
      method: 'PUT',
      url: `${API}/nutrition-programs/${id}`,
      headers: authHeaders(marc),
      payload: program({ title: 'Détourné' }),
    });
    expect(written.statusCode).toBe(404);

    const removed = await app.inject({
      method: 'DELETE',
      url: `${API}/nutrition-programs/${id}`,
      headers: authHeaders(marc),
    });
    expect(removed.statusCode).toBe(404);

    const list = await app.inject({
      method: 'GET',
      url: `${API}/nutrition-programs`,
      headers: authHeaders(marc),
    });
    expect(list.json().items).toHaveLength(0);
  });

  it('ne laisse pas cocher un article du plan d’un autre', async () => {
    const julie = await register(app);
    const marc = await register(app, { email: 'marc@exemple.fr', name: 'Marc' });

    const created = await create(julie);
    const saved = created.json();
    const itemId = saved.shopping[0].items[0].id;

    const response = await app.inject({
      method: 'PATCH',
      url: `${API}/nutrition-programs/${saved.id}/shopping-items/${itemId}`,
      headers: authHeaders(marc),
      payload: { checked: true },
    });

    expect(response.statusCode).toBe(404);
  });

  it('ne laisse pas cocher l’article d’un plan en passant par le sien', async () => {
    const julie = await register(app);
    const marc = await register(app, { email: 'marc@exemple.fr', name: 'Marc' });

    const hers = (await create(julie)).json();
    const his = (await create(marc)).json();

    // Marc vise l'article de Julie, mais à travers *son* programme à lui :
    // l'identifiant du programme passe le contrôle, pas celui de l'article.
    const response = await app.inject({
      method: 'PATCH',
      url: `${API}/nutrition-programs/${his.id}/shopping-items/${hers.shopping[0].items[0].id}`,
      headers: authHeaders(marc),
      payload: { checked: true },
    });

    expect(response.statusCode).toBe(404);

    const stillUnchecked = await app.inject({
      method: 'GET',
      url: `${API}/nutrition-programs/${hers.id}`,
      headers: authHeaders(julie),
    });
    expect(stillUnchecked.json().shopping[0].items[0].checked).toBe(false);
  });
});

describe('enregistrement', () => {
  it('crée un plan et calcule les cibles', async () => {
    const session = await register(app);
    const response = await create(session);

    expect(response.statusCode).toBe(201);

    const saved = nutritionProgramSchema.parse(response.json());

    // Les mêmes chiffres que le prototype.
    expect(saved.targets.bmrKcal).toBe(1389);
    expect(saved.targets.maintenanceKcal).toBe(2153);
    expect(saved.targets.targetKcal).toBe(1753);
    expect(saved.targets.proteinG).toBe(130);
  });

  it('rend les repas dans l’ordre, avec leurs lignes', async () => {
    const session = await register(app);
    const saved = nutritionProgramSchema.parse((await create(session)).json());

    expect(saved.meals.map((meal) => meal.name)).toEqual(['Petit-déjeuner', 'Déjeuner']);
    expect(saved.meals[0]?.items[0]?.label).toBe('Flocons d’avoine');
    expect(saved.meals[0]?.items[0]?.alternative).toBe('Pain complet');
  });

  it('totalise la journée en respectant les calories saisies à la main', async () => {
    const session = await register(app);
    const saved = nutritionProgramSchema.parse((await create(session)).json());

    // 228 pour le petit-déjeuner, 650 imposées pour le déjeuner.
    expect(saved.dayTotals.kcal).toBe(878);
    expect(saved.dayTotals.proteinG).toBeCloseTo(8.1, 1);
  });

  it('remplace tout le contenu à l’enregistrement', async () => {
    const session = await register(app);
    const created = (await create(session)).json();

    const response = await app.inject({
      method: 'PUT',
      url: `${API}/nutrition-programs/${created.id}`,
      headers: authHeaders(session),
      payload: program({ title: 'Plan revu', meals: [], shopping: [] }),
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().title).toBe('Plan revu');
    expect(response.json().meals).toHaveLength(0);
    expect(response.json().shopping).toHaveLength(0);
    expect(response.json().dayTotals.kcal).toBe(0);
  });

  it('refuse un poids aberrant', async () => {
    const session = await register(app);

    const response = await create(session, program({ settings: { ...settings, weightKg: 7 } }));

    expect(response.statusCode).toBe(400);
  });
});

describe('liste de courses', () => {
  it('coche un article, et garde le reste intact', async () => {
    const session = await register(app);
    const saved = (await create(session)).json();
    const itemId = saved.shopping[0].items[0].id;

    const response = await app.inject({
      method: 'PATCH',
      url: `${API}/nutrition-programs/${saved.id}/shopping-items/${itemId}`,
      headers: authHeaders(session),
      payload: { checked: true },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().shopping[0].items[0].checked).toBe(true);
    expect(response.json().shopping[0].items[0].label).toBe('Blanc de poulet');
    expect(response.json().shopping[0].items[0].priceCents).toBe(899);
  });

  it('enregistre un prix et son enseigne', async () => {
    const session = await register(app);
    const saved = (await create(session)).json();
    const itemId = saved.shopping[0].items[0].id;

    const response = await app.inject({
      method: 'PATCH',
      url: `${API}/nutrition-programs/${saved.id}/shopping-items/${itemId}`,
      headers: authHeaders(session),
      payload: { priceCents: 1250, store: 'Carrefour' },
    });

    expect(response.json().shopping[0].items[0].priceCents).toBe(1250);
    expect(response.json().shopping[0].items[0].store).toBe('Carrefour');
  });
});

describe('séparation des deux familles de programmes', () => {
  it('un plan de nutrition n’apparaît pas dans les programmes de musculation', async () => {
    const session = await register(app);
    await create(session);

    const training = await app.inject({
      method: 'GET',
      url: `${API}/programs`,
      headers: authHeaders(session),
    });

    expect(training.json().items).toHaveLength(0);
  });

  it('et ne se lit pas comme un programme de musculation', async () => {
    const session = await register(app);
    const saved = (await create(session)).json();

    const response = await app.inject({
      method: 'GET',
      url: `${API}/programs/${saved.id}`,
      headers: authHeaders(session),
    });

    expect(response.statusCode).toBe(404);
  });
});

describe('macros calculées depuis la base d’aliments', () => {
  /** Le riz de la table Ciqual : 130 kcal pour 100 g. */
  async function insertRice() {
    const { db } = await import('../src/db/client.js');
    const { foods } = await import('../src/db/schema.js');
    const { buildFoodSearchText } = await import('@betterfit/shared');

    const [row] = await db
      .insert(foods)
      .values({
        source: 'ciqual',
        ownerId: null,
        externalId: '9644',
        name: 'Riz blanc, cuit, non salé',
        category: 'pâtes, riz et céréales',
        kcal: 130,
        proteinG: 2.7,
        carbsG: 28,
        fatG: 0.3,
        searchText: buildFoodSearchText({ name: 'Riz blanc, cuit, non salé' }),
      })
      .returning({ id: foods.id });

    return row!.id;
  }

  function withFood(foodId: string, quantity: string, quantityG: number | null = null) {
    return program({
      meals: [
        {
          name: 'Déjeuner',
          time: '12h30',
          kcalOverride: null,
          items: [
            {
              foodId,
              label: '',
              quantity,
              quantityG,
              alternative: '',
              kcal: null,
              proteinG: null,
              carbsG: null,
              fatG: null,
            },
          ],
        },
      ],
    });
  }

  it('calcule les macros à partir de la quantité en grammes', async () => {
    const session = await register(app);
    const foodId = await insertRice();

    const saved = (await create(session, withFood(foodId, '160 g', 160))).json();
    const item = saved.meals[0].items[0];

    expect(item.kcal).toBe(208);
    expect(item.proteinG).toBeCloseTo(4.3, 1);
    expect(item.carbsG).toBeCloseTo(44.8, 1);
  });

  it('déduit les grammes de la quantité écrite à la main', async () => {
    const session = await register(app);
    const foodId = await insertRice();

    // Pas de `quantityG` : « 160 g » doit suffire.
    const saved = (await create(session, withFood(foodId, '160 g'))).json();

    expect(saved.meals[0].items[0].kcal).toBe(208);
    expect(saved.meals[0].items[0].quantityG).toBe(160);
  });

  it('reprend le nom de l’aliment quand la ligne n’en a pas', async () => {
    const session = await register(app);
    const foodId = await insertRice();

    const saved = (await create(session, withFood(foodId, '160 g'))).json();

    expect(saved.meals[0].items[0].label).toBe('Riz blanc, cuit, non salé');
  });

  it('ne calcule rien pour une quantité qui ne se chiffre pas', async () => {
    const session = await register(app);
    const foodId = await insertRice();

    const saved = (await create(session, withFood(foodId, 'à volonté'))).json();

    // Mieux vaut ne rien compter que compter faux.
    expect(saved.meals[0].items[0].kcal).toBeNull();
  });

  it('ignore les valeurs envoyées par l’app quand l’aliment fait foi', async () => {
    const session = await register(app);
    const foodId = await insertRice();

    const input = withFood(foodId, '160 g', 160);
    input.meals[0]!.items[0]!.kcal = 5;

    const saved = (await create(session, input)).json();

    // Le serveur recalcule : un client modifié ne doit pas pouvoir annoncer
    // 5 kcal pour 160 g de riz.
    expect(saved.meals[0].items[0].kcal).toBe(208);
  });

  it('oublie un aliment qui n’existe pas, sans perdre la ligne', async () => {
    const session = await register(app);
    const { randomUUID } = await import('node:crypto');

    const input = withFood(randomUUID(), '160 g');
    input.meals[0]!.items[0]!.label = 'Riz de je ne sais où';

    const saved = (await create(session, input)).json();

    expect(saved.meals[0].items[0].foodId).toBeNull();
    expect(saved.meals[0].items[0].label).toBe('Riz de je ne sais où');
  });

  it('totalise la journée avec les valeurs calculées', async () => {
    const session = await register(app);
    const foodId = await insertRice();

    const saved = (await create(session, withFood(foodId, '160 g'))).json();

    expect(saved.dayTotals.kcal).toBe(208);
  });
});
