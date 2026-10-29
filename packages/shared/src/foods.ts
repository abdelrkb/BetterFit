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

/* ------------------------------------------------------------------ */
/* Open Food Facts                                                      */
/* ------------------------------------------------------------------ */

/**
 * Ce qu'on retient d'un produit lu sur Open Food Facts.
 *
 * L'appel se fait **depuis l'appareil** de la personne, jamais depuis notre
 * serveur : Open Food Facts limite à une quinzaine de lectures par minute et
 * par IP, et toutes nos requêtes partiraient de la même. Le produit est
 * ensuite envoyé ici pour être mis en cache, et la prochaine personne qui
 * scanne le même code le trouve chez nous.
 */
export const openFoodFactsProductSchema = nutrientsSchema.extend({
  barcode: z.string().trim().regex(/^\d{8,14}$/),
  name: z.string().trim().min(1).max(200),
  brand: z.string().trim().max(120).default(''),
  category: z.string().trim().max(200).default(''),
  servingLabel: z.string().trim().max(60).default(''),
  servingG: z.number().min(1).max(5000).nullable().default(null),
});
export type OpenFoodFactsProduct = z.infer<typeof openFoodFactsProductSchema>;

/** L'adresse à interroger pour un code-barres. */
export function openFoodFactsUrl(barcode: string): string {
  // On ne demande que les champs utiles : la fiche complète pèse plusieurs
  // centaines de kilo-octets, souvent sur un réseau de téléphone.
  const fields = [
    'code',
    'product_name',
    'product_name_fr',
    'brands',
    'categories',
    'serving_size',
    'serving_quantity',
    'nutriments',
  ].join(',');

  return `https://world.openfoodfacts.org/api/v2/product/${barcode}.json?fields=${fields}`;
}

/**
 * L'en-tête que leur documentation demande : nom de l'app, version, contact.
 * Sans lui, Open Food Facts bloque les appels anonymes.
 */
export function openFoodFactsUserAgent(version: string, contactEmail: string): string {
  return `BetterFit/${version} (${contactEmail})`;
}

/**
 * Convertit une fiche Open Food Facts en aliment.
 *
 * Leurs valeurs sont pour 100 g, comme les nôtres. Le sel est donné en sodium
 * dans certaines fiches : on préfère `salt_100g` quand il existe, sinon on le
 * reconstitue (1 g de sodium ≈ 2,5 g de sel).
 *
 * Rend `null` si la fiche n'a même pas de nom : mieux vaut proposer une
 * saisie rapide que d'enregistrer un produit vide.
 */
export function fromOpenFoodFacts(payload: unknown): OpenFoodFactsProduct | null {
  const product = (payload as { product?: Record<string, unknown> } | null)?.product;
  if (!product) return null;

  const name = str(product.product_name_fr) || str(product.product_name);
  const barcode = str(product.code);

  if (name.length === 0 || !/^\d{8,14}$/.test(barcode)) return null;

  const nutriments = (product.nutriments ?? {}) as Record<string, unknown>;
  const sodium = num(nutriments['sodium_100g']);

  return openFoodFactsProductSchema.parse({
    barcode,
    name: name.slice(0, 200),
    brand: str(product.brands).split(',')[0]?.trim().slice(0, 120) ?? '',
    category: str(product.categories).split(',').slice(-1)[0]?.trim().slice(0, 200) ?? '',
    servingLabel: str(product.serving_size).slice(0, 60),
    servingG: num(product.serving_quantity),
    kcal: num(nutriments['energy-kcal_100g']),
    proteinG: num(nutriments['proteins_100g']),
    carbsG: num(nutriments['carbohydrates_100g']),
    sugarsG: num(nutriments['sugars_100g']),
    fatG: num(nutriments['fat_100g']),
    saturatedFatG: num(nutriments['saturated-fat_100g']),
    fiberG: num(nutriments['fiber_100g']),
    saltG: num(nutriments['salt_100g']) ?? (sodium === null ? null : sodium * 2.5),
  });
}

function str(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * Un nombre utilisable, ou `null`.
 *
 * Open Food Facts écrit parfois des textes, et parfois des valeurs
 * négatives qui n'ont aucun sens. On ne **n'arrondit pas** : le sel vaut
 * 0,107 g pour 100 g sur certaines fiches, et l'arrondir à 0,11 perdrait de
 * la précision sans rien apporter. C'est à l'affichage d'arrondir.
 */
function num(value: unknown): number | null {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}
