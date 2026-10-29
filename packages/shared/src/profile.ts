import { z } from 'zod';

/**
 * Le profil : les données personnelles qui préremplissent les calculs de
 * nutrition (étape 7) et les suggestions de charge (étape 5).
 */

/** Sexe biologique, utilisé par la formule de Mifflin-St Jeor. */
export const sexSchema = z.enum(['female', 'male']);
export type Sex = z.infer<typeof sexSchema>;

/**
 * Niveau d'activité. Le coefficient multiplie le métabolisme de base pour
 * obtenir le maintien ; les valeurs viennent du prototype.
 */
export const activityLevelSchema = z.enum([
  'sedentary',
  'light',
  'moderate',
  'active',
  'very_active',
]);
export type ActivityLevel = z.infer<typeof activityLevelSchema>;

export const ACTIVITY_COEFFICIENTS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

export const goalSchema = z.enum(['lose_fat', 'maintain', 'gain_muscle']);
export type Goal = z.infer<typeof goalSchema>;

/** Bornes de saisie, volontairement larges mais qui écartent les fautes de frappe. */
export const HEIGHT_CM_MIN = 100;
export const HEIGHT_CM_MAX = 250;
export const WEIGHT_KG_MIN = 25;
export const WEIGHT_KG_MAX = 350;
export const AGE_MIN = 13;
export const AGE_MAX = 110;

export const heightCmSchema = z.number().int().min(HEIGHT_CM_MIN).max(HEIGHT_CM_MAX);
export const weightKgSchema = z.number().min(WEIGHT_KG_MIN).max(WEIGHT_KG_MAX);

/** Date au format `AAAA-MM-JJ`, sans heure ni fuseau. */
export const dateOnlySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date attendue au format AAAA-MM-JJ');

/** Date de naissance : une vraie date, et un âge plausible. */
export const birthDateSchema = dateOnlySchema.refine(
  (value) => {
    const age = ageFromBirthDate(value);
    return age !== null && age >= AGE_MIN && age <= AGE_MAX;
  },
  { message: `L’âge doit être compris entre ${AGE_MIN} et ${AGE_MAX} ans.` },
);

/** Âge en années révolues, ou `null` si la date n'est pas valide. */
export function ageFromBirthDate(birthDate: string, today = new Date()): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(birthDate);
  if (!match) return null;

  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(Date.UTC(year, month - 1, day));

  // Rejette les dates qui n'existent pas, par exemple le 31 février.
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  let age = today.getUTCFullYear() - year;
  const birthdayPassed =
    today.getUTCMonth() > month - 1 ||
    (today.getUTCMonth() === month - 1 && today.getUTCDate() >= day);

  if (!birthdayPassed) age -= 1;

  return age;
}

export const profileSchema = z.object({
  sex: sexSchema,
  birthDate: birthDateSchema,
  heightCm: heightCmSchema,
  activityLevel: activityLevelSchema,
  goal: goalSchema,
  /** Nombre de séances de sport par semaine, utilisé par les calculs. */
  weeklySessions: z.number().int().min(0).max(14),
});

export type Profile = z.infer<typeof profileSchema>;

/** Mise à jour partielle depuis l'écran Profil. */
export const profileUpdateSchema = profileSchema.partial();
export type ProfileUpdate = z.infer<typeof profileUpdateSchema>;

/**
 * Ce que l'onboarding envoie : le profil, le prénom et le premier poids.
 * Le poids part dans `weight_entries` (étape 9), pas dans le profil : le profil
 * décrit ce qui ne bouge pas, le poids est une mesure datée.
 */
export const onboardingSchema = profileSchema.extend({
  name: z.string().trim().min(1).max(80),
  weightKg: weightKgSchema,
});

export type OnboardingInput = z.infer<typeof onboardingSchema>;
