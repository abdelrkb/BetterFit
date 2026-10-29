import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { env } from '../env.js';
import * as schema from './schema.js';

/** Connexion partagée par l'API. `max: 10` suffit largement pour un VPS. */
export const sql = postgres(env.DATABASE_URL, { max: 10, onnotice: () => {} });

export const db = drizzle(sql, { schema });

export type Database = typeof db;
