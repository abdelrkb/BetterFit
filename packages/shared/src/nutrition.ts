import { z } from 'zod';
import { ACTIVITY_COEFFICIENTS, type ActivityLevel, type Goal, type Sex } from './profile.js';

/**
 * Les calculs de nutrition, portés de `reference/prototype-studio.html`
 * (fonction `compute`), qui fait foi.
 *
 * Un seul endroit pour ces règles : l'app, l'API et les PDF les importent.
 * Ne jamais en recopier un morceau ailleurs.
 */

/** Kilocalories contenues dans un gramme de chaque macronutriment. */
export const KCAL_PER_GRAM = { protein: 4, carbs: 4, fat: 9 } as const;

/** Un kilo de masse grasse vaut environ 7 700 kcal. */
export const KCAL_PER_KG = 7700;

/** Hydratation conseillée : 35 ml par kilo de poids de corps. */
export const WATER_ML_PER_KG = 35;

/**
 * Au-delà de ce pourcentage du maintien, le déficit devient trop agressif :
 * fonte musculaire, fatigue, et reprise quasi certaine. L'app alerte.
 */
export const MAX_SAFE_DEFICIT_RATIO = 0.25;

/**
 * Écart au maintien proposé par défaut, selon l'objectif déclaré, en kcal.
 *
 * Volontairement prudent : 400 kcal de déficit, c'est environ 350 g par
 * semaine, un rythme qui se tient dans la durée et qui reste très en deçà du
 * seuil de `MAX_SAFE_DEFICIT_RATIO`. La prise de masse se fait en surplus
 * léger — au-delà, on prend surtout du gras.
 */
export const DEFAULT_DEFICIT_KCAL: Record<Goal, number> = {
  lose_fat: 400,
  maintain: 0,
  gain_muscle: -250,
};

/** Protéines et lipides proposés par défaut, en grammes par kilo. */
export const DEFAULT_PROTEIN_G_PER_KG = 1.8;
export const DEFAULT_FAT_G_PER_KG = 0.9;

export const nutritionInputSchema = z.object({
  sex: z.enum(['female', 'male']),
  age: z.number().int().min(13).max(110),
  weightKg: z.number().min(25).max(350),
  heightCm: z.number().min(100).max(250),
  activityLevel: z.enum([
    'sedentary',
    'light',
    'moderate',
    'active',
    'very_active',
  ] as const satisfies readonly ActivityLevel[]),
  /**
   * Écart aux calories de maintien, en kcal. Négatif pour une prise de poids
   * (surplus), positif pour une perte (déficit).
   */
  deficitKcal: z.number().min(-2000).max(2000).default(0),
  /** Protéines visées, en grammes par kilo de poids de corps. */
  proteinGPerKg: z.number().min(0.5).max(4).default(1.8),
  /** Lipides visés, en grammes par kilo. */
  fatGPerKg: z.number().min(0.3).max(3).default(0.9),
  /** Hydratation conseillée en litres. Calculée si absente. */
  waterLiters: z.number().min(0).max(10).nullable().default(null),
});
export type NutritionInput = z.infer<typeof nutritionInputSchema>;

export const nutritionTargetsSchema = z.object({
  /** Métabolisme de base (Mifflin-St Jeor). */
  bmrKcal: z.number(),
  /** Calories de maintien : métabolisme de base × coefficient d'activité. */
  maintenanceKcal: z.number(),
  deficitKcal: z.number(),
  /** Calories visées par jour. */
  targetKcal: z.number(),
  proteinG: z.number(),
  fatG: z.number(),
  carbsG: z.number(),
  proteinPct: z.number(),
  fatPct: z.number(),
  carbsPct: z.number(),
  /** Rythme estimé, en kilos par semaine. Négatif = prise de poids. */
  kgPerWeek: z.number(),
  /** Part du maintien que représente le déficit, en pourcentage. */
  deficitPct: z.number(),
  waterLiters: z.number(),
  /** Vrai quand le déficit dépasse le seuil raisonnable. */
  deficitTooLarge: z.boolean(),
});
export type NutritionTargets = z.infer<typeof nutritionTargetsSchema>;

