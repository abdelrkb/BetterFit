import { z } from 'zod';
import { nutritionTargetsSchema, type MacroTotals } from './nutrition.js';
import { dateOnlySchema } from './profile.js';

/**
 * Le journal alimentaire.
 *
 * Une ligne enregistre ce qu'on a mangé **avec ses valeurs figées** : on
 * recopie les calories et les macros au moment de la saisie plutôt que de
 * les recalculer à l'affichage. Si un aliment est corrigé plus tard, ou si
 * une nouvelle version de la table Ciqual change un chiffre, les journées
 * passées ne bougent pas. On ne réécrit pas l'histoire de ce que quelqu'un
 * a mangé.
 */

export const mealSlotSchema = z.enum(['breakfast', 'lunch', 'dinner', 'snack']);
export type MealSlot = z.infer<typeof mealSlotSchema>;

/** Dans l'ordre de la journée. */
export const MEAL_SLOTS: readonly MealSlot[] = ['breakfast', 'lunch', 'dinner', 'snack'];

export const MEAL_SLOT_LABELS_FR: Record<MealSlot, string> = {
  breakfast: 'Petit-déjeuner',
  lunch: 'Déjeuner',
  dinner: 'Dîner',
  snack: 'Collations',
};

export const foodLogSchema = z.object({
  id: z.uuid(),
  date: z.string(),
  slot: mealSlotSchema,
  /** L'aliment d'origine, pour le remettre en un geste. `null` en saisie rapide. */
  foodId: z.uuid().nullable(),
  label: z.string(),
  quantityG: z.number().nullable(),
  quantityText: z.string(),
  /** Valeurs de **la quantité mangée**, pas pour 100 g. */
  kcal: z.number().nullable(),
  proteinG: z.number().nullable(),
  carbsG: z.number().nullable(),
  fatG: z.number().nullable(),
});
export type FoodLog = z.infer<typeof foodLogSchema>;

/**
 * Ce qu'on envoie pour ajouter une ligne.
 *
 * Deux formes, et une seule règle : si `foodId` est donné avec une quantité
 * en grammes, le serveur calcule les valeurs lui-même depuis l'aliment. Sinon
 * c'est une saisie rapide, et on prend ce qui est envoyé — un nom et des
 * calories suffisent, les macros restent facultatives.
 */
export const foodLogInputSchema = z.object({
  date: dateOnlySchema,
  slot: mealSlotSchema,
  foodId: z.uuid().nullable().default(null),
  label: z.string().trim().max(160).default(''),
  quantityG: z.number().min(0).max(10000).nullable().default(null),
  quantityText: z.string().trim().max(80).default(''),
  kcal: z.number().min(0).max(10000).nullable().default(null),
  proteinG: z.number().min(0).max(1000).nullable().default(null),
  carbsG: z.number().min(0).max(1000).nullable().default(null),
  fatG: z.number().min(0).max(1000).nullable().default(null),
});
export type FoodLogInput = z.infer<typeof foodLogInputSchema>;

export const macroTotalsOutSchema = z.object({
  kcal: z.number(),
  proteinG: z.number(),
  carbsG: z.number(),
  fatG: z.number(),
});

export const journalDaySchema = z.object({
  date: z.string(),
  entries: z.array(foodLogSchema),
  /** Totaux par moment de la journée. */
  slotTotals: z.record(mealSlotSchema, macroTotalsOutSchema),
  totals: macroTotalsOutSchema,
  /**
   * Les cibles du jour : celles du programme de nutrition actif, ou celles
   * déduites du profil. `null` tant qu'il manque le profil **et** le poids.
   */
  targets: nutritionTargetsSchema.nullable(),
  /** D'où viennent ces cibles, pour le dire à la personne. */
  targetsFrom: z.enum(['program', 'profile', 'none']),
});
export type JournalDay = z.infer<typeof journalDaySchema>;

export const copyDaySchema = z.object({
  from: dateOnlySchema,
  to: dateOnlySchema,
  /** Un seul moment, ou toute la journée si absent. */
  slot: mealSlotSchema.optional(),
});
export type CopyDayInput = z.infer<typeof copyDaySchema>;

/** Totaux d'un ensemble de lignes de journal. Une valeur absente vaut zéro. */
export function journalTotals(entries: Pick<FoodLog, 'kcal' | 'proteinG' | 'carbsG' | 'fatG'>[]): MacroTotals {
  // Type explicite : sans lui, TypeScript aligne l'accumulateur sur le type
  // des lignes, dont les valeurs sont `number | null`.
  const totals = entries.reduce<MacroTotals>(
    (sum, entry) => ({
      kcal: sum.kcal + (entry.kcal ?? 0),
      proteinG: sum.proteinG + (entry.proteinG ?? 0),
      carbsG: sum.carbsG + (entry.carbsG ?? 0),
      fatG: sum.fatG + (entry.fatG ?? 0),
    }),
    { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 },
  );

  return {
    kcal: Math.round(totals.kcal),
    proteinG: round1(totals.proteinG),
    carbsG: round1(totals.carbsG),
    fatG: round1(totals.fatG),
  };
}

/** Les totaux de chaque moment de la journée. */
export function totalsBySlot(
  entries: (Pick<FoodLog, 'kcal' | 'proteinG' | 'carbsG' | 'fatG'> & { slot: MealSlot })[],
): Record<MealSlot, MacroTotals> {
  return Object.fromEntries(
    MEAL_SLOTS.map((slot) => [slot, journalTotals(entries.filter((entry) => entry.slot === slot))]),
  ) as Record<MealSlot, MacroTotals>;
}

/** Date du jour au format `AAAA-MM-JJ`, dans le fuseau de l'appareil. */
export function today(now = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

/** Le jour précédent ou suivant, pour la navigation du journal. */
export function shiftDate(date: string, days: number): string {
  const parsed = new Date(`${date}T12:00:00Z`);
  parsed.setUTCDate(parsed.getUTCDate() + days);

  return parsed.toISOString().slice(0, 10);
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}
