import { eq, sql } from 'drizzle-orm';
import { db } from '../db/client.js';
import { authAttempts } from '../db/schema.js';

/**
 * Freine les attaques par force brute sur la connexion et le mot de passe
 * oublié : au-delà de `MAX_ATTEMPTS` échecs dans la fenêtre, la clé est
 * bloquée pendant `BLOCK_MINUTES`.
 *
 * On compte par adresse e-mail plutôt que par IP : derrière une box ou un
 * réseau d'entreprise, plusieurs personnes partagent la même IP.
 */
const MAX_ATTEMPTS = 8;
const WINDOW_MINUTES = 15;
const BLOCK_MINUTES = 15;

function minutes(count: number): number {
  return count * 60 * 1000;
}

export type RateLimitState = { blocked: boolean; retryAfterSeconds: number };

/** À appeler avant de vérifier un mot de passe. */
export async function checkRateLimit(key: string): Promise<RateLimitState> {
  const [row] = await db.select().from(authAttempts).where(eq(authAttempts.key, key));

  if (!row?.blockedUntil) return { blocked: false, retryAfterSeconds: 0 };

  const remaining = row.blockedUntil.getTime() - Date.now();
  if (remaining <= 0) return { blocked: false, retryAfterSeconds: 0 };

  return { blocked: true, retryAfterSeconds: Math.ceil(remaining / 1000) };
}

/** À appeler après un échec. */
export async function recordFailure(key: string): Promise<void> {
  const now = new Date();
  const [row] = await db.select().from(authAttempts).where(eq(authAttempts.key, key));

  // Fenêtre écoulée (ou première tentative) : on repart de zéro.
  if (!row || now.getTime() - row.windowStartedAt.getTime() > minutes(WINDOW_MINUTES)) {
    await db
      .insert(authAttempts)
      .values({ key, count: 1, windowStartedAt: now, blockedUntil: null })
      .onConflictDoUpdate({
        target: authAttempts.key,
        set: { count: 1, windowStartedAt: now, blockedUntil: null },
      });
    return;
  }

  const count = row.count + 1;
  const blockedUntil =
    count >= MAX_ATTEMPTS ? new Date(now.getTime() + minutes(BLOCK_MINUTES)) : null;

  await db.update(authAttempts).set({ count, blockedUntil }).where(eq(authAttempts.key, key));
}

/** À appeler après un succès : le compteur retombe. */
export async function clearFailures(key: string): Promise<void> {
  await db.delete(authAttempts).where(eq(authAttempts.key, key));
}

/** Ménage des compteurs oubliés. */
export async function purgeStaleAttempts(): Promise<void> {
  await db
    .delete(authAttempts)
    .where(sql`${authAttempts.windowStartedAt} < now() - interval '1 day'`);
}

export const RATE_LIMIT = { MAX_ATTEMPTS, WINDOW_MINUTES, BLOCK_MINUTES } as const;