/**
 * Métabolisme de base, formule de Mifflin-St Jeor.
 *
 * `10 × poids + 6,25 × taille − 5 × âge + 5` chez l'homme, `− 161` chez la
 * femme. C'est la formule la plus fiable sans mesure de composition
 * corporelle.
 */
export function basalMetabolicRate(input: {
  sex: Sex;
  weightKg: number;
  heightCm: number;
  age: number;
}): number {
  return (
    10 * input.weightKg + 6.25 * input.heightCm - 5 * input.age + (input.sex === 'male' ? 5 : -161)
  );
}

/** Calcule toutes les cibles d'un coup. */
export function computeNutritionTargets(input: NutritionInput): NutritionTargets {
  const bmrKcal = basalMetabolicRate(input);
  const maintenanceKcal = bmrKcal * ACTIVITY_COEFFICIENTS[input.activityLevel];
  const targetKcal = maintenanceKcal - input.deficitKcal;

  const proteinG = input.proteinGPerKg * input.weightKg;
  const fatG = input.fatGPerKg * input.weightKg;

  // Les glucides prennent ce qui reste, jamais moins que zéro : un objectif
  // trop bas avec beaucoup de protéines et de lipides peut tout consommer.
  const carbsG = Math.max(
    0,
    (targetKcal - proteinG * KCAL_PER_GRAM.protein - fatG * KCAL_PER_GRAM.fat) /
      KCAL_PER_GRAM.carbs,
  );

  const share = (kcal: number) => (targetKcal > 0 ? Math.round((kcal / targetKcal) * 100) : 0);

  return nutritionTargetsSchema.parse({
    bmrKcal: round(bmrKcal),
    maintenanceKcal: round(maintenanceKcal),
    deficitKcal: input.deficitKcal,
    targetKcal: round(targetKcal),
    proteinG: round(proteinG),
    fatG: round(fatG),
    carbsG: round(carbsG),
    proteinPct: share(proteinG * KCAL_PER_GRAM.protein),
    fatPct: share(fatG * KCAL_PER_GRAM.fat),
    carbsPct: share(carbsG * KCAL_PER_GRAM.carbs),
    kgPerWeek: round((input.deficitKcal * 7) / KCAL_PER_KG, 2),
    deficitPct: maintenanceKcal > 0 ? round((input.deficitKcal / maintenanceKcal) * 100) : 0,
    waterLiters: input.waterLiters ?? round((input.weightKg * WATER_ML_PER_KG) / 1000, 1),
    deficitTooLarge:
      maintenanceKcal > 0 && input.deficitKcal / maintenanceKcal > MAX_SAFE_DEFICIT_RATIO,
  });
}

/** Totaux d'un ensemble de lignes alimentaires. */
export type MacroTotals = {
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
};

export const EMPTY_TOTALS: MacroTotals = { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 };

export function sumMacros(items: Partial<MacroTotals>[]): MacroTotals {
  return items.reduce<MacroTotals>(
    (total, item) => ({
      kcal: round(total.kcal + (item.kcal ?? 0)),
      proteinG: round(total.proteinG + (item.proteinG ?? 0), 1),
      carbsG: round(total.carbsG + (item.carbsG ?? 0), 1),
      fatG: round(total.fatG + (item.fatG ?? 0), 1),
    }),
    EMPTY_TOTALS,
  );
}

/**
 * Valeurs d'un aliment pour une quantité donnée, à partir des valeurs
 * pour 100 g.
 */
export function macrosForQuantity(per100g: Partial<MacroTotals>, grams: number): MacroTotals {
  const ratio = grams / 100;

  return {
    kcal: round((per100g.kcal ?? 0) * ratio),
    proteinG: round((per100g.proteinG ?? 0) * ratio, 1),
    carbsG: round((per100g.carbsG ?? 0) * ratio, 1),
    fatG: round((per100g.fatG ?? 0) * ratio, 1),
  };
}

/** Kilocalories reconstituées depuis les macros, quand elles manquent. */
export function kcalFromMacros(macros: Omit<MacroTotals, 'kcal'>): number {
  return round(
    macros.proteinG * KCAL_PER_GRAM.protein +
      macros.carbsG * KCAL_PER_GRAM.carbs +
      macros.fatG * KCAL_PER_GRAM.fat,
  );
}

function round(value: number, digits = 0): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}
