import type { Session, User } from '@betterfit/shared';
import { eq } from 'drizzle-orm';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { db } from '../db/client.js';
import { profiles, type UserRow } from '../db/schema.js';
import { isProductionEnv } from '../env.js';
import {
  ACCESS_TOKEN_TTL_SECONDS,
  REFRESH_TOKEN_TTL_DAYS,
  signAccessToken,
  type IssuedRefreshToken,
} from './tokens.js';

/** Nom du cookie qui porte le jeton de rafraîchissement sur le web. */
export const REFRESH_COOKIE = 'betterfit_refresh';

/**
 * Le web et le mobile ne stockent pas le jeton de rafraîchissement au même
 * endroit : cookie `httpOnly` dans le navigateur (inaccessible au JavaScript,
 * donc à l'abri d'un XSS), `expo-secure-store` sur le téléphone. L'app annonce
 * sa plateforme ; sans en-tête, on suppose le web, qui est le plus prudent.
 */
export function isNativeClient(request: FastifyRequest): boolean {
  return request.headers['x-client-platform'] === 'native';
}

export function setRefreshCookie(reply: FastifyReply, refresh: IssuedRefreshToken): void {
  reply.setCookie(REFRESH_COOKIE, refresh.token, {
    httpOnly: true,
    secure: isProductionEnv,
    sameSite: 'lax',
    path: '/',
    maxAge: REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60,
  });
}

export function clearRefreshCookie(reply: FastifyReply): void {
  reply.clearCookie(REFRESH_COOKIE, { path: '/' });
}

/**
 * Le jeton de rafraîchissement arrive du corps de la requête (mobile) ou du
 * cookie (web). Un corps absent arrive comme `null`, d'où le type.
 */
export function readRefreshToken(
  request: FastifyRequest,
  body?: { refreshToken?: string } | null,
): string | null {
  return body?.refreshToken ?? request.cookies[REFRESH_COOKIE] ?? null;
}

export async function toPublicUser(user: UserRow): Promise<User> {
  const [profile] = await db
    .select({ userId: profiles.userId })
    .from(profiles)
    .where(eq(profiles.userId, user.id));

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    locale: user.locale,
    hasProfile: profile !== undefined,
    healthDataConsentAt: user.healthDataConsentAt?.toISOString() ?? null,
    canEditLibrary: user.canEditLibrary,
    createdAt: user.createdAt.toISOString(),
  };
}

/** Fabrique la réponse d'une connexion, et pose le cookie côté web. */
export async function buildSession(
  request: FastifyRequest,
  reply: FastifyReply,
  user: UserRow,
  refresh: IssuedRefreshToken,
): Promise<Session> {
  const native = isNativeClient(request);

  if (!native) setRefreshCookie(reply, refresh);

  return {
    user: await toPublicUser(user),
    accessToken: await signAccessToken({ sub: user.id, sid: refresh.sessionId }),
    expiresIn: ACCESS_TOKEN_TTL_SECONDS,
    refreshToken: native ? refresh.token : null,
  };
}
