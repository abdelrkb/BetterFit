import type { Session } from '@betterfit/shared';
import type { LightMyRequestResponse } from 'fastify';
import { buildApp, type App } from '../src/app.js';

export const API = '/api/v1';

/** Un compte de test plausible. */
export const credentials = {
  email: 'julie@exemple.fr',
  password: 'motdepasse-solide',
  name: 'Julie',
  healthDataConsent: true as const,
};

export const profileInput = {
  sex: 'female' as const,
  birthDate: '1992-04-15',
  heightCm: 168,
  activityLevel: 'moderate' as const,
  goal: 'lose_fat' as const,
  weeklySessions: 3,
};

export async function startApp(): Promise<App> {
  const app = await buildApp();
  await app.ready();
  return app;
}

/** `native` pour recevoir le jeton de rafraîchissement dans la réponse. */
export const nativeHeaders = { 'x-client-platform': 'native' };

export async function register(
  app: App,
  overrides: Partial<typeof credentials> = {},
): Promise<Session> {
  const response = await app.inject({
    method: 'POST',
    url: `${API}/auth/register`,
    headers: nativeHeaders,
    payload: { ...credentials, ...overrides },
  });

  if (response.statusCode !== 201) {
    throw new Error(`Inscription échouée (${response.statusCode}) : ${response.body}`);
  }

  return response.json<Session>();
}

export function authHeaders(session: Session): Record<string, string> {
  return { ...nativeHeaders, authorization: `Bearer ${session.accessToken}` };
}

/** Récupère le cookie de rafraîchissement posé par une réponse (parcours web). */
export function refreshCookie(response: LightMyRequestResponse): string | undefined {
  const raw = response.headers['set-cookie'];
  const cookies = Array.isArray(raw) ? raw : raw ? [raw] : [];

  return cookies.find((cookie) => cookie.startsWith('betterfit_refresh='));
}
