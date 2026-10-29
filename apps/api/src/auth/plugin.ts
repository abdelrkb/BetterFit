import { AUTH_ERROR_CODES } from '@betterfit/shared';
import { eq } from 'drizzle-orm';
import type { FastifyReply, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import { db } from '../db/client.js';
import { users, type UserRow } from '../db/schema.js';
import { unauthorized } from '../errors.js';
import { isSessionActive, verifyAccessToken } from './tokens.js';

declare module 'fastify' {
  interface FastifyRequest {
    /** Renseigné par `requireAuth`. */
    currentUser?: UserRow;
    currentSessionId?: string;
  }

  interface FastifyInstance {
    /**
     * À poser en `onRequest` sur toute route qui touche à des données
     * personnelles. Toute route non marquée est publique : c'est volontaire,
     * on préfère un oubli visible à un garde silencieux.
     *
     * `onRequest` et non `preHandler` : Fastify valide le corps de la requête
     * **avant** `preHandler`. Un appel non authentifié au corps malformé
     * recevrait alors un 400 détaillé au lieu d'un 401, ce qui renseignerait
     * un curieux sur la forme attendue.
     */
    requireAuth: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

function bearerToken(request: FastifyRequest): string | null {
  const header = request.headers.authorization;
  if (!header?.toLowerCase().startsWith('bearer ')) return null;

  const token = header.slice('bearer '.length).trim();
  return token.length > 0 ? token : null;
}

async function requireAuth(request: FastifyRequest): Promise<void> {
  const token = bearerToken(request);
  if (!token) {
    throw unauthorized(AUTH_ERROR_CODES.unauthenticated, 'Jeton d’accès absent.');
  }

  const claims = await verifyAccessToken(token);
  if (!claims) {
    throw unauthorized(AUTH_ERROR_CODES.expiredToken, 'Jeton d’accès invalide ou expiré.');
  }

  // Une session fermée (déconnexion, mot de passe changé) invalide aussitôt
  // les jetons d'accès encore valides sur le papier.
  if (!(await isSessionActive(claims.sid))) {
    throw unauthorized(AUTH_ERROR_CODES.expiredToken, 'Session fermée.');
  }

  const [user] = await db.select().from(users).where(eq(users.id, claims.sub));
  if (!user) {
    throw unauthorized(AUTH_ERROR_CODES.unauthenticated, 'Compte introuvable.');
  }

  request.currentUser = user;
  request.currentSessionId = claims.sid;
}

/** Lit l'utilisateur garanti par `requireAuth`. */
export function currentUser(request: FastifyRequest): UserRow {
  if (!request.currentUser) {
    throw unauthorized(AUTH_ERROR_CODES.unauthenticated, 'Route protégée sans requireAuth.');
  }

  return request.currentUser;
}

export const authPlugin = fp(async (app) => {
  app.decorate('requireAuth', requireAuth);
});
