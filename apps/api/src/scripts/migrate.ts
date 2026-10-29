import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { env } from '../env.js';

// Une connexion dédiée (max: 1) : recommandé pour les migrations.
const sql = postgres(env.DATABASE_URL, { max: 1, onnotice: () => {} });

// Extensions nécessaires à la recherche d'aliments et d'exercices (étapes 3 et 8).
await sql`create extension if not exists pg_trgm`;
await sql`create extension if not exists unaccent`;

await migrate(drizzle(sql), {
  migrationsFolder: new URL('../../drizzle', import.meta.url).pathname,
});

console.log('Migrations appliquées.');
await sql.end();
