import { z } from 'zod';

/**
 * Les recettes.
 *
 * Une recette appartient à son auteur et se réutilise d'un programme à
 * l'autre. Les valeurs nutritionnelles sont **par portion** : c'est ce qu'on
 * mange, pas ce qu'on cuisine.
 */

export const recipeIngredientSchema = z.object({
  id: z.uuid().optional(),
  foodId: z.uuid().nullable().default(null),
  label: z.string().trim().max(160).default(''),
  quantity: z.string().trim().max(80).default(''),
  quantityG: z.number().min(0).max(10000).nullable().default(null),
});
export type RecipeIngredient = z.infer<typeof recipeIngredientSchema>;

export const recipeInputSchema = z.object({
  title: z.string().trim().min(1).max(120),
  /** Moment conseillé : « Déjeuner », « Collation »… texte libre. */
  category: z.string().trim().max(60).default(''),
  prepMinutes: z.number().int().min(0).max(600).nullable().default(null),
  cookMinutes: z.number().int().min(0).max(600).nullable().default(null),
  servings: z.number().int().min(1).max(50).default(1),
  /** Valeurs **par portion**. */
  kcal: z.number().int().min(0).max(5000).nullable().default(null),
  proteinG: z.number().min(0).max(500).nullable().default(null),
  carbsG: z.number().min(0).max(500).nullable().default(null),
  fatG: z.number().min(0).max(500).nullable().default(null),
  tip: z.string().trim().max(1000).default(''),
  ingredients: z.array(recipeIngredientSchema).max(60).default([]),
  steps: z.array(z.string().trim().max(1000)).max(40).default([]),
});
export type RecipeInput = z.infer<typeof recipeInputSchema>;

export const recipeSchema = recipeInputSchema.extend({
  id: z.uuid(),
  ownerId: z.uuid(),
  /** Adresse de la photo servie par l'API, ou `null`. */
  photoUrl: z.string().nullable(),
  updatedAt: z.string(),
});
export type Recipe = z.infer<typeof recipeSchema>;

export const recipeListSchema = z.object({ items: z.array(recipeSchema) });
export type RecipeList = z.infer<typeof recipeListSchema>;

/** Durée totale, préparation plus cuisson. `null` si aucune n'est renseignée. */
export function totalMinutes(recipe: Pick<Recipe, 'prepMinutes' | 'cookMinutes'>): number | null {
  if (recipe.prepMinutes === null && recipe.cookMinutes === null) return null;

  return (recipe.prepMinutes ?? 0) + (recipe.cookMinutes ?? 0);
}
