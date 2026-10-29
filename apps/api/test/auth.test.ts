import { AUTH_ERROR_CODES, sessionSchema } from '@betterfit/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { App } from '../src/app.js';
import {
  API,
  authHeaders,
  credentials,
  nativeHeaders,
  refreshCookie,
  register,
  startApp,
} from './helpers.js';

let app: App;

beforeAll(async () => {
  app = await startApp();
});

afterAll(async () => {
  await app.close();
});

describe('POST /auth/register', () => {
  it('crée un compte et ouvre une session', async () => {
    const response = await app.inject({
      method: 'POST',
      url: `${API}/auth/register`,
      headers: nativeHeaders,
      payload: credentials,
    });

    expect(response.statusCode).toBe(201);

    const session = sessionSchema.parse(response.json());
    expect(session.user.email).toBe(credentials.email);
    expect(session.user.hasProfile).toBe(false);
    expect(session.user.healthDataConsentAt).not.toBeNull();
    expect(session.refreshToken).toBeTruthy();
  });

  it('refuse une adresse déjà prise', async () => {
    await register(app);

    const response = await app.inject({
      method: 'POST',
      url: `${API}/auth/register`,
      payload: credentials,
    });

    expect(response.statusCode).toBe(409);
    expect(response.json().code).toBe(AUTH_ERROR_CODES.emailTaken);
  });

  it('refuse une inscription sans consentement aux données de santé', async () => {
    const response = await app.inject({
      method: 'POST',
      url: `${API}/auth/register`,
      payload: { ...credentials, healthDataConsent: false },
    });

    expect(response.statusCode).toBe(400);
  });

  it('refuse un mot de passe trop court, et dit quel champ', async () => {
    const response = await app.inject({
      method: 'POST',
      url: `${API}/auth/register`,
      payload: { ...credentials, password: 'court' },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().fields).toHaveProperty('password');
  });

  it('ignore la casse de l’adresse', async () => {
    await register(app);

    const response = await app.inject({
      method: 'POST',
      url: `${API}/auth/register`,
      payload: { ...credentials, email: 'JULIE@Exemple.FR' },
    });

    expect(response.statusCode).toBe(409);
  });

  it('ne renvoie jamais l’empreinte du mot de passe', async () => {
    const response = await app.inject({
      method: 'POST',
      url: `${API}/auth/register`,
      payload: credentials,
    });

    expect(response.body).not.toContain('argon2');
    expect(response.body).not.toContain(credentials.password);
  });
});

describe('POST /auth/login', () => {
  it('connecte avec les bons identifiants', async () => {
    await register(app);

    const response = await app.inject({
      method: 'POST',
      url: `${API}/auth/login`,
      headers: nativeHeaders,
      payload: { email: credentials.email, password: credentials.password },
    });

    expect(response.statusCode).toBe(200);
    expect(sessionSchema.parse(response.json()).user.email).toBe(credentials.email);
  });

  it('refuse un mauvais mot de passe', async () => {
    await register(app);

    const response = await app.inject({
      method: 'POST',
      url: `${API}/auth/login`,
      payload: { email: credentials.email, password: 'ce-nest-pas-le-bon' },
    });

    expect(response.statusCode).toBe(401);
    expect(response.json().code).toBe(AUTH_ERROR_CODES.invalidCredentials);
  });

  it('répond pareil pour une adresse inconnue : on ne révèle pas qui a un compte', async () => {
    const unknown = await app.inject({
      method: 'POST',
      url: `${API}/auth/login`,
      payload: { email: 'personne@exemple.fr', password: 'ce-nest-pas-le-bon' },
    });

    await register(app);
    const wrongPassword = await app.inject({
      method: 'POST',
      url: `${API}/auth/login`,
      payload: { email: credentials.email, password: 'ce-nest-pas-le-bon' },
    });

    expect(unknown.statusCode).toBe(wrongPassword.statusCode);
    expect(unknown.json().code).toBe(wrongPassword.json().code);
  });

  it('bloque après trop d’échecs', async () => {
    await register(app);

    let last = 0;
    for (let attempt = 0; attempt < 9; attempt += 1) {
      const response = await app.inject({
        method: 'POST',
        url: `${API}/auth/login`,
        payload: { email: credentials.email, password: 'ce-nest-pas-le-bon' },
      });
      last = response.statusCode;
    }

    expect(last).toBe(429);

    // Même le bon mot de passe est refusé tant que le blocage dure.
    const blocked = await app.inject({
      method: 'POST',
      url: `${API}/auth/login`,
      payload: { email: credentials.email, password: credentials.password },
    });

    expect(blocked.statusCode).toBe(429);
    expect(blocked.headers['retry-after']).toBeDefined();
  });

  it('remet le compteur à zéro après une connexion réussie', async () => {
    await register(app);

    for (let attempt = 0; attempt < 5; attempt += 1) {
      await app.inject({
        method: 'POST',
        url: `${API}/auth/login`,
        payload: { email: credentials.email, password: 'ce-nest-pas-le-bon' },
      });
    }

    const ok = await app.inject({
      method: 'POST',
      url: `${API}/auth/login`,
      payload: { email: credentials.email, password: credentials.password },
    });
    expect(ok.statusCode).toBe(200);

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const response = await app.inject({
        method: 'POST',
        url: `${API}/auth/login`,
        payload: { email: credentials.email, password: 'ce-nest-pas-le-bon' },
      });
      expect(response.statusCode).toBe(401);
    }
  });
});

