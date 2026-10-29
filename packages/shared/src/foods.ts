import { z } from 'zod';
import { macrosForQuantity, type MacroTotals } from './nutrition.js';

/**
 * Les aliments.
 *
 * Toutes les valeurs sont **pour 100 g**, quelle que soit la source : c'est
 * la seule façon de mélanger Ciqual, Open Food Facts et les aliments perso
 * dans un même calcul. La portion usuelle est une information à côté, jamais
 * la base du calcul.
 */

export const foodSourceSchema = z.enum(['ciqual', 'off', 'custom']);
export type FoodSource = z.infer<typeof foodSourceSchema>;

export const FOOD_SOURCE_LABELS_FR: Record<FoodSource, string> = {
  ciqual: 'Ciqual (ANSES)',
  off: 'Open Food Facts',
  custom: 'Mon aliment',
};

/** Attribution obligatoire, selon la licence de chaque source. */
export const FOOD_SOURCE_ATTRIBUTION_FR: Record<FoodSource, string> = {
  ciqual: 'Source : table Ciqual 2020, ANSES — Licence Ouverte.',
  off: 'Données Open Food Facts, licence ODbL.',
  custom: '',
};

/** Les valeurs nutritionnelles pour 100 g. `null` quand on ne les a pas. */
export const nutrientsSchema = z.object({
  kcal: z.number().min(0).max(1000).nullable().default(null),
  proteinG: z.number().min(0).max(100).nullable().default(null),
  carbsG: z.number().min(0).max(100).nullable().default(null),
  sugarsG: z.number().min(0).max(100).nullable().default(null),
  fatG: z.number().min(0).max(100).nullable().default(null),
  saturatedFatG: z.number().min(0).max(100).nullable().default(null),
  fiberG: z.number().min(0).max(100).nullable().default(null),
  saltG: z.number().min(0).max(100).nullable().default(null),
});
export type Nutrients = z.infer<typeof nutrientsSchema>;

export const foodSchema = nutrientsSchema.extend({
  id: z.uuid(),
  source: foodSourceSchema,
  /** `null` pour les aliments partagés. */
  ownerId: z.uuid().nullable(),
  externalId: z.string().nullable(),
  barcode: z.string().nullable(),
  name: z.string(),
  brand: z.string(),
  category: z.string(),
  /** Portion usuelle : « une tranche », « un bol ». */
  servingLabel: z.string(),
  servingG: z.number().nullable(),
});
export type Food = z.infer<typeof foodSchema>;

export const foodListSchema = z.object({
  items: z.array(foodSchema),
  total: z.number().int(),
  page: z.number().int(),
  pageSize: z.number().int(),
});
export type FoodList = z.infer<typeof foodListSchema>;

export const FOOD_PAGE_SIZE = 30;

export const foodSearchSchema = z.object({
  q: z.string().trim().max(120).optional(),
  /** Vrai pour ne voir que ses propres aliments. */
  mine: z
    .union([z.boolean(), z.enum(['true', 'false', '1', '0'])])
    .transform((value) => (typeof value === 'boolean' ? value : value === 'true' || value === '1'))
    .optional(),
  source: foodSourceSchema.optional(),
  page: z.coerce.number().int().min(1).max(200).default(1),
});
export type FoodSearch = z.infer<typeof foodSearchSchema>;

/** Ce qu'il faut pour créer un aliment perso. */
export const customFoodSchema = nutrientsSchema.extend({
  name: z.string().trim().min(2).max(120),
  brand: z.string().trim().max(80).default(''),
  category: z.string().trim().max(80).default(''),
  servingLabel: z.string().trim().max(60).default(''),
  servingG: z.number().min(1).max(5000).nullable().default(null),
  barcode: z
    .string()
    .trim()
    .regex(/^\d{8,14}$/, 'Un code-barres a entre 8 et 14 chiffres.')
    .nullable()
    .default(null),
});
export type CustomFoodInput = z.infer<typeof customFoodSchema>;

/**
 * Les macros d'une quantité d'un aliment.
 *
 * Un seul endroit pour cette règle : l'éditeur de programme, le journal et
 * les PDF l'utilisent tous. Les calories manquantes ne sont **pas**
 * reconstituées ici — c'est `kcalFromMacros` qui s'en charge, et seulement
 * quand on sait que les macros sont complètes.
 */
export function macrosForFood(food: Nutrients, grams: number): MacroTotals {
  return macrosForQuantity(
    {
      kcal: food.kcal ?? 0,
      proteinG: food.proteinG ?? 0,
      carbsG: food.carbsG ?? 0,
      fatG: food.fatG ?? 0,
    },
    grams,
  );
}

/**
 * Le texte sur lequel porte la recherche : nom, marque et catégorie, sans
 * accents, pour que « crème fraîche » se trouve en tapant « creme fraiche ».
 */
export function buildFoodSearchText(input: {
  name: string;
  brand?: string | null;
  category?: string | null;
}): string {
  return [input.name, input.brand ?? '', input.category ?? '']
    .join(' ')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Une quantité écrite à la main, convertie en grammes.
 *
 * Accepte « 160 g », « 160g », « 1,5 kg », « 160 » (grammes sous-entendus).
 * Rend `null` pour « à volonté » ou « 2 œufs » : on ne devine pas le poids
 * d'un œuf, et mieux vaut ne rien compter que compter faux.
 */
export function gramsFromText(text: string): number | null {
  const cleaned = text.toLowerCase().replace(',', '.').trim();
  const match = /^(\d+(?:\.\d+)?)\s*(kg|g|ml|cl|l)?$/.exec(cleaned);

  if (!match) return null;

  const value = Number(match[1]);
  if (!Number.isFinite(value) || value <= 0) return null;

  switch (match[2]) {
    case 'kg':
      return value * 1000;
    case 'l':
      return value * 1000;
    case 'cl':
      return value * 10;
    // Un millilitre d'eau pèse un gramme : l'approximation est juste pour
    // les liquides courants, et c'est ce que font les applications de suivi.
    case 'ml':
      return value;
    default:
      return value;
  }
}
