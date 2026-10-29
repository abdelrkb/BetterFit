import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname } from 'node:path';
import {
  categorySchema,
  equipmentSchema,
  forceSchema,
  levelSchema,
  mechanicSchema,
  muscleSchema,
  MUSCLE_LABELS_FR,
  type Muscle,
} from '@betterfit/shared';
import { eq } from 'drizzle-orm';
import { db, sql } from '../db/client.js';
import { exercises } from '../db/schema.js';
import { translateExerciseName } from '../exercises/translate-name.js';
import { buildSearchText } from '../exercises/search-text.js';
import { DATA_DIR, UPLOADS_DIR, exerciseImagePath } from '../paths.js';

/**
 * Importe la bibliothèque d'exercices depuis free-exercise-db
 * (873 exercices, licence Unlicense — domaine public).
 *
 * Le script est **rejouable** : relancé, il met à jour les exercices existants
 * sans toucher aux traductions françaises déjà écrites, et ne retélécharge pas
 * les photos déjà présentes.
 *
 *   pnpm exercises:import              # tout
 *   pnpm exercises:import --no-images  # sans les photos (rapide)
 */

const SOURCE_JSON =
  'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json';
const IMAGE_BASE = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises';

/** Téléchargements d'images menés de front. Au-delà, GitHub ralentit. */
const IMAGE_CONCURRENCY = 12;

type SourceExercise = {
  id?: string;
  name: string;
  force: string | null;
  level: string;
  mechanic: string | null;
  equipment: string | null;
  primaryMuscles: string[];
  secondaryMuscles: string[];
  instructions: string[];
  category: string;
  images: string[];
};

const skipImages = process.argv.includes('--no-images');

/** Corrections de noms écrites à la main, qui l'emportent sur les règles. */
async function loadNameOverrides(): Promise<Record<string, string>> {
  const path = `${DATA_DIR}/exercises/name-overrides.json`;
  if (!existsSync(path)) return {};

  return JSON.parse(await readFile(path, 'utf8')) as Record<string, string>;
}

/**
 * Traductions des consignes, écrites depuis l'application puis exportées par
 * `pnpm exercises:export-translations`. Relues ici pour qu'un réimport ne
 * perde jamais le travail de traduction.
 */
async function loadInstructionTranslations(): Promise<Record<string, string[]>> {
  const path = `${DATA_DIR}/exercises/instructions.fr.json`;
  if (!existsSync(path)) return {};

  return JSON.parse(await readFile(path, 'utf8')) as Record<string, string[]>;
}

function toMuscles(values: string[]): Muscle[] {
  return values.filter((value): value is Muscle => muscleSchema.safeParse(value).success);
}

async function downloadImage(remotePath: string): Promise<boolean> {
  const destination = exerciseImagePath(remotePath);
  if (existsSync(destination)) return false;

  const response = await fetch(`${IMAGE_BASE}/${remotePath}`);
  if (!response.ok) {
    console.warn(`  photo manquante : ${remotePath} (HTTP ${response.status})`);
    return false;
  }

  await mkdir(dirname(destination), { recursive: true });
  await writeFile(destination, Buffer.from(await response.arrayBuffer()));

  return true;
}

/** Télécharge par petits paquets, pour ne pas ouvrir 1 700 connexions. */
async function downloadImages(paths: string[]): Promise<number> {
  let downloaded = 0;
  let index = 0;

  async function worker() {
    for (;;) {
      const current = index++;
      if (current >= paths.length) return;

      try {
        if (await downloadImage(paths[current]!)) downloaded += 1;
      } catch (error) {
        console.warn(`  photo en échec : ${paths[current]} (${String(error)})`);
      }

      if (downloaded > 0 && downloaded % 200 === 0) {
        console.log(`  ${downloaded} photos téléchargées…`);
      }
    }
  }

  await Promise.all(Array.from({ length: IMAGE_CONCURRENCY }, worker));

  return downloaded;
}

console.log('Téléchargement de la base d’exercices…');
const response = await fetch(SOURCE_JSON);
if (!response.ok) throw new Error(`free-exercise-db injoignable (HTTP ${response.status}).`);

const source = (await response.json()) as SourceExercise[];
console.log(`  ${source.length} exercices reçus.`);

const nameOverrides = await loadNameOverrides();
const instructionTranslations = await loadInstructionTranslations();

let created = 0;
let updated = 0;
let keptEnglishName = 0;

for (const item of source) {
  const externalId = item.id ?? item.name;
  const override = nameOverrides[externalId] ?? nameOverrides[item.name];
  const translation = translateExerciseName(item.name);
  const name = override ?? translation.name;

  if (!override && !translation.translated) keptEnglishName += 1;

  const primaryMuscles = toMuscles(item.primaryMuscles);
  const secondaryMuscles = toMuscles(item.secondaryMuscles);

  const equipment = equipmentSchema.safeParse(item.equipment ?? 'other');
  const level = levelSchema.safeParse(item.level);
  const category = categorySchema.safeParse(item.category);
  const force = forceSchema.safeParse(item.force);
  const mechanic = mechanicSchema.safeParse(item.mechanic);

  if (!equipment.success || !level.success || !category.success) {
    console.warn(`  ignoré (champ inattendu) : ${item.name}`);
    continue;
  }

  const instructionsFr = instructionTranslations[externalId] ?? [];

  const values = {
    source: 'library' as const,
    ownerId: null,
    externalId,
    name,
    nameEn: item.name,
    primaryMuscles,
    secondaryMuscles,
    equipment: equipment.data,
    level: level.data,
    category: category.data,
    force: force.success ? force.data : null,
    mechanic: mechanic.success ? mechanic.data : null,
    instructionsEn: item.instructions,
    images: item.images,
    searchText: buildSearchText({
      name,
      nameEn: item.name,
      muscles: [...primaryMuscles, ...secondaryMuscles].map((m) => MUSCLE_LABELS_FR[m]),
    }),
    updatedAt: new Date(),
  };

  const [existing] = await db
    .select({ id: exercises.id, instructions: exercises.instructions })
    .from(exercises)
    .where(eq(exercises.externalId, externalId));

  if (existing) {
    await db
      .update(exercises)
      // Les consignes déjà traduites dans l'app l'emportent : un réimport ne
      // doit jamais effacer ce travail.
      .set({
        ...values,
        instructions: existing.instructions.length > 0 ? existing.instructions : instructionsFr,
      })
      .where(eq(exercises.id, existing.id));
    updated += 1;
  } else {
    await db.insert(exercises).values({ ...values, instructions: instructionsFr });
    created += 1;
  }
}

console.log(`  ${created} créés, ${updated} mis à jour.`);
console.log(`  ${keptEnglishName} noms gardés en anglais (traduction à affiner dans l’app).`);

if (skipImages) {
  console.log('Photos ignorées (--no-images).');
} else {
  const allImages = source.flatMap((item) => item.images);
  console.log(`Photos : ${allImages.length} attendues dans ${UPLOADS_DIR}/exercises…`);
  const downloaded = await downloadImages(allImages);
  console.log(`  ${downloaded} téléchargées, le reste était déjà là.`);
}

console.log('Import terminé.');
await sql.end();
