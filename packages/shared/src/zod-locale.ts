import { z } from 'zod';

/**
 * Met zod en français.
 *
 * Sans ça, un champ mal rempli affiche le message d'origine de zod, en
 * anglais : « Invalid option: expected one of "female"|"male" ». L'app et
 * l'API appellent cette fonction au démarrage, chacune une fois.
 *
 * Les messages explicites écrits dans nos schémas restent prioritaires :
 * la locale ne sert que de secours.
 */
export function setZodMessagesToFrench(): void {
  z.config(z.locales.fr());
}
