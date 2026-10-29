import { exerciseListSchema, exerciseSchema } from '@betterfit/shared';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { App } from '../src/app.js';
import { db } from '../src/db/client.js';
import { exercises, users } from '../src/db/schema.js';
import { buildSearchText } from '../src/exercises/search-text.js';
import { API, authHeaders, register, startApp } from './helpers.js';
import { eq } from 'drizzle-orm';

let app: App;

beforeAll(async () => {
  app = await startApp();
});

afterAll(async () => {
  await app.close();
});

/** Deux exercices de bibliothèque, pour tester recherche et filtres. */
async function seedLibrary() {
  await db.insert(exercises).values([
    {
      source: 'library',
      externalId: 'Barbell_Squat',
      name: 'Squat à la barre',
      nameEn: 'Barbell Squat',
      primaryMuscles: ['quadriceps'],
      secondaryMuscles: ['glutes', 'hamstrings'],
      equipment: 'barbell',
      level: 'intermediate',
      category: 'strength',
      instructionsEn: ['Stand with the bar on your traps.'],
      images: ['Barbell_Squat/0.jpg'],
      searchText: buildSearchText({
        name: 'Squat à la barre',
        nameEn: 'Barbell Squat',
        muscles: ['Quadriceps', 'Fessiers', 'Ischio-jambiers'],
      }),
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
      instructionsEn: ['Hang from the bar.'],
      images: ['Pullups/0.jpg'],
      searchText: buildSearchText({
        name: 'Tractions',
        nameEn: 'Pullups',
        muscles: ['Grands dorsaux', 'Biceps'],
      }),
    },
  ]);
}

beforeEach(seedLibrary);

const customExercise = {
  name: 'Tirage poitrine maison',
  primaryMuscles: ['lats'],
  secondaryMuscles: ['biceps'],
  equipment: 'bands',
  level: 'beginner',
  category: 'strength',
  instructions: ['Attache l’élastique en hauteur.', 'Tire vers la poitrine.'],
  mascotPose: 'row',
};

describe('accès refusé', () => {
  const routes = [
    { method: 'GET' as const, url: `${API}/exercises` },
    { method: 'POST' as const, url: `${API}/exercises`, payload: customExercise },
  ];

  it.each(routes)('$method $url refuse sans jeton', async (route) => {
    expect((await app.inject(route)).statusCode).toBe(401);
  });

  it('ne montre pas les exercices personnels d’un autre compte', async () => {
    const julie = await register(app);
    const marc = await register(app, { email: 'marc@exemple.fr', name: 'Marc' });

    const created = await app.inject({
      method: 'POST',
      url: `${API}/exercises`,
      headers: authHeaders(julie),
      payload: customExercise,
    });
    const id = created.json().id;

    // Dans la liste de Marc : absent.
    const list = await app.inject({
      method: 'GET',
      url: `${API}/exercises?q=maison`,
      headers: authHeaders(marc),
    });
    expect(list.json().items).toHaveLength(0);

    // En accès direct : introuvable, et non « interdit », pour ne pas révéler
    // qu'il existe.
    const direct = await app.inject({
      method: 'GET',
      url: `${API}/exercises/${id}`,
      headers: authHeaders(marc),
    });
    expect(direct.statusCode).toBe(404);
  });

  it('empêche de modifier ou supprimer l’exercice d’un autre', async () => {
    const julie = await register(app);
    const marc = await register(app, { email: 'marc@exemple.fr', name: 'Marc' });

    const created = await app.inject({
      method: 'POST',
      url: `${API}/exercises`,
      headers: authHeaders(julie),
      payload: customExercise,
    });
    const id = created.json().id;

    const patched = await app.inject({
      method: 'PATCH',
      url: `${API}/exercises/${id}`,
      headers: authHeaders(marc),
      payload: { name: 'Volé' },
    });
    expect(patched.statusCode).toBe(403);

    const deleted = await app.inject({
      method: 'DELETE',
      url: `${API}/exercises/${id}`,
      headers: authHeaders(marc),
    });
    expect(deleted.statusCode).toBe(403);
  });

  it('empêche de modifier un exercice de la bibliothèque partagée', async () => {
    const julie = await register(app);
    const [library] = await db.select().from(exercises).where(eq(exercises.source, 'library'));

    const patched = await app.inject({
      method: 'PATCH',
      url: `${API}/exercises/${library!.id}`,
      headers: authHeaders(julie),
      payload: { name: 'Mon squat' },
    });

    expect(patched.statusCode).toBe(403);
  });

  it('réserve la traduction de la bibliothèque aux comptes autorisés', async () => {
    const julie = await register(app);
    const [library] = await db.select().from(exercises).where(eq(exercises.source, 'library'));

    const refused = await app.inject({
      method: 'PUT',
      url: `${API}/exercises/${library!.id}/translation`,
      headers: authHeaders(julie),
      payload: { instructions: ['Pose la barre sur les trapèzes.'] },
    });
    expect(refused.statusCode).toBe(403);

    // Une fois le droit accordé, la traduction passe.
    await db.update(users).set({ canEditLibrary: true }).where(eq(users.email, 'julie@exemple.fr'));

    const allowed = await app.inject({
      method: 'PUT',
      url: `${API}/exercises/${library!.id}/translation`,
      headers: authHeaders(julie),
      payload: { instructions: ['Pose la barre sur les trapèzes.'] },
    });
    expect(allowed.statusCode).toBe(200);
    expect(allowed.json().translated).toBe(true);
  });
});

