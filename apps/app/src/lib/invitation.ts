import { readKey, removeKey } from './kv';
import { useSession } from '../stores/session';

/**
 * Le jeton d'invitation reçu par e-mail, mis de côté le temps que la personne
 * se connecte ou crée son compte.
 */
export const PENDING_INVITATION_KEY = 'betterfit.invitation.token';

/**
 * Consomme l'invitation en attente, s'il y en a une.
 *
 * Appelée dès que la session est ouverte. Le jeton est retiré dans tous les
 * cas : qu'il ait été accepté ou qu'il soit périmé, le garder ferait
 * réessayer à chaque démarrage.
 */
export async function consumePendingInvitation(): Promise<void> {
  const token = await readKey(PENDING_INVITATION_KEY);
  if (!token) return;

  try {
    await useSession
      .getState()
      .authedRequest('/me/coaching/join-token', { method: 'POST', body: { token } });
  } catch {
    // Lien périmé, déjà utilisé, ou coach déjà en place : rien à faire de
    // plus, l'écran de coaching dira où on en est.
  } finally {
    await removeKey(PENDING_INVITATION_KEY);
  }
}
