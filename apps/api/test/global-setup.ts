import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? 'postgres://betterfit:betterfit@localhost:5434/betterfit_test';

/** Crée la base de test si elle n'existe pas encore : `pnpm db:up` suffit. */
async function ensureDatabaseExists(url: string): Promise<void> {
  const parsed = new URL(url);
  const name = parsed.pathname.slice(1);

  const admin = postgres(`${url.slice(0, url.lastIndexOf('/'))}/postgres`, {
    max: 1,
    onnotice: () => {},
  });

  try {
    const [existing] = await admin`select 1 from pg_database where datname = ${name}`;
    // `create database` n'accepte pas de paramètre : le nom vient de notre
    // propre URL, jamais d'une saisie utilisateur.
    if (!existing) await admin.unsafe(`create database "${name.replace(/"/g, '""')}"`);
  } finally {
    await admin.end();
  }
}

/** Prépare la base de test une fois pour toute la session. */
export default async function setup() {
  try {
    await ensureDatabaseExists(TEST_DATABASE_URL);
  } catch (error) {
    throw new Error(
      `PostgreSQL injoignable. Lance « pnpm db:up », puis réessaie.\n${String(error)}`,
    );
  }

  const sql = postgres(TEST_DATABASE_URL, { max: 1, onnotice: () => {} });

  try {
    await sql`create extension if not exists pg_trgm`;
    await sql`create extension if not exists unaccent`;
    await migrate(drizzle(sql), {
      migrationsFolder: new URL('../drizzle', import.meta.url).pathname,
    });
  } finally {
    await sql.end();
  }
}
