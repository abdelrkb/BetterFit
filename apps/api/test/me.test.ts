import { meSchema } from '@betterfit/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { App } from '../src/app.js';
import { API, authHeaders, credentials, profileInput, register, startApp } from './helpers.js';

let app: App;

beforeAll(async () => {
  app = await startApp();
});

afterAll(async () => {
  await app.close();
});

const onboarding = { ...profileInput, name: 'Julie', weightKg: 68.4 };

describe('accès refusé', () => {
  // Une route qui touche à des données personnelles doit refuser tout appel
  // non authentifié. On les liste ici : ajouter une route sans l'y ajouter
  // devient visible à la revue.
  const protectedRoutes = [
    { method: 'GET' as const, url: `${API}/me` },
    { method: 'PATCH' as const, url: `${API}/me`, payload: { name: 'X' } },
    { method: 'POST' as const, url: `${API}/me/onboarding`, payload: onboarding },
    { method: 'PUT' as const, url: `${API}/me/profile`, payload: { heightCm: 170 } },
    {
      method: 'POST' as const,
      url: `${API}/me/password`,
      payload: { currentPassword: 'a', newPassword: 'b'.repeat(10) },
    },
    { method: 'GET' as const, url: `${API}/me/export` },
    { method: 'DELETE' as const, url: `${API}/me`, payload: { password: 'a' } },
  ];

  it.each(protectedRoutes)('$method $url refuse sans jeton', async (route) => {
    const response = await app.inject(route);
    expect(response.statusCode).toBe(401);
  });

  it.each(protectedRoutes)('$method $url refuse un jeton inventé', async (route) => {
    const response = await app.inject({
      ...route,
      headers: { authorization: 'Bearer ce-nest-pas-un-jeton' },
    });
    expect(response.statusCode).toBe(401);
  });

  it('ne laisse jamais voir les données d’un autre compte', async () => {
    const julie = await register(app);
    const marc = await register(app, { email: 'marc@exemple.fr', name: 'Marc' });

    await app.inject({
      method: 'POST',
      url: `${API}/me/onboarding`,
      headers: authHeaders(julie),
      payload: onboarding,
    });

    // Marc demande « ses » données : il obtient les siennes, pas celles de Julie.
    const response = await app.inject({
      method: 'GET',
      url: `${API}/me`,
      headers: authHeaders(marc),
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().user.email).toBe('marc@exemple.fr');
    expect(response.json().profile).toBeNull();
    expect(response.json().latestWeightKg).toBeNull();
  });
});

describe('GET /me', () => {
  it('renvoie le compte sans profil juste après l’inscription', async () => {
    const session = await register(app);

    const response = await app.inject({
      method: 'GET',
      url: `${API}/me`,
      headers: authHeaders(session),
    });

    const me = meSchema.parse(response.json());
    expect(me.user.hasProfile).toBe(false);
    expect(me.profile).toBeNull();
  });
});

describe('POST /me/onboarding', () => {
  it('enregistre le profil, le prénom et le premier poids', async () => {
    const session = await register(app);

    const response = await app.inject({
      method: 'POST',
      url: `${API}/me/onboarding`,
      headers: authHeaders(session),
      payload: onboarding,
    });

    expect(response.statusCode).toBe(200);

    const me = meSchema.parse(response.json());
    expect(me.user.hasProfile).toBe(true);
    expect(me.user.name).toBe('Julie');
    expect(me.profile?.heightCm).toBe(168);
    expect(me.latestWeightKg).toBeCloseTo(68.4, 1);
  });

  it('peut être rejoué sans créer de doublon de poids', async () => {
    const session = await register(app);

    await app.inject({
      method: 'POST',
      url: `${API}/me/onboarding`,
      headers: authHeaders(session),
      payload: onboarding,
    });

    const second = await app.inject({
      method: 'POST',
      url: `${API}/me/onboarding`,
      headers: authHeaders(session),
      payload: { ...onboarding, weightKg: 67.9 },
    });

    expect(second.statusCode).toBe(200);
    expect(second.json().latestWeightKg).toBeCloseTo(67.9, 1);
  });

  it('refuse une taille aberrante', async () => {
    const session = await register(app);

    const response = await app.inject({
      method: 'POST',
      url: `${API}/me/onboarding`,
      headers: authHeaders(session),
      payload: { ...onboarding, heightCm: 12 },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().fields).toHaveProperty('heightCm');
  });
});

describe('PUT /me/profile', () => {
  it('modifie un profil existant', async () => {
    const session = await register(app);
    await app.inject({
      method: 'POST',
      url: `${API}/me/onboarding`,
      headers: authHeaders(session),
      payload: onboarding,
    });

    const response = await app.inject({
      method: 'PUT',
      url: `${API}/me/profile`,
      headers: authHeaders(session),
      payload: { goal: 'gain_muscle', weeklySessions: 5 },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().profile.goal).toBe('gain_muscle');
    expect(response.json().profile.heightCm).toBe(168);
  });

  it('refuse tant que le questionnaire d’accueil n’est pas rempli', async () => {
    const session = await register(app);

    const response = await app.inject({
      method: 'PUT',
      url: `${API}/me/profile`,
      headers: authHeaders(session),
      payload: { goal: 'maintain' },
    });

    expect(response.statusCode).toBe(400);
  });
});

describe('PATCH /me', () => {
  it('change le prénom', async () => {
    const session = await register(app);

    const response = await app.inject({
      method: 'PATCH',
      url: `${API}/me`,
      headers: authHeaders(session),
      payload: { name: 'Juliette' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().name).toBe('Juliette');
  });

  it('ne laisse pas changer l’adresse e-mail par cette route', async () => {
    const session = await register(app);

    await app.inject({
      method: 'PATCH',
      url: `${API}/me`,
      headers: authHeaders(session),
      payload: { email: 'pirate@exemple.fr' },
    });

    const me = await app.inject({
      method: 'GET',
      url: `${API}/me`,
      headers: authHeaders(session),
    });
    expect(me.json().user.email).toBe(credentials.email);
  });
});

describe('POST /me/password', () => {
  it('change le mot de passe et déconnecte tous les appareils', async () => {
    const session = await register(app);

    const response = await app.inject({
      method: 'POST',
      url: `${API}/me/password`,
      headers: authHeaders(session),
      payload: { currentPassword: credentials.password, newPassword: 'un-tout-nouveau-secret' },
    });

    expect(response.statusCode).toBe(204);

    const after = await app.inject({
      method: 'GET',
      url: `${API}/me`,
      headers: authHeaders(session),
    });
    expect(after.statusCode).toBe(401);

    const login = await app.inject({
      method: 'POST',
      url: `${API}/auth/login`,
      payload: { email: credentials.email, password: 'un-tout-nouveau-secret' },
    });
    expect(login.statusCode).toBe(200);
  });

  it('refuse si le mot de passe actuel est faux', async () => {
    const session = await register(app);

    const response = await app.inject({
      method: 'POST',
      url: `${API}/me/password`,
      headers: authHeaders(session),
      payload: { currentPassword: 'ce-nest-pas-le-bon', newPassword: 'un-tout-nouveau-secret' },
    });

    expect(response.statusCode).toBe(401);
  });
});

describe('GET /me/export', () => {
  it('rend toutes les données de la personne, et rien d’autre', async () => {
    const session = await register(app);
    await app.inject({
      method: 'POST',
      url: `${API}/me/onboarding`,
      headers: authHeaders(session),
      payload: onboarding,
    });

    const response = await app.inject({
      method: 'GET',
      url: `${API}/me/export`,
      headers: authHeaders(session),
    });

    expect(response.statusCode).toBe(200);

    const data = response.json();
    expect(data.account.email).toBe(credentials.email);
    expect(data.profile.heightCm).toBe(168);
    expect(data.weightEntries).toHaveLength(1);

    // Un export ne doit jamais contenir d'empreinte de mot de passe.
    expect(response.body).not.toContain('passwordHash');
    expect(response.body).not.toContain('$argon2');
  });
});

describe('DELETE /me', () => {
  it('supprime le compte et tout ce qui s’y rattache', async () => {
    const session = await register(app);
    await app.inject({
      method: 'POST',
      url: `${API}/me/onboarding`,
      headers: authHeaders(session),
      payload: onboarding,
    });

    const response = await app.inject({
      method: 'DELETE',
      url: `${API}/me`,
      headers: authHeaders(session),
      payload: { password: credentials.password },
    });

    expect(response.statusCode).toBe(204);

    const login = await app.inject({
      method: 'POST',
      url: `${API}/auth/login`,
      payload: { email: credentials.email, password: credentials.password },
    });
    expect(login.statusCode).toBe(401);

    const { db } = await import('../src/db/client.js');
    const { profiles, weightEntries } = await import('../src/db/schema.js');
    expect(await db.select().from(profiles)).toHaveLength(0);
    expect(await db.select().from(weightEntries)).toHaveLength(0);
  });

  it('refuse sans le bon mot de passe', async () => {
    const session = await register(app);

    const response = await app.inject({
      method: 'DELETE',
      url: `${API}/me`,
      headers: authHeaders(session),
      payload: { password: 'ce-nest-pas-le-bon' },
    });

    expect(response.statusCode).toBe(401);

    const me = await app.inject({
      method: 'GET',
      url: `${API}/me`,
      headers: authHeaders(session),
    });
    expect(me.statusCode).toBe(200);
  });
});
