import { createHmac, timingSafeEqual } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { API_PREFIX } from '@betterfit/shared';
import { env } from '../env.js';
import { badRequest } from '../errors.js';
import { UPLOADS_DIR } from '../paths.js';

/**
 * Les photos de recettes.
 *
 * Contrairement aux photos d'exercices, qui sont du domaine public, une photo
 * de recette appartient à quelqu'un. Elle n'est donc pas servie en libre
 * accès : son adresse porte une **signature** calculée avec le secret du
 * serveur et une date d'expiration. Une balise `<img>` ne peut pas envoyer de
 * jeton d'authentification — c'est pour ça qu'on signe l'adresse plutôt que
 * de protéger la route par un en-tête.
 */

/** Durée de validité d'une adresse signée. */
const TTL_SECONDS = 24 * 60 * 60;

/** Formats acceptés, et l'extension qu'on leur donne sur le disque. */
const EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

/** Deux mégaoctets : largement assez pour une photo de plat. */
const MAX_BYTES = 2 * 1024 * 1024;

export function recipesDir(): string {
  const dir = resolve(UPLOADS_DIR, 'recipes');
  mkdirSync(dir, { recursive: true });
  return dir;
}

function sign(photoPath: string, expiresAt: number): string {
  return createHmac('sha256', env.JWT_SECRET)
    .update(`${photoPath}:${expiresAt}`)
    .digest('base64url');
}

/** L'adresse signée d'une photo, valable vingt-quatre heures. */
export function photoUrl(photoPath: string | null): string | null {
  if (!photoPath) return null;

  const expiresAt = Math.floor(Date.now() / 1000) + TTL_SECONDS;
  const token = sign(photoPath, expiresAt);

  return `${API_PREFIX}/recipes/photos/${photoPath}?expires=${expiresAt}&token=${token}`;
}

/** Vrai si la signature correspond et n'a pas expiré. */
export function verifyPhotoUrl(photoPath: string, expires: number, token: string): boolean {
  if (!Number.isFinite(expires) || expires < Math.floor(Date.now() / 1000)) return false;

  const expected = Buffer.from(sign(photoPath, expires));
  const given = Buffer.from(token);

  // Comparaison à temps constant : une comparaison ordinaire laisserait
  // deviner la signature octet par octet.
  return expected.length === given.length && timingSafeEqual(expected, given);
}

/**
 * Écrit une photo envoyée en `data:` et rend son nom de fichier.
 *
 * On reçoit la photo en base64 dans le corps JSON plutôt qu'en `multipart` :
 * ça évite une dépendance de plus pour un seul usage, et une photo de plat
 * tient largement sous la limite.
 */
export function writePhoto(recipeId: string, dataUrl: string): string {
  const match = /^data:([^;]+);base64,(.+)$/s.exec(dataUrl);
  if (!match) throw badRequest('recipe/bad-photo', 'Photo illisible.');

  const [, mimeType, base64] = match as unknown as [string, string, string];
  const extension = EXTENSIONS[mimeType];

  if (!extension) {
    throw badRequest('recipe/bad-photo-format', 'Photo attendue en JPEG, PNG ou WebP.');
  }

  const bytes = Buffer.from(base64, 'base64');
  if (bytes.byteLength > MAX_BYTES) {
    throw badRequest('recipe/photo-too-large', 'Photo trop lourde : 2 Mo au maximum.');
  }

  const fileName = `${recipeId}.${extension}`;
  writeFileSync(resolve(recipesDir(), fileName), bytes);

  return fileName;
}

/** Vrai si le nom de fichier est bien celui qu'on a nous-mêmes écrit. */
export function isSafePhotoName(name: string): boolean {
  return /^[0-9a-f-]{36}\.(jpg|png|webp)$/.test(name);
}
