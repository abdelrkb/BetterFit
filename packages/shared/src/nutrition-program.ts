import { z } from 'zod';
import {
  computeNutritionTargets,
  kcalFromMacros,
  nutritionTargetsSchema,
  type MacroTotals,
} from './nutrition.js';
import { activityLevelSchema, dateOnlySchema, sexSchema } from './profile.js';

/**
 * Les programmes de nutrition.
 *
 * Comme un programme de musculation, il s'enregistre **d'un bloc** : réglages,
 * repas, lignes, liste de courses et recettes partent dans la même requête.
 * L'éditeur manipule un document entier, comme le prototype.
 *
 * `reference/prototype-studio.html` fait foi, en mode Nutrition.
 */

/* ------------------------------------------------------------------ */
/* La journée type                                                     */
/* ------------------------------------------------------------------ */

/**
 * Une ligne de repas.
 *
 * Deux modes de saisie, ligne par ligne : un aliment de la base avec sa
 * quantité en grammes (macros calculées, étape 8), ou du texte libre avec
 * les valeurs à la main, comme dans le prototype.
 */
export const mealItemSchema = z.object({
  /** Absent tant que la ligne n'a pas été enregistrée. */
  id: z.uuid().optional(),
  foodId: z.uuid().nullable().default(null),
  label: z.string().trim().max(160).default(''),
  /** Quantité en toutes lettres : « 160 g », « 2 œufs », « à volonté ». */
  quantity: z.string().trim().max(80).default(''),
  /** La même quantité en grammes, quand elle est chiffrable. */
  quantityG: z.number().min(0).max(10000).nullable().default(null),
  alternative: z.string().trim().max(160).default(''),
  kcal: z.number().int().min(0).max(10000).nullable().default(null),
  proteinG: z.number().min(0).max(1000).nullable().default(null),
  carbsG: z.number().min(0).max(1000).nullable().default(null),
  fatG: z.number().min(0).max(1000).nullable().default(null),
});
export type MealItem = z.infer<typeof mealItemSchema>;

export const mealSchema = z.object({
  id: z.uuid().optional(),
  name: z.string().trim().min(1).max(80),
  /** Heure indicative, en texte : « 07h30 », « au réveil ». */
  time: z.string().trim().max(40).default(''),
  /**
   * Calories annoncées pour le repas, à la main comme dans le prototype.
   * `null` : on additionne les lignes.
   */
  kcalOverride: z.number().int().min(0).max(10000).nullable().default(null),
  items: z.array(mealItemSchema).max(40).default([]),
});
export type Meal = z.infer<typeof mealSchema>;

/* ------------------------------------------------------------------ */
/* La liste de courses                                                 */
/* ------------------------------------------------------------------ */

export const shoppingItemSchema = z.object({
  id: z.uuid().optional(),
  label: z.string().trim().max(120).default(''),
  quantity: z.string().trim().max(80).default(''),
  /** Coché par le client en faisant ses courses, même sur un plan reçu. */
  checked: z.boolean().default(false),
  /** Prix retenu, en centimes. `null` tant qu'aucun prix n'est connu. */
  priceCents: z.number().int().min(0).max(1_000_000).nullable().default(null),
  store: z.string().trim().max(60).default(''),
});
export type ShoppingItem = z.infer<typeof shoppingItemSchema>;

export const shoppingCategorySchema = z.object({
  id: z.uuid().optional(),
  name: z.string().trim().min(1).max(80),
  items: z.array(shoppingItemSchema).max(60).default([]),
});
export type ShoppingCategory = z.infer<typeof shoppingCategorySchema>;

/** Les rayons proposés par défaut, repris du prototype. */
export const DEFAULT_SHOPPING_CATEGORIES = [
  'Protéines',
  'Féculents & céréales',
  'Fruits & légumes',
  'Produits laitiers',
  'Matières grasses',
  'Épicerie & divers',
] as const;

