import { z } from 'zod';

/**
 * Les prix des articles de courses.
 *
 * Deux sources : **Open Prices** (le volet prix d'Open Food Facts, sous
 * licence ODbL) et la **saisie manuelle**, mémorisée pour ne pas redemander
 * le même prix à chaque liste. Un prix saisi à la main l'emporte toujours sur
 * un prix public : c'est celui que la personne a vu en rayon.
 */

export const priceSourceSchema = z.enum(['manual', 'open_prices']);
export type PriceSource = z.infer<typeof priceSourceSchema>;

export const priceSchema = z.object({
  id: z.uuid(),
  label: z.string(),
  store: z.string(),
  priceCents: z.number().int(),
  /** Ce à quoi le prix correspond : « le kilo », « la boîte de 400 g ». */
  unit: z.string(),
  source: priceSourceSchema,
  updatedAt: z.string(),
});
export type Price = z.infer<typeof priceSchema>;

export const priceInputSchema = z.object({
  label: z.string().trim().min(1).max(120),
  store: z.string().trim().max(60).default(''),
  priceCents: z.number().int().min(0).max(1_000_000),
  unit: z.string().trim().max(60).default(''),
});
export type PriceInput = z.infer<typeof priceInputSchema>;

export const priceListSchema = z.object({ items: z.array(priceSchema) });
export type PriceList = z.infer<typeof priceListSchema>;

/** Prix en euros, à la française : « 8,99 € ». */
export function formatPrice(cents: number): string {
  return `${(cents / 100).toFixed(2).replace('.', ',')} €`;
}

/**
 * Le prix à retenir pour un article.
 *
 * On préfère ce que la personne a saisi elle-même, puis le prix de l'enseigne
 * demandée, puis le plus récent. `null` si on ne sait rien.
 */
export function bestPrice(prices: Price[], store?: string): Price | null {
  if (prices.length === 0) return null;

  const ranked = [...prices].sort((a, b) => {
    const manual = Number(b.source === 'manual') - Number(a.source === 'manual');
    if (manual !== 0) return manual;

    if (store) {
      const sameStore = Number(b.store === store) - Number(a.store === store);
      if (sameStore !== 0) return sameStore;
    }

    return b.updatedAt.localeCompare(a.updatedAt);
  });

  return ranked[0] ?? null;
}
