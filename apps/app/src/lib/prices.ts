import { priceListSchema, type PriceInput, type PriceList } from '@betterfit/shared';
import { useSession } from '../stores/session';

/** Les prix connus pour ces articles : les siens, et les prix publics. */
export function fetchPrices(labels: string[]): Promise<PriceList> {
  const named = labels.filter((label) => label.trim().length > 0);
  if (named.length === 0) return Promise.resolve({ items: [] });

  const query = encodeURIComponent(named.join(','));

  return useSession
    .getState()
    .authedRequest(`/prices?labels=${query}`, {}, (data) => priceListSchema.parse(data));
}

/** Mémorise un prix saisi à la main, pour ne plus le redemander. */
export function rememberPrice(input: PriceInput): Promise<void> {
  return useSession.getState().authedRequest('/prices', { method: 'POST', body: input });
}