/** Les enseignes proposées à la saisie d'un prix. La liste reste ouverte. */
export const FRENCH_STORES = [
  'Auchan',
  'Carrefour',
  'Casino',
  'Intermarché',
  'Leclerc',
  'Lidl',
  'Monoprix',
  'Aldi',
  'Super U',
  'Marché',
] as const;

/* ------------------------------------------------------------------ */
/* Les réglages                                                        */
/* ------------------------------------------------------------------ */

/**
 * Les réglages de calcul d'un programme.
 *
 * Le sexe, l'âge, le poids et la taille sont **recopiés** dans le programme,
 * pas lus dans le profil : il doit rester fidèle aux chiffres sur lesquels il
 * a été construit. Sinon une pesée du lendemain changerait rétroactivement
 * les cibles d'un plan déjà imprimé.
 */
export const nutritionSettingsSchema = z.object({
  sex: sexSchema,
  age: z.number().int().min(13).max(110),
  weightKg: z.number().min(25).max(350),
  heightCm: z.number().int().min(100).max(250),
  activityLevel: activityLevelSchema,

  deficitKcal: z.number().int().min(-2000).max(2000).default(400),
  proteinGPerKg: z.number().min(0.5).max(4).default(2),
  fatGPerKg: z.number().min(0.3).max(3).default(0.9),
  fiberG: z.number().int().min(0).max(100).default(30),
  waterLiters: z.number().min(0).max(10).nullable().default(null),

  goalTitle: z.string().trim().max(120).default(''),
  goalText: z.string().trim().max(2000).default(''),
  preferred: z.array(z.string().trim().max(120)).max(20).default([]),
  limited: z.array(z.string().trim().max(120)).max(20).default([]),
  coachNote: z.string().trim().max(2000).default(''),

  shoppingDays: z.number().int().min(1).max(31).default(7),
  budgetCents: z.number().int().min(0).max(10_000_000).nullable().default(null),
});
export type NutritionSettings = z.infer<typeof nutritionSettingsSchema>;

/* ------------------------------------------------------------------ */
/* Le programme entier                                                 */
/* ------------------------------------------------------------------ */

export const nutritionProgramInputSchema = z.object({
  title: z.string().trim().min(1).max(120),
  isTemplate: z.boolean().default(false),
  startDate: dateOnlySchema.nullable().default(null),
  endDate: dateOnlySchema.nullable().default(null),
  settings: nutritionSettingsSchema,
  meals: z.array(mealSchema).max(12).default([]),
  shopping: z.array(shoppingCategorySchema).max(20).default([]),
  /** Recettes jointes, dans l'ordre d'affichage. */
  recipeIds: z.array(z.uuid()).max(40).default([]),
});
export type NutritionProgramInput = z.infer<typeof nutritionProgramInputSchema>;

/** Totaux d'un repas ou de la journée, et leur écart à la cible. */
export const macroTotalsSchema = z.object({
  kcal: z.number(),
  proteinG: z.number(),
  carbsG: z.number(),
  fatG: z.number(),
});

export const nutritionProgramSchema = z.object({
  id: z.uuid(),
  ownerId: z.uuid(),
  title: z.string(),
  isTemplate: z.boolean(),
  startDate: z.string().nullable(),
  endDate: z.string().nullable(),
  assignedToUserId: z.uuid().nullable(),
  settings: nutritionSettingsSchema,
  /** Les cibles, calculées côté serveur à partir des réglages. */
  targets: nutritionTargetsSchema,
  meals: z.array(mealSchema.extend({ id: z.uuid() })),
  shopping: z.array(shoppingCategorySchema.extend({ id: z.uuid() })),
  recipeIds: z.array(z.uuid()),
  /** Ce que la journée type totalise réellement. */
  dayTotals: macroTotalsSchema,
  updatedAt: z.string(),
});
export type NutritionProgram = z.infer<typeof nutritionProgramSchema>;

export const nutritionProgramSummarySchema = z.object({
  id: z.uuid(),
  title: z.string(),
  isTemplate: z.boolean(),
  assignedToUserId: z.uuid().nullable(),
  targetKcal: z.number(),
  mealCount: z.number().int(),
  updatedAt: z.string(),
});
export type NutritionProgramSummary = z.infer<typeof nutritionProgramSummarySchema>;