describe('cookie de session (parcours web)', () => {
  it('pose un cookie httpOnly et ne renvoie pas le jeton dans le corps', async () => {
    const response = await app.inject({
      method: 'POST',
      url: `${API}/auth/register`,
      payload: credentials,
    });

    const cookie = refreshCookie(response);
    expect(cookie).toBeDefined();
    expect(cookie).toContain('HttpOnly');
    expect(response.json().refreshToken).toBeNull();
  });

  it('rafraîchit à partir du seul cookie', async () => {
    const registered = await app.inject({
      method: 'POST',
      url: `${API}/auth/register`,
      payload: credentials,
    });

    const cookie = refreshCookie(registered)!.split(';')[0]!;

    const response = await app.inject({
      method: 'POST',
      url: `${API}/auth/refresh`,
      headers: { cookie },
    });

    expect(response.statusCode).toBe(200);
    expect(sessionSchema.parse(response.json()).user.email).toBe(credentials.email);
  });
});

describe('POST /auth/refresh', () => {
  it('échange le jeton contre un neuf', async () => {
    const session = await register(app);

    const response = await app.inject({
      method: 'POST',
      url: `${API}/auth/refresh`,
      headers: nativeHeaders,
      payload: { refreshToken: session.refreshToken },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().refreshToken).not.toBe(session.refreshToken);
  });

  it('ferme toute la session si un jeton déjà utilisé ressert', async () => {
    const session = await register(app);

    const rotated = await app.inject({
      method: 'POST',
      url: `${API}/auth/refresh`,
      headers: nativeHeaders,
      payload: { refreshToken: session.refreshToken },
    });
    expect(rotated.statusCode).toBe(200);

    // Le jeton d'origine resservi : signe d'un vol.
    const replayed = await app.inject({
      method: 'POST',
      url: `${API}/auth/refresh`,
      headers: nativeHeaders,
      payload: { refreshToken: session.refreshToken },
    });
    expect(replayed.statusCode).toBe(401);

    // Et le jeton neuf, obtenu par l'attaquant comme par la victime, ne vaut plus rien.
    const afterBreach = await app.inject({
      method: 'POST',
      url: `${API}/auth/refresh`,
      headers: nativeHeaders,
      payload: { refreshToken: rotated.json().refreshToken },
    });
    expect(afterBreach.statusCode).toBe(401);
  });

  it('refuse un jeton inventé', async () => {
    const response = await app.inject({
      method: 'POST',
      url: `${API}/auth/refresh`,
      headers: nativeHeaders,
      payload: { refreshToken: 'jeton-inexistant' },
    });

    expect(response.statusCode).toBe(401);
  });
});

describe('POST /auth/logout', () => {
  it('ferme la session : le jeton d’accès ne passe plus', async () => {
    const session = await register(app);

    const before = await app.inject({
      method: 'GET',
      url: `${API}/me`,
      headers: authHeaders(session),
    });
    expect(before.statusCode).toBe(200);

    await app.inject({
      method: 'POST',
      url: `${API}/auth/logout`,
      headers: nativeHeaders,
      payload: { refreshToken: session.refreshToken },
    });

    const after = await app.inject({
      method: 'GET',
      url: `${API}/me`,
      headers: authHeaders(session),
    });
    expect(after.statusCode).toBe(401);
  });
});

describe('mot de passe oublié', () => {
  it('répond pareil que le compte existe ou non', async () => {
    await register(app);

    const known = await app.inject({
      method: 'POST',
      url: `${API}/auth/forgot-password`,
      payload: { email: credentials.email },
    });
    const unknown = await app.inject({
      method: 'POST',
      url: `${API}/auth/forgot-password`,
      payload: { email: 'personne@exemple.fr' },
    });

    expect(known.statusCode).toBe(202);
    expect(unknown.statusCode).toBe(202);
    expect(known.body).toBe(unknown.body);
  });

  it('réinitialise le mot de passe et ferme les sessions ouvertes', async () => {
    const session = await register(app);

    // On récupère le jeton comme le ferait l'e-mail.
    const { db } = await import('../src/db/client.js');
    const { passwordResetTokens } = await import('../src/db/schema.js');

    const { createHash, randomBytes } = await import('node:crypto');
    const token = randomBytes(32).toString('base64url');
    const [user] = await db.select().from((await import('../src/db/schema.js')).users);

    await db.insert(passwordResetTokens).values({
      userId: user!.id,
      tokenHash: createHash('sha256').update(token).digest('hex'),
      expiresAt: new Date(Date.now() + 60_000),
    });

    const reset = await app.inject({
      method: 'POST',
      url: `${API}/auth/reset-password`,
      headers: nativeHeaders,
      payload: { token, password: 'un-tout-nouveau-mot-de-passe' },
    });
    expect(reset.statusCode).toBe(200);

    // L'ancienne session est fermée.
    const old = await app.inject({
      method: 'GET',
      url: `${API}/me`,
      headers: authHeaders(session),
    });
    expect(old.statusCode).toBe(401);

    // Le nouveau mot de passe fonctionne, l'ancien non.
    const withNew = await app.inject({
      method: 'POST',
      url: `${API}/auth/login`,
      payload: { email: credentials.email, password: 'un-tout-nouveau-mot-de-passe' },
    });
    expect(withNew.statusCode).toBe(200);

    const withOld = await app.inject({
      method: 'POST',
      url: `${API}/auth/login`,
      payload: { email: credentials.email, password: credentials.password },
    });
    expect(withOld.statusCode).toBe(401);
  });

  it('refuse un lien déjà utilisé', async () => {
    await register(app);

    const { db } = await import('../src/db/client.js');
    const { passwordResetTokens, users } = await import('../src/db/schema.js');
    const { createHash, randomBytes } = await import('node:crypto');

    const token = randomBytes(32).toString('base64url');
    const [user] = await db.select().from(users);

    await db.insert(passwordResetTokens).values({
      userId: user!.id,
      tokenHash: createHash('sha256').update(token).digest('hex'),
      expiresAt: new Date(Date.now() + 60_000),
    });

    const first = await app.inject({
      method: 'POST',
      url: `${API}/auth/reset-password`,
      payload: { token, password: 'premier-nouveau-mot-de-passe' },
    });
    expect(first.statusCode).toBe(200);

    const second = await app.inject({
      method: 'POST',
      url: `${API}/auth/reset-password`,
      payload: { token, password: 'second-nouveau-mot-de-passe' },
    });
    expect(second.statusCode).toBe(400);
  });

  it('refuse un lien expiré', async () => {
    await register(app);

    const { db } = await import('../src/db/client.js');
    const { passwordResetTokens, users } = await import('../src/db/schema.js');
    const { createHash, randomBytes } = await import('node:crypto');

    const token = randomBytes(32).toString('base64url');
    const [user] = await db.select().from(users);

    await db.insert(passwordResetTokens).values({
      userId: user!.id,
      tokenHash: createHash('sha256').update(token).digest('hex'),
      expiresAt: new Date(Date.now() - 1000),
    });

    const response = await app.inject({
      method: 'POST',
      url: `${API}/auth/reset-password`,
      payload: { token, password: 'un-tout-nouveau-mot-de-passe' },
    });

    expect(response.statusCode).toBe(400);
  });
});

describe('CORS', () => {
  // Sans ces méthodes, l'application web ne peut rien modifier : le navigateur
  // refuse la requête avant même de l'envoyer.
  it.each(['PUT', 'PATCH', 'DELETE'])('autorise %s depuis le navigateur', async (method) => {
    const response = await app.inject({
      method: 'OPTIONS',
      url: `${API}/me`,
      headers: {
        origin: 'http://localhost:8081',
        'access-control-request-method': method,
        'access-control-request-headers': 'content-type,authorization',
      },
    });

    expect(response.headers['access-control-allow-methods']).toContain(method);
  });
});

describe('requête mal formée', () => {
  // Une faute de l'appelant n'est pas une panne du serveur : l'annoncer en 500
  // masquerait la vraie cause et déclencherait des alertes pour rien.
  it('répond 400, pas 500, sur un corps JSON vide', async () => {
    const response = await app.inject({
      method: 'POST',
      url: `${API}/auth/login`,
      headers: { 'content-type': 'application/json' },
      payload: '',
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().code).toBe('request/malformed');
  });

  it('répond 400 sur un JSON illisible', async () => {
    const response = await app.inject({
      method: 'POST',
      url: `${API}/auth/login`,
      headers: { 'content-type': 'application/json' },
      payload: '{ceci n’est pas du JSON',
    });

    expect(response.statusCode).toBe(400);
  });
});
