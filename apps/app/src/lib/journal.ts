import {
  fromOpenFoodFacts,
  journalDaySchema,
  foodLogSchema,
  foodSchema,
  openFoodFactsUrl,
  openFoodFactsUserAgent,
  type CopyDayInput,
  type Food,
  type FoodLog,
  type FoodLogInput,
  type JournalDay,
} from '@betterfit/shared';
import Constants from 'expo-constants';
import { z } from 'zod';
import { useSession } from '../stores/session';

const recentsSchema = z.object({ items: z.array(foodLogSchema) });
const favoritesSchema = z.object({ items: z.array(foodSchema) });

export function fetchJournalDay(date: string): Promise<JournalDay> {
  return useSession
    .getState()
    .authedRequest(`/journal?date=${date}`, {}, (data) => journalDaySchema.parse(data));
}

export function addJournalEntry(input: FoodLogInput): Promise<JournalDay> {
  return useSession
    .getState()
    .authedRequest('/journal', { method: 'POST', body: input }, (data) =>
      journalDaySchema.parse(data),
    );
}

export function deleteJournalEntry(id: string): Promise<JournalDay> {
  return useSession
    .getState()
    .authedRequest(`/journal/${id}`, { method: 'DELETE' }, (data) => journalDaySchema.parse(data));
}

export function copyJournalDay(input: CopyDayInput): Promise<JournalDay> {
  return useSession
    .getState()
    .authedRequest('/journal/copy', { method: 'POST', body: input }, (data) =>
      journalDaySchema.parse(data),
    );
}

export function fetchRecents(): Promise<{ items: FoodLog[] }> {
  return useSession
    .getState()
    .authedRequest('/journal/recents', {}, (data) => recentsSchema.parse(data));
}

export function fetchFavorites(): Promise<{ items: Food[] }> {
  return useSession.getState().authedRequest('/favorites', {}, (data) => favoritesSchema.parse(data));
}

export function addFavorite(foodId: string): Promise<void> {
  return useSession.getState().authedRequest(`/favorites/${foodId}`, { method: 'POST' });
}

export function removeFavorite(foodId: string): Promise<void> {
  return useSession.getState().authedRequest(`/favorites/${foodId}`, { method: 'DELETE' });
}

/** Adresse de contact exigée par Open Food Facts dans le User-Agent. */
const CONTACT_EMAIL = 'contact@betterfit.app';

/**
 * Lit un produit sur Open Food Facts, **depuis l'appareil**.
 *
 * Leur serveur limite à une quinzaine de lectures par minute et par IP :
 * passer par le nôtre ferait partir toutes les requêtes de la même adresse,
 * et tout le monde serait bloqué dès quelques utilisateurs. Depuis
 * l'appareil, chacun a son propre quota.
 *
 * Le produit trouvé est ensuite mis en cache chez nous, pour que la
 * prochaine personne qui scanne le même code n'ait pas à les réinterroger.
 */
export async function lookupBarcode(barcode: string): Promise<Food | null> {
  const session = useSession.getState();

  // D'abord chez nous : si le produit est déjà en cache, on ne dérange pas
  // Open Food Facts.
  try {
    return await session.authedRequest(`/foods/barcode/${barcode}`, {}, (data) =>
      foodSchema.parse(data),
    );
  } catch {
    // Inconnu chez nous : on va le chercher.
  }

  const version = Constants.expoConfig?.version ?? '0.1';

  const response = await fetch(openFoodFactsUrl(barcode), {
    headers: { 'user-agent': openFoodFactsUserAgent(version, CONTACT_EMAIL) },
  });

  if (!response.ok) return null;

  const product = fromOpenFoodFacts(await response.json());
  if (!product) return null;

  // Mis en cache chez nous, et c'est notre version qu'on renvoie : elle a un
  // identifiant, ce qui permet de la loguer et de la mettre en favori.
  return session.authedRequest('/foods/off', { method: 'POST', body: product }, (data) =>
    foodSchema.parse(data),
  );
}