/* ------------------------------------------------------------------ */
/* Les calculs                                                         */
/* ------------------------------------------------------------------ */

/** Les cibles d'un programme, depuis ses réglages. */
export function targetsFromSettings(settings: NutritionSettings) {
  return computeNutritionTargets({
    sex: settings.sex,
    age: settings.age,
    weightKg: settings.weightKg,
    heightCm: settings.heightCm,
    activityLevel: settings.activityLevel,
    deficitKcal: settings.deficitKcal,
    proteinGPerKg: settings.proteinGPerKg,
    fatGPerKg: settings.fatGPerKg,
    waterLiters: settings.waterLiters,
  });
}

/**
 * Ce qu'un repas totalise.
 *
 * Les calories saisies à la main sur le repas **remplacent** la somme des
 * lignes : c'est le chiffre que le coach assume, et c'est celui du prototype.
 * Les macros, elles, viennent toujours des lignes — on n'invente pas une
 * répartition à partir d'un total.
 *
 * Une ligne sans calories mais avec ses macros voit ses calories
 * reconstituées : 4 kcal par gramme de protéines et de glucides, 9 pour les
 * lipides.
 */
export function mealTotals(meal: Pick<Meal, 'items' | 'kcalOverride'>): MacroTotals {
  const fromItems = meal.items.reduce<MacroTotals>(
    (total, item) => {
      const proteinG = item.proteinG ?? 0;
      const carbsG = item.carbsG ?? 0;
      const fatG = item.fatG ?? 0;

      return {
        kcal: total.kcal + (item.kcal ?? kcalFromMacros({ proteinG, carbsG, fatG })),
        proteinG: total.proteinG + proteinG,
        carbsG: total.carbsG + carbsG,
        fatG: total.fatG + fatG,
      };
    },
    { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 },
  );

  return {
    kcal: Math.round(meal.kcalOverride ?? fromItems.kcal),
    proteinG: round1(fromItems.proteinG),
    carbsG: round1(fromItems.carbsG),
    fatG: round1(fromItems.fatG),
  };
}

/** Ce que la journée type totalise. */
export function dayTotals(meals: Pick<Meal, 'items' | 'kcalOverride'>[]): MacroTotals {
  return meals.reduce<MacroTotals>(
    (total, meal) => {
      const totals = mealTotals(meal);

      return {
        kcal: total.kcal + totals.kcal,
        proteinG: round1(total.proteinG + totals.proteinG),
        carbsG: round1(total.carbsG + totals.carbsG),
        fatG: round1(total.fatG + totals.fatG),
      };
    },
    { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 },
  );
}

/** Coût de la liste de courses, en centimes. Les articles sans prix valent 0. */
export function shoppingTotalCents(categories: Pick<ShoppingCategory, 'items'>[]): number {
  return categories.reduce(
    (total, category) =>
      total + category.items.reduce((sum, item) => sum + (item.priceCents ?? 0), 0),
    0,
  );
}

/** Combien d'articles ont un prix connu, sur combien d'articles nommés. */
export function shoppingPriceCoverage(categories: Pick<ShoppingCategory, 'items'>[]): {
  priced: number;
  named: number;
} {
  const items = categories.flatMap((category) => category.items);
  const named = items.filter((item) => item.label.trim().length > 0);

  return { priced: named.filter((item) => item.priceCents !== null).length, named: named.length };
}

/**
 * Clé de mémorisation d'un prix : le libellé sans accents, en minuscules,
 * espaces resserrés. « Blanc de Poulet » et « blanc de poulet » sont le même
 * article, et ne doivent pas demander deux fois le prix.
 */
export function priceKey(label: string): string {
  return label.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

/**
 * Arrondi à la dizaine, comme le prototype pour l'affichage de la cible :
 * annoncer « 1 847 kcal » donnerait une fausse impression de précision sur
 * une estimation à ±10 %.
 */
export function roundToTen(value: number): number {
  return Math.round(value / 10) * 10;
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}
