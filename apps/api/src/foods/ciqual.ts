/**
 * Lecture de la table Ciqual.
 *
 * Ces fonctions sont séparées du script d'import pour être testables sans
 * réseau ni base de données : ce sont elles qui portent le risque, pas la
 * boucle d'écriture.
 */

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
      if (rawValue!.includes('<')) {
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

