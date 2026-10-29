/**
 * Lecture de la table Ciqual.
 *
 * Ces fonctions sont séparées du script d'import pour être testables sans
 * réseau ni base de données : ce sont elles qui portent le risque, pas la
 * boucle d'écriture.
 */

/**
 * Décode un fichier Ciqual en respectant l'encodage qu'il déclare.
 *
 * La table est publiée en **windows-1252**, pas en UTF-8 : lue en UTF-8, elle
 * donne « Protéines » au lieu de « Protéines », et plus rien ne se cherche.
 * On lit l'encodage dans le prologue XML plutôt que de le supposer, pour que
 * le jour où l'ANSES passera à UTF-8 l'import continue de marcher.
 */
export function decodeXml(bytes: Buffer): string {
  // Le prologue est en ASCII dans tous les encodages concernés : on peut le
  // lire avant de connaître le reste.
  const prolog = bytes.subarray(0, 200).toString('latin1');
  const declared = /encoding\s*=\s*["']([\w-]+)["']/i.exec(prolog)?.[1]?.toLowerCase();

  const encoding =
    declared === undefined || declared === 'utf-8' || declared === 'utf8'
      ? 'utf-8'
      : declared === 'windows-1252' || declared === 'iso-8859-1' || declared === 'latin1'
        ? 'windows-1252'
        : declared;

  try {
    return new TextDecoder(encoding).decode(bytes);
  } catch {
    throw new Error(`Encodage « ${encoding} » inconnu : impossible de lire le fichier Ciqual.`);
  }
}

/**
 * Lit un fichier XML Ciqual en enregistrements plats.
 *
 * Le format est volontairement simple : une balise par enregistrement, des
 * champs d'un seul niveau, pas d'attributs. Un analyseur de trente lignes
 * suffit, et évite d'ajouter une dépendance pour un script lancé deux fois
 * par an. Si le format se complexifiait un jour, il faudrait un vrai
 * analyseur XML — le `throw` ci-dessous le signalerait.
 */
export function parseFlatXml(xml: string, recordTag: string): Record<string, string>[] {
  const records: Record<string, string>[] = [];
  const recordPattern = new RegExp(`<${recordTag}>([\\s\\S]*?)</${recordTag}>`, 'g');
  const fieldPattern = /<([A-Za-z0-9_]+)>([\s\S]*?)<\/\1>/g;

  for (const [, body] of xml.matchAll(recordPattern)) {
    const record: Record<string, string> = {};

    for (const [, field, rawValue] of body!.matchAll(fieldPattern)) {
      /*
       * La table Ciqual n'est **pas un XML bien formé** : quatre noms
       * d'aliments contiennent un `<` non échappé (« Bière sans alcool
       * (<1,2° alcool) »). Un analyseur XML strict refuserait le fichier
       * entier ; celui-ci s'en accommode, parce qu'un `<` suivi d'autre chose
       * qu'un nom de balise ne ressemble à rien.
       *
       * En revanche, une vraie balise imbriquée voudrait dire que le format
       * a changé, et là il faudrait un vrai analyseur.
       */
      if (/<\/?[A-Za-z][A-Za-z0-9_]*\s*>/.test(rawValue!)) {
        throw new Error(
          `Le champ ${field} contient du XML imbriqué : le format a changé, il faut un vrai analyseur.`,
        );
      }

      record[field!.toLowerCase()] = decodeEntities(rawValue!).trim();
    }

    records.push(record);
  }

  return records;
}

/**
 * Décode les entités XML.
 *
 * La table Ciqual écrit **tous** ses accents en références numériques
 * (`&#233;` pour « é »), pas en UTF-8 : sans ce décodage, la base se remplit
 * de « sal&#233; » et plus rien ne se cherche.
 *
 * `&amp;` est traité en dernier, sinon « &amp;#233; » (une esperluette
 * littérale suivie du texte) deviendrait un « é ».
 */
function decodeEntities(value: string): string {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, decimal: string) => String.fromCodePoint(Number(decimal)))
    .replace(/&amp;/g, '&');
}

/**
 * Une teneur Ciqual, convertie en nombre.
 *
 * La table n'écrit pas que des nombres : « traces » veut dire « une quantité
 * négligeable » (on compte 0), « - » veut dire « pas mesuré » (on ne compte
 * rien, c'est `null`), et « < 0,5 » est une borne haute (on retient 0,5, la
 * valeur prudente). Les confondre fausserait tous les totaux.
 */
export function parseAmount(raw: string): number | null {
  const value = raw.replace(/ /g, ' ').replace(',', '.').trim();

  if (value.length === 0 || value === '-') return null;
  if (/^traces$/i.test(value)) return 0;

  const match = /^<?\s*(\d+(?:\.\d+)?)$/.exec(value);
  if (!match) return null;

  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : null;
}

