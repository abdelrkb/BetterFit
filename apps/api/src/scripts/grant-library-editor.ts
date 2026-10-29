import { eq } from 'drizzle-orm';
import { db, sql } from '../db/client.js';
import { users } from '../db/schema.js';

/**
 * Donne (ou retire) à un compte le droit de corriger les traductions de la
 * bibliothèque partagée.
 *
 *   pnpm library:editor julie@exemple.fr
 *   pnpm library:editor julie@exemple.fr --retirer
 */
const email = process.argv[2]?.trim().toLowerCase();
const grant = !process.argv.includes('--retirer');

if (!email) {
  console.error('Donne une adresse e-mail : pnpm library:editor adresse@exemple.fr');
  process.exit(1);
}

const [updated] = await db
  .update(users)
  .set({ canEditLibrary: grant, updatedAt: new Date() })
  .where(eq(users.email, email))
  .returning({ email: users.email, canEditLibrary: users.canEditLibrary });

if (!updated) {
  console.error(`Aucun compte avec l'adresse ${email}.`);
  process.exit(1);
}

console.log(
  updated.canEditLibrary
    ? `${updated.email} peut maintenant corriger la bibliothèque.`
    : `${updated.email} ne peut plus corriger la bibliothèque.`,
);

await sql.end();
