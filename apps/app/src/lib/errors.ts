import { ApiRequestError, NetworkError } from './api';
import i18n from '../i18n';

/**
 * Traduit une erreur d'appel en message affichable.
 *
 * Les codes viennent de `AUTH_ERROR_CODES` côté partagé : l'API ne renvoie
 * jamais de texte destiné à l'utilisateur, c'est l'app qui le fabrique.
 */
export function errorMessage(error: unknown): string {
  if (error instanceof NetworkError) {
    return i18n.t('errors.network');
  }

  if (error instanceof ApiRequestError) {
    const key = `errors.codes.${error.code}`;
    const translated = i18n.t(key);

    return translated === key ? i18n.t('errors.unknown') : translated;
  }

  return i18n.t('errors.unknown');
}

/** Erreurs par champ, pour les souligner dans le formulaire. */
export function fieldErrors(error: unknown): Record<string, string> {
  if (!(error instanceof ApiRequestError) || !error.fields) return {};

  return Object.fromEntries(
    Object.entries(error.fields).map(([field, code]) => {
      const key = `errors.codes.${code}`;
      const translated = i18n.t(key);

      return [field, translated === key ? code : translated];
    }),
  );
}
