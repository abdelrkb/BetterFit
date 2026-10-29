import { afterAll, beforeEach } from 'vitest';
import { db, sql } from '../src/db/client.js';

/**
 * Chaque test part d'une base vide. `truncate ... cascade` est bien plus
 * rapide que de rejouer les migrations, et `restart identity` remet les
 * séquences à zéro.
 */
beforeEach(async () => {
  await db.execute(
    'truncate table users, coaching_relations, invitations, coach_settings, workout_logs, programs, exercises, auth_identities, refresh_tokens, password_reset_tokens, profiles, weight_entries, auth_attempts restart identity cascade',
  );
});

afterAll(async () => {
  await sql.end();
});
