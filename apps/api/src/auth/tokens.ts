import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { accessTokenClaimsSchema, type AccessTokenClaims } from '@betterfit/shared';
import { and, eq, isNull, lt, or } from 'drizzle-orm';
import { jwtVerify, SignJWT } from 'jose';
import { db } from '../db/client.js';
import { refreshTokens } from '../db/schema.js';
import { env } from '../env.js';

const encoder = new TextEncoder();
const secret = encoder.encode(env.JWT_SECRET);
const ALGORITHM = 'HS256';
const ISSUER = 'betterfit';

/** Jeton d'accès court : s'il fuite, la fenêtre d'exploitation est petite. */
export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;

/** Jeton de rafraîchissement long : l'utilisateur ne se reconnecte pas chaque semaine. */
export const REFRESH_TOKEN_TTL_DAYS = 60;

export async function signAccessToken(claims: AccessTokenClaims): Promise<string> {
  return new SignJWT({ sid: claims.sid })
    .setProtectedHeader({ alg: ALGORITHM })
    .setSubject(claims.sub)
    .setIssuer(ISSUER)
    .setIssuedAt()
    .setExpirationTime(`${ACCESS_TOKEN_TTL_SECONDS}s`)
    .sign(secret);
}

/** Renvoie les informations du jeton, ou `null` s'il est invalide ou expiré. */
export async function verifyAccessToken(token: string): Promise<AccessTokenClaims | null> {
  try {
    const { payload } = await jwtVerify(token, secret, {
      algorithms: [ALGORITHM],
      issuer: ISSUER,
    });

    return accessTokenClaimsSchema.parse(payload);
  } catch {
    return null;
  }
}

/** Empreinte du jeton de rafraîchissement. Seule elle est stockée. */
function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export type IssuedRefreshToken = {
  token: string;
  sessionId: string;
  expiresAt: Date;
};

function expiryFromNow(): Date {
  return new Date(Date.now() + REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);
}

/** Ouvre une nouvelle session : un nouveau `sessionId` et un premier jeton. */
export async function issueRefreshToken(
  userId: string,
  options: { sessionId?: string; userAgent?: string | undefined } = {},
): Promise<IssuedRefreshToken> {
  const token = randomBytes(48).toString('base64url');
  const sessionId = options.sessionId ?? randomUUID();
  const expiresAt = expiryFromNow();

  await db.insert(refreshTokens).values({
    userId,
    sessionId,
    tokenHash: hashToken(token),
    expiresAt,
    userAgent: options.userAgent ?? null,
  });

  return { token, sessionId, expiresAt };
}

export type RefreshOutcome =
  | { status: 'ok'; userId: string; refresh: IssuedRefreshToken }
  | { status: 'invalid' }
  /** Jeton déjà échangé : on suppose un vol et on ferme toute la session. */
  | { status: 'reused' };

/**
 * Échange un jeton de rafraîchissement contre un neuf (rotation).
 *
 * Si le jeton présenté a déjà servi, c'est qu'il a été copié : on révoque
 * toute la session, ce qui déconnecte aussi l'attaquant.
 */
export async function rotateRefreshToken(
  token: string,
  userAgent?: string,
): Promise<RefreshOutcome> {
  const tokenHash = hashToken(token);

  const [existing] = await db
    .select()
    .from(refreshTokens)
    .where(eq(refreshTokens.tokenHash, tokenHash));

  if (!existing) return { status: 'invalid' };

  if (existing.rotatedTo !== null || existing.revokedAt !== null) {
    await revokeSession(existing.sessionId);
    return { status: 'reused' };
  }

  if (existing.expiresAt.getTime() <= Date.now()) {
    return { status: 'invalid' };
  }

  const next = await issueRefreshToken(existing.userId, {
    sessionId: existing.sessionId,
    userAgent: userAgent ?? existing.userAgent ?? undefined,
  });

  const [created] = await db
    .select({ id: refreshTokens.id })
    .from(refreshTokens)
    .where(eq(refreshTokens.tokenHash, hashToken(next.token)));

  await db
    .update(refreshTokens)
    .set({ rotatedTo: created?.id ?? null, revokedAt: new Date() })
    .where(eq(refreshTokens.id, existing.id));

  return { status: 'ok', userId: existing.userId, refresh: next };
}

/** Ferme une session : la déconnexion d'un appareil. */
export async function revokeSession(sessionId: string): Promise<void> {
  await db
    .update(refreshTokens)
    .set({ revokedAt: new Date() })
    .where(and(eq(refreshTokens.sessionId, sessionId), isNull(refreshTokens.revokedAt)));
}

/** Ferme toutes les sessions : changement de mot de passe, ou demande explicite. */
export async function revokeAllSessions(userId: string): Promise<void> {
  await db
    .update(refreshTokens)
    .set({ revokedAt: new Date() })
    .where(and(eq(refreshTokens.userId, userId), isNull(refreshTokens.revokedAt)));
}

/** Vrai tant que la session est ouverte : un jeton d'accès révoqué cesse d'être accepté. */
export async function isSessionActive(sessionId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: refreshTokens.id })
    .from(refreshTokens)
    .where(and(eq(refreshTokens.sessionId, sessionId), isNull(refreshTokens.revokedAt)))
    .limit(1);

  return row !== undefined;
}

/** Ménage : supprime les jetons expirés ou révoqués depuis longtemps. */
export async function purgeStaleRefreshTokens(): Promise<void> {
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  await db
    .delete(refreshTokens)
    .where(or(lt(refreshTokens.expiresAt, new Date()), lt(refreshTokens.revokedAt, cutoff)));
}

export { hashToken };
