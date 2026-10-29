import { mkdir, writeFile } from 'node:fs/promises';
import { and, eq, isNotNull } from 'drizzle-orm';
import { db, sql } from '../db/client.js';
import { exercises } from '../db/schema.js';
import { DATA_DIR } from '../paths.js';

/**
 * Sauvegarde dans le dépôt les traductions écrites depuis l'application.
 *
 * Sans ce script, le travail de traduction vivrait seulement dans la base :
 * il disparaîtrait à la prochaine réinstallation. Le fichier produit est relu
 * par `pnpm exercises:import`.
 */
const rows = await db
  .select({
    externalId: exercises.externalId,
    name: exercises.name,
    nameEn: exercises.nameEn,
    instructions: exercises.instructions,
  })
  .from(exercises)
  .where(and(eq(exercises.source, 'library'), isNotNull(exercises.externalId)))
  .orderBy(exercises.externalId);

const instructions: Record<string, string[]> = {};
const names: Record<string, string> = {};

for (const row of rows) {
  if (!row.externalId) continue;
  if (row.instructions.length > 0) instructions[row.externalId] = row.instructions;
}

// On n'exporte que les noms réellement retouchés, pas ceux que les règles de
// traduction savent reproduire : le fichier reste court et lisible.
const { translateExerciseName } = await import('../exercises/translate-name.js');

for (const row of rows) {
  if (!row.externalId || !row.nameEn) continue;
  if (translateExerciseName(row.nameEn).name !== row.name) names[row.externalId] = row.name;
}

const directory = `${DATA_DIR}/exercises`;
await mkdir(directory, { recursive: true });

await writeFile(
  `${directory}/instructions.fr.json`,
  `${JSON.stringify(instructions, null, 2)}\n`,
  'utf8',
);

await writeFile(`${directory}/name-overrides.json`, `${JSON.stringify(names, null, 2)}\n`, 'utf8');

const translated = Object.keys(instructions).length;
console.log(
  `${translated} exercice(s) avec consignes traduites → data/exercises/instructions.fr.json`,
);
console.log(`${Object.keys(names).length} nom(s) retouché(s) → data/exercises/name-overrides.json`);
console.log('Pense à committer ces deux fichiers.');

await sql.end();
