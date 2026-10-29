import {
  nutritionProgramSchema,
  nutritionProgramSummarySchema,
  type NutritionProgram,
  type NutritionProgramInput,
  type NutritionProgramSummary,
} from '@betterfit/shared';
import { z } from 'zod';
import { useSession } from '../stores/session';

const listSchema = z.object({ items: z.array(nutritionProgramSummarySchema) });

export function listNutritionPrograms(
  options: { templates?: boolean } = {},
): Promise<{ items: NutritionProgramSummary[] }> {
  const query = options.templates === undefined ? '' : `?templates=${options.templates}`;

  return useSession
    .getState()
    .authedRequest(`/nutrition-programs${query}`, {}, (data) => listSchema.parse(data));
}

export function fetchNutritionProgram(id: string): Promise<NutritionProgram> {
  return useSession
    .getState()
    .authedRequest(`/nutrition-programs/${id}`, {}, (data) => nutritionProgramSchema.parse(data));
}

export function createNutritionProgram(input: NutritionProgramInput): Promise<NutritionProgram> {
  return useSession
    .getState()
    .authedRequest('/nutrition-programs', { method: 'POST', body: input }, (data) =>
      nutritionProgramSchema.parse(data),
    );
}

export function saveNutritionProgram(
  id: string,
  input: NutritionProgramInput,
): Promise<NutritionProgram> {
  return useSession
    .getState()
    .authedRequest(`/nutrition-programs/${id}`, { method: 'PUT', body: input }, (data) =>
      nutritionProgramSchema.parse(data),
    );
}

export function deleteNutritionProgram(id: string): Promise<void> {
  return useSession.getState().authedRequest(`/nutrition-programs/${id}`, { method: 'DELETE' });
}

/** Cocher un article, ou lui donner un prix. Permis aussi au client assigné. */
export function updateShoppingItem(
  programId: string,
  itemId: string,
  patch: { checked?: boolean; priceCents?: number | null; store?: string },
): Promise<NutritionProgram> {
  return useSession
    .getState()
    .authedRequest(
      `/nutrition-programs/${programId}/shopping-items/${itemId}`,
      { method: 'PATCH', body: patch },
      (data) => nutritionProgramSchema.parse(data),
    );
}
