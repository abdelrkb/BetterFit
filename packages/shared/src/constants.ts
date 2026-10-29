import { z } from 'zod';
/** Nom du produit, utilisé dans les en-têtes HTTP et les User-Agent. */
export const APP_NAME = 'BetterFit';

/** Préfixe de toutes les routes de l'API. */
export const API_PREFIX = '/api/v1';

/**
 * Lit un booléen passé dans l'adresse (`?templates=false`).
 *
 * `z.coerce.boolean()` ne convient pas : il applique `Boolean()`, et
 * `Boolean("false")` vaut `true`. Toute chaîne non vide serait donc vraie.
 */
export const booleanQueryParam = () =>
  z
    .union([z.boolean(), z.enum(['true', 'false', '1', '0'])])
    .transform((value) =>
      typeof value === 'boolean' ? value : value === 'true' || value === '1',
    );