describe('recherche', () => {
  it('trouve par nom français', async () => {
    const session = await register(app);

    const response = await app.inject({
      method: 'GET',
      url: `${API}/exercises?q=squat`,
      headers: authHeaders(session),
    });

    const list = exerciseListSchema.parse(response.json());
    expect(list.items[0]?.name).toBe('Squat à la barre');
  });

  it('trouve par nom anglais : beaucoup de coachs cherchent ainsi', async () => {
    const session = await register(app);

    const response = await app.inject({
      method: 'GET',
      url: `${API}/exercises?q=pullups`,
      headers: authHeaders(session),
    });

    expect(response.json().items[0]?.name).toBe('Tractions');
  });

  it('ignore les accents', async () => {
    const session = await register(app);

    const withAccent = await app.inject({
      method: 'GET',
      url: `${API}/exercises?q=barre`,
      headers: authHeaders(session),
    });
    expect(withAccent.json().total).toBe(1);

    const byMuscle = await app.inject({
      method: 'GET',
      url: `${API}/exercises?q=ischio`,
      headers: authHeaders(session),
    });
    expect(byMuscle.json().total).toBe(1);
  });

  it('pardonne une faute de frappe', async () => {
    const session = await register(app);

    const response = await app.inject({
      method: 'GET',
      url: `${API}/exercises?q=tracion`,
      headers: authHeaders(session),
    });

    expect(response.json().total).toBeGreaterThan(0);
  });
});

describe('filtres', () => {
  it('filtre par groupe musculaire', async () => {
    const session = await register(app);

    const back = await app.inject({
      method: 'GET',
      url: `${API}/exercises?muscleGroup=back`,
      headers: authHeaders(session),
    });
    expect(back.json().items.map((item: { name: string }) => item.name)).toEqual(['Tractions']);

    // Le squat sort sur « Jambes » par son muscle principal, et sur
    // « Fessiers » par ses muscles secondaires.
    const legs = await app.inject({
      method: 'GET',
      url: `${API}/exercises?muscleGroup=legs`,
      headers: authHeaders(session),
    });
    expect(legs.json().total).toBe(1);

    const glutes = await app.inject({
      method: 'GET',
      url: `${API}/exercises?muscleGroup=glutes`,
      headers: authHeaders(session),
    });
    expect(glutes.json().total).toBe(1);
  });

  it('filtre par matériel et par niveau', async () => {
    const session = await register(app);

    const bodyweight = await app.inject({
      method: 'GET',
      url: `${API}/exercises?equipment=body only`,
      headers: authHeaders(session),
    });
    expect(bodyweight.json().total).toBe(1);

    const beginner = await app.inject({
      method: 'GET',
      url: `${API}/exercises?level=beginner`,
      headers: authHeaders(session),
    });
    expect(beginner.json().total).toBe(0);
  });

  it('ne montre que ses exercices avec « mine »', async () => {
    const session = await register(app);

    await app.inject({
      method: 'POST',
      url: `${API}/exercises`,
      headers: authHeaders(session),
      payload: customExercise,
    });

    const mine = await app.inject({
      method: 'GET',
      url: `${API}/exercises?mine=true`,
      headers: authHeaders(session),
    });

    expect(mine.json().total).toBe(1);
    expect(mine.json().items[0].source).toBe('custom');
  });
});

