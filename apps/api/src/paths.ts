import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

/** Racine du dépôt, déduite de l'emplacement de ce fichier. */
export const REPO_ROOT = resolve(new URL('../../..', import.meta.url).pathname);

/** Données versionnées : traductions, corrections de noms, imports. */
export const DATA_DIR = resolve(REPO_ROOT, 'data');

/**
 * Fichiers servis par l'API : photos d'exercices, plus tard avatars et photos
 * de recettes. Hors du dépôt (volume Docker en production).
 */
export const UPLOADS_DIR = process.env.UPLOADS_DIR
  ? resolve(process.env.UPLOADS_DIR)
  : resolve(REPO_ROOT, 'apps/api/uploads');

/** Emplacement local d'une photo d'exercice, à partir de son chemin d'origine. */
export function exerciseImagePath(relativePath: string): string {
  return resolve(UPLOADS_DIR, 'exercises', relativePath);
}

export function ensureUploadsDir(): void {
  mkdirSync(resolve(UPLOADS_DIR, 'exercises'), { recursive: true });
}
