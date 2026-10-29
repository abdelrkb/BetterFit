import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { promisify } from 'node:util';
import { buildFoodSearchText } from '@betterfit/shared';
import { sql as raw } from 'drizzle-orm';
import { db, sql } from '../db/client.js';
import { parseAmount, parseFlatXml } from '../foods/ciqual.js';
import { foods } from '../db/schema.js';
import { DATA_DIR } from '../paths.js';

/**
 * Importe la table Ciqual de l'ANSES : les aliments génériques français
 * (« Riz blanc cuit », « Blanc de poulet rôti »), environ 3 200 entrées.
 *
 * Licence Ouverte (Etalab) : réutilisation libre, **attribution obligatoire**.
 * L'app affiche « Source : table Ciqual 2020, ANSES » partout où ces valeurs
 * apparaissent (`FOOD_SOURCE_ATTRIBUTION_FR`).
 *
 * Le script est **rejouable** : relancé sur une nouvelle version de la table,
 * il met à jour les aliments existants par leur code Ciqual et ajoute les
 * nouveaux, sans toucher aux aliments perso ni aux produits scannés.
 *
 *   pnpm foods:import                    # télécharge et importe
 *   pnpm foods:import --file chemin.zip  # depuis une archive déjà téléchargée
 *
 * L'archive est celle publiée sur data.gouv.fr, qui redirige vers l'ANSES.
 * Quand le site de l'ANSES est en maintenance, télécharger l'archive à la
 * main et passer `--file` fait tout aussi bien l'affaire.
 */

const CIQUAL_ZIP_URL = 'https://www.data.gouv.fr/fr/datasets/r/e31dd87c-8ad0-43e4-bdaa-af84ad243dc6';

/** Où l'archive est conservée, pour ne pas la retélécharger à chaque fois. */
const CACHE_DIR = resolve(DATA_DIR, 'foods');

const execFileAsync = promisify(execFile);

/**
 * Les nutriments qu'on garde, reconnus par leur **nom** dans `const_*.xml`.
 *
 * On cherche par nom plutôt que par code : les codes de constituants ont déjà
 * changé entre deux versions de la table, et un code erroné importerait
 * silencieusement la mauvaise colonne — une erreur qu'aucun test ne
 * rattraperait, puisque le chiffre reste plausible.
 */
const NUTRIENTS = [
  { column: 'kcal', match: /^energie.*1169\/2011.*kcal/i },
  { column: 'proteinG', match: /^prot[ée]ines, N x facteur de Jones/i },
  { column: 'carbsG', match: /^glucides/i },
  { column: 'sugarsG', match: /^sucres/i },
  { column: 'fatG', match: /^lipides/i },
  { column: 'saturatedFatG', match: /^ag satur[ée]s/i },
  { column: 'fiberG', match: /^fibres alimentaires/i },
  { column: 'saltG', match: /^sel chlorure de sodium/i },
] as const;

type NutrientColumn = (typeof NUTRIENTS)[number]['column'];

async function downloadArchive(target: string): Promise<void> {
  console.log('Téléchargement de la table Ciqual…');

  const response = await fetch(CIQUAL_ZIP_URL, {
    headers: { 'user-agent': 'BetterFit/0.1 (import Ciqual)' },
  });

  if (!response.ok) {
    throw new Error(
      `L'ANSES a répondu ${response.status}. Son site est parfois en maintenance : ` +
        'réessaie plus tard, ou télécharge l’archive à la main et passe --file.',
    );
  }

  const bytes = Buffer.from(await response.arrayBuffer());

  // Une page de maintenance est servie avec le bon type MIME : on vérifie la
  // signature du fichier, pas l'en-tête.
  if (bytes.subarray(0, 2).toString() !== 'PK') {
    throw new Error(
      'Le fichier reçu n’est pas une archive ZIP (page de maintenance ?). ' +
        'Télécharge l’archive à la main et passe --file.',
    );
  }

  await mkdir(CACHE_DIR, { recursive: true });
  await writeFile(target, bytes);
  console.log(`Archive enregistrée : ${target} (${Math.round(bytes.byteLength / 1024)} Ko)`);
}

async function extract(archive: string, into: string): Promise<void> {
  await mkdir(into, { recursive: true });

  try {
    await execFileAsync('unzip', ['-o', '-q', archive, '-d', into]);
  } catch {
    throw new Error(
      'Décompression impossible : la commande `unzip` est introuvable. ' +
        'Installe-la, ou décompresse l’archive à la main dans ' +
        into,
    );
  }
}

