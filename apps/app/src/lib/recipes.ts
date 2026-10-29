import {
  recipeListSchema,
  recipeSchema,
  type Recipe,
  type RecipeInput,
  type RecipeList,
} from '@betterfit/shared';
import { useSession } from '../stores/session';

/** La photo part en `data:` dans le corps JSON : voir `recipes/photos.ts`. */
export type RecipeBody = RecipeInput & { photoDataUrl?: string | null };

export function listRecipes(): Promise<RecipeList> {
  return useSession.getState().authedRequest('/recipes', {}, (data) => recipeListSchema.parse(data));
}

export function fetchRecipe(id: string): Promise<Recipe> {
  return useSession
    .getState()
    .authedRequest(`/recipes/${id}`, {}, (data) => recipeSchema.parse(data));
}

export function createRecipe(input: RecipeBody): Promise<Recipe> {
  return useSession
    .getState()
    .authedRequest('/recipes', { method: 'POST', body: input }, (data) => recipeSchema.parse(data));
}

export function saveRecipe(id: string, input: RecipeBody): Promise<Recipe> {
  return useSession
    .getState()
    .authedRequest(`/recipes/${id}`, { method: 'PUT', body: input }, (data) =>
      recipeSchema.parse(data),
    );
}

export function deleteRecipe(id: string): Promise<void> {
  return useSession.getState().authedRequest(`/recipes/${id}`, { method: 'DELETE' });
}
