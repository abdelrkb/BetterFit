import { and, eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { coachSettings, coachingRelations } from '../db/schema.js';
import { forbidden, notFound } from '../errors.js';

/**
 * Les règles d'accès du coaching, à un seul endroit.
 *
 * Toute route qui montre les données d'un client passe par
 * `assertActiveClient`. Un coach ne voit que ses clients **actifs** : dès que
 * la relation est terminée, il perd l'accès au suivi, comme le prévoit le
 * cahier des charges.
 */

/** Lève une erreur si le compte n'a pas activé l'espace coach. */
export async function assertIsCoach(userId: string): Promise<void> {
  const [settings] = await db
    .select({ userId: coachSettings.userId })
    .from(coachSettings)
    .where(eq(coachSettings.userId, userId));

  if (!settings) {
    throw forbidden('coach/not-activated', 'L’espace coach n’est pas activé sur ce compte.');
  }
}

/**
 * Vérifie qu'un client est bien suivi **activement** par ce coach, et renvoie
 * la relation.
 *
 * Répond « introuvable » et non « interdit » : un coach ne doit pas pouvoir
 * deviner, à la réponse, si un compte existe ou s'il a un autre coach.
 */
export async function assertActiveClient(coachId: string, clientId: string) {
  const [relation] = await db
    .select()
    .from(coachingRelations)
    .where(
      and(
        eq(coachingRelations.coachId, coachId),
        eq(coachingRelations.clientId, clientId),
        eq(coachingRelations.status, 'active'),
      ),
    );

  if (!relation) throw notFound('coach/client-not-found', 'Client introuvable.');

  return relation;
}

/** La relation active d'un client avec son coach, s'il en a une. */
export async function activeCoachOf(clientId: string) {
  const [relation] = await db
    .select()
    .from(coachingRelations)
    .where(and(eq(coachingRelations.clientId, clientId), eq(coachingRelations.status, 'active')));

  return relation ?? null;
}