/** Retrouve un fichier par son préfixe, quelle que soit la date du nom. */
async function findFile(dir: string, prefix: string): Promise<string> {
  const names = await readdir(dir);
  const found = names.find((name) => name.toLowerCase().startsWith(prefix) && name.endsWith('.xml'));

  if (!found) {
    throw new Error(`Fichier ${prefix}*.xml introuvable dans l’archive. Le format a changé.`);
  }

  return resolve(dir, found);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const fileIndex = args.indexOf('--file');
  const archive =
    fileIndex >= 0 && args[fileIndex + 1]
      ? resolve(args[fileIndex + 1]!)
      : resolve(CACHE_DIR, 'ciqual.zip');

  if (!existsSync(archive)) {
    await downloadArchive(archive);
  } else {
    console.log(`Archive déjà présente : ${archive}`);
  }

  const workDir = resolve(CACHE_DIR, 'ciqual');
  await extract(archive, workDir);

  const [alimXml, compoXml, constXml] = await Promise.all([
    readFile(await findFile(workDir, 'alim_2'), 'utf8'),
    readFile(await findFile(workDir, 'compo'), 'utf8'),
    readFile(await findFile(workDir, 'const'), 'utf8'),
  ]);

  const alims = parseFlatXml(alimXml, 'ALIM');
  const compos = parseFlatXml(compoXml, 'COMPO');
  const consts = parseFlatXml(constXml, 'CONST');

  console.log(`${alims.length} aliments, ${compos.length} teneurs, ${consts.length} constituants.`);

  // Quel code de constituant correspond à quelle colonne chez nous.
  const columnOfConst = new Map<string, NutrientColumn>();

  for (const row of consts) {
    const name = row.const_nom_fr ?? '';
    const nutrient = NUTRIENTS.find((candidate) => candidate.match.test(name));
    if (nutrient && row.const_code) columnOfConst.set(row.const_code, nutrient.column);
  }

  const missing = NUTRIENTS.filter(
    (nutrient) => ![...columnOfConst.values()].includes(nutrient.column),
  );

  if (missing.length > 0) {
    throw new Error(
      `Constituants introuvables dans la table : ${missing.map((n) => n.column).join(', ')}. ` +
        'Les noms ont changé : il faut mettre à jour NUTRIENTS.',
    );
  }

  // Les teneurs, regroupées par aliment.
  const nutrientsOf = new Map<string, Partial<Record<NutrientColumn, number | null>>>();

  for (const row of compos) {
    const column = row.const_code ? columnOfConst.get(row.const_code) : undefined;
    if (!column || !row.alim_code) continue;

    const current = nutrientsOf.get(row.alim_code) ?? {};
    current[column] = parseAmount(row.teneur ?? '');
    nutrientsOf.set(row.alim_code, current);
  }

  const rows = alims
    .filter((alim) => alim.alim_code && alim.alim_nom_fr)
    .map((alim) => {
      const values = nutrientsOf.get(alim.alim_code!) ?? {};
      const name = alim.alim_nom_fr!;
      const category = alim.alim_ssssgrp_nom_fr || alim.alim_ssgrp_nom_fr || alim.alim_grp_nom_fr || '';

      return {
        source: 'ciqual' as const,
        ownerId: null,
        externalId: alim.alim_code!,
        barcode: null,
        name,
        brand: '',
        category,
        kcal: values.kcal ?? null,
        proteinG: values.proteinG ?? null,
        carbsG: values.carbsG ?? null,
        sugarsG: values.sugarsG ?? null,
        fatG: values.fatG ?? null,
        saturatedFatG: values.saturatedFatG ?? null,
        fiberG: values.fiberG ?? null,
        saltG: values.saltG ?? null,
        servingLabel: '',
        servingG: null,
        searchText: buildFoodSearchText({ name, category }),
      };
    });

  console.log(`${rows.length} aliments prêts à importer.`);

  // Par paquets : une seule requête de 3 000 lignes dépasse la limite de
  // paramètres de PostgreSQL.
  const BATCH = 400;
  let written = 0;

  for (let index = 0; index < rows.length; index += BATCH) {
    const batch = rows.slice(index, index + BATCH);

    await db
      .insert(foods)
      .values(batch)
      .onConflictDoUpdate({
        target: [foods.source, foods.externalId],
        // `excluded` est la ligne qu'on vient d'essayer d'insérer : une
        // nouvelle version de la table écrase l'ancienne, sans toucher aux
        // aliments perso ni aux produits scannés, qui ont une autre source.
        set: {
          name: raw`excluded.name`,
          category: raw`excluded.category`,
          kcal: raw`excluded.kcal`,
          proteinG: raw`excluded.protein_g`,
          carbsG: raw`excluded.carbs_g`,
          sugarsG: raw`excluded.sugars_g`,
          fatG: raw`excluded.fat_g`,
          saturatedFatG: raw`excluded.saturated_fat_g`,
          fiberG: raw`excluded.fiber_g`,
          saltG: raw`excluded.salt_g`,
          searchText: raw`excluded.search_text`,
          updatedAt: new Date(),
        },
      });

    written += batch.length;
    process.stdout.write(`\r${written} / ${rows.length}`);
  }

  console.log(`\n${written} aliments importés. Source : table Ciqual, ANSES — Licence Ouverte.`);

  await sql.end();
}

await main().catch(async (error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  await sql.end();
  process.exit(1);
});
