import { eq } from 'drizzle-orm';
import { hashPassword } from '../auth/password.js';
import { db, sql } from '../db/client.js';
import { profiles, users, weightEntries } from '../db/schema.js';

/**
 * Données de démonstration : un compte prêt à l'emploi pour tester sans
 * passer par l'inscription. Rejouable : relancer le script ne crée pas de
 * doublon.
 */
const DEMO_EMAIL = 'julie@exemple.fr';
const DEMO_PASSWORD = 'betterfit2026';

const [existing] = await db.select().from(users).where(eq(users.email, DEMO_EMAIL));

const user =
  existing ??
  (
    await db
      .insert(users)
      .values({
        email: DEMO_EMAIL,
        name: 'Julie',
        passwordHash: await hashPassword(DEMO_PASSWORD),
        healthDataConsentAt: new Date(),
      })
      .returning()
  )[0];

if (!user) throw new Error('Impossible de créer le compte de démonstration.');

await db
  .insert(profiles)
  .values({
    userId: user.id,
    sex: 'female',
    birthDate: '1992-04-15',
    heightCm: 168,
    activityLevel: 'moderate',
    goal: 'lose_fat',
    weeklySessions: 3,
  })
  .onConflictDoNothing();

await db
  .insert(weightEntries)
  .values({ userId: user.id, date: new Date().toISOString().slice(0, 10), weightKg: 68.4 })
  .onConflictDoNothing();

console.log(`Compte de démonstration prêt : ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);

await sql.end();
