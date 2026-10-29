import {
  customFoodSchema,
  foodListSchema,
  foodSchema,
  type CustomFoodInput,
  type Food,
  type FoodList,
} from '@betterfit/shared';
import { useSession } from '../stores/session';

export function searchFoods(
  options: { q?: string; mine?: boolean; page?: number } = {},
): Promise<FoodList> {
  const query = new URLSearchParams();
  if (options.q) query.set('q', options.q);
  if (options.mine !== undefined) query.set('mine', String(options.mine));
  if (options.page) query.set('page', String(options.page));

  const suffix = query.toString();

  return useSession
    .getState()
    .authedRequest(`/foods${suffix ? `?${suffix}` : ''}`, {}, (data) => foodListSchema.parse(data));
}

export function fetchFood(id: string): Promise<Food> {
  return useSession.getState().authedRequest(`/foods/${id}`, {}, (data) => foodSchema.parse(data));
}

/** Un produit déjà connu de notre base, par son code-barres. */
export function fetchFoodByBarcode(barcode: string): Promise<Food> {
  return useSession
    .getState()
    .authedRequest(`/foods/barcode/${barcode}`, {}, (data) => foodSchema.parse(data));
}

export function createFood(input: CustomFoodInput): Promise<Food> {
  return useSession
    .getState()
    .authedRequest('/foods', { method: 'POST', body: customFoodSchema.parse(input) }, (data) =>
      foodSchema.parse(data),
    );
}

export function saveFood(id: string, input: CustomFoodInput): Promise<Food> {
  return useSession
    .getState()
    .authedRequest(`/foods/${id}`, { method: 'PUT', body: customFoodSchema.parse(input) }, (data) =>
      foodSchema.parse(data),
    );
}

export function deleteFood(id: string): Promise<void> {
  return useSession.getState().authedRequest(`/foods/${id}`, { method: 'DELETE' });
}
