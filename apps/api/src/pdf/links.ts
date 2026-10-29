import { createHmac, timingSafeEqual } from 'node:crypto';
import { API_PREFIX } from '@betterfit/shared';
import { env } from '../env.js';

/**
 * Les liens signés vers un PDF.
 *
 * Un PDF s'ouvre dans le lecteur du système ou se partage : ni l'un ni
 * l'autre ne sait envoyer un en-tête `Authorization`. Comme pour les photos
 * de recettes, l'adresse porte donc une **signature** qui vaut droit
 * d'accès, et qui expire.
 *
 * La signature couvre aussi l'identité du demandeur : le document n'est pas
 * le même selon qu'on est le coach ou le client, et un lien transmis ne doit
 * pas donner plus de droits que n'en avait celui qui l'a demandé.
 */

/** Dix minutes : le temps d'ouvrir ou de partager, pas de laisser traîner. */
const TTL_SECONDS = 10 * 60;

export type PdfKind = 'training' | 'nutrition';

function sign(kind: PdfKind, id: string, userId: string, pages: string, expiresAt: number): string {
  return createHmac('sha256', env.JWT_SECRET)
    .update(`${kind}:${id}:${userId}:${pages}:${expiresAt}`)
    .digest('base64url');
}

export function pdfLink(options: {
  kind: PdfKind;
  id: string;
  userId: string;
  pages: string;
}): { path: string; expiresAt: number } {
  const expiresAt = Math.floor(Date.now() / 1000) + TTL_SECONDS;
  const token = sign(options.kind, options.id, options.userId, options.pages, expiresAt);

  const query = new URLSearchParams({
    user: options.userId,
    expires: String(expiresAt),
    token,
  });

  if (options.pages.length > 0) query.set('pages', options.pages);

  return {
    path: `${API_PREFIX}/pdf/${options.kind}/${options.id}?${query.toString()}`,
    expiresAt,
  };
}

/** Vrai si la signature correspond et n'a pas expiré. */
export function verifyPdfLink(options: {
  kind: PdfKind;
  id: string;
  userId: string;
  pages: string;
  expires: number;
  token: string;
}): boolean {
  if (!Number.isFinite(options.expires) || options.expires < Math.floor(Date.now() / 1000)) {
    return false;
  }

  const expected = Buffer.from(
    sign(options.kind, options.id, options.userId, options.pages, options.expires),
  );
  const given = Buffer.from(options.token);

  // Comparaison à temps constant : une comparaison ordinaire laisserait
  // deviner la signature octet par octet.
  return expected.length === given.length && timingSafeEqual(expected, given);
}