describe('exercices personnels', () => {
  it('se crée, se modifie et se supprime', async () => {
    const session = await register(app);

    const created = await app.inject({
      method: 'POST',
      url: `${API}/exercises`,
      headers: authHeaders(session),
      payload: customExercise,
    });
    expect(created.statusCode).toBe(201);

    const exercise = exerciseSchema.parse(created.json());
    expect(exercise.source).toBe('custom');
    expect(exercise.instructions).toHaveLength(2);

    const patched = await app.inject({
      method: 'PATCH',
      url: `${API}/exercises/${exercise.id}`,
      headers: authHeaders(session),
      payload: { name: 'Tirage élastique' },
    });
    expect(patched.json().name).toBe('Tirage élastique');

    // Le nom modifié devient cherchable aussitôt.
    const found = await app.inject({
      method: 'GET',
      url: `${API}/exercises?q=elastique`,
      headers: authHeaders(session),
    });
    expect(found.json().total).toBe(1);

    const removed = await app.inject({
      method: 'DELETE',
      url: `${API}/exercises/${exercise.id}`,
      headers: authHeaders(session),
    });
    expect(removed.statusCode).toBe(204);
  });

  it('refuse un exercice sans muscle', async () => {
    const session = await register(app);

    const response = await app.inject({
      method: 'POST',
      url: `${API}/exercises`,
      headers: authHeaders(session),
      payload: { ...customExercise, primaryMuscles: [] },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().fields).toHaveProperty('primaryMuscles');
  });
});

describe('détail', () => {
  it('donne les consignes anglaises tant que la traduction manque', async () => {
    const session = await register(app);
    const [library] = await db.select().from(exercises).where(eq(exercises.source, 'library'));

    const response = await app.inject({
      method: 'GET',
      url: `${API}/exercises/${library!.id}`,
      headers: authHeaders(session),
    });

    const exercise = exerciseSchema.parse(response.json());
    expect(exercise.translated).toBe(false);
    expect(exercise.instructions).toHaveLength(0);
    expect(exercise.instructionsEn.length).toBeGreaterThan(0);
  });

  it('renvoie des adresses de photos servies par l’API', async () => {
    const session = await register(app);
    const [library] = await db.select().from(exercises).where(eq(exercises.source, 'library'));

    const response = await app.inject({
      method: 'GET',
      url: `${API}/exercises/${library!.id}`,
      headers: authHeaders(session),
    });

    expect(response.json().images[0]).toMatch(/^\/api\/v1\/exercises\/images\//);
  });
});

describe('tri', () => {
  it('place le muscle principal avant le muscle secondaire', async () => {
    const session = await register(app);

    // Le squat a « quadriceps » en principal et « fessiers » en secondaire ;
    // on ajoute un exercice dont « fessiers » est le muscle principal.
    await db.insert(exercises).values({
      source: 'library',
      externalId: 'Hip_Thrust',
      name: 'Hip thrust à la barre',
      nameEn: 'Barbell Hip Thrust',
      primaryMuscles: ['glutes'],
      secondaryMuscles: [],
      equipment: 'barbell',
      level: 'beginner',
      category: 'strength',
      instructionsEn: ['Sit against a bench.'],
      images: [],
      searchText: buildSearchText({
        name: 'Hip thrust à la barre',
        nameEn: 'Barbell Hip Thrust',
        muscles: ['Fessiers'],
      }),
    });

    const response = await app.inject({
      method: 'GET',
      url: `${API}/exercises?muscleGroup=glutes`,
      headers: authHeaders(session),
    });

    const names = response.json().items.map((item: { name: string }) => item.name);
    expect(names).toHaveLength(2);
    expect(names[0]).toBe('Hip thrust à la barre');
  });
});
