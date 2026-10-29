import {
  FRENCH_STORES,
  bestPrice,
  formatPrice,
  priceKey,
  shoppingPriceCoverage,
  shoppingTotalCents,
  type NutritionProgram,
  type ShoppingItem,
} from '@betterfit/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';
import { errorMessage } from '@/lib/errors';
import { updateShoppingItem } from '@/lib/nutrition';
import { fetchPrices, rememberPrice } from '@/lib/prices';
import {
  Banner,
  Body,
  Button,
  Caption,
  Card,
  Checkbox,
  Chip,
  TextField,
  colors,
  spacing,
} from '@/ui';

/**
 * La liste de courses, par rayons.
 *
 * Le client coche en faisant ses courses, même sur un plan que son coach lui
 * a préparé. Les prix déjà saisis sont proposés automatiquement : on ne
 * redemande jamais deux fois le prix du même article.
 */
export function ShoppingList({ program }: { program: NutritionProgram }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);

  const labels = program.shopping.flatMap((category) =>
    category.items.map((item) => item.label).filter((label) => label.trim().length > 0),
  );

  const prices = useQuery({
    queryKey: ['prices', labels.sort().join('|')],
    queryFn: () => fetchPrices(labels),
    enabled: labels.length > 0,
  });

  const update = useMutation({
    mutationFn: (input: { itemId: string; patch: Parameters<typeof updateShoppingItem>[2] }) =>
      updateShoppingItem(program.id, input.itemId, input.patch),
    onSuccess: (saved) => {
      queryClient.setQueryData(['nutrition-program', program.id], saved);
      setError(null);
    },
    onError: (caught) => setError(errorMessage(caught)),
  });

  const total = shoppingTotalCents(program.shopping);
  const coverage = shoppingPriceCoverage(program.shopping);
  const budget = program.settings.budgetCents;

  /** Le prix déjà connu pour cet article, s'il y en a un. */
  function knownPrice(item: ShoppingItem) {
    const key = priceKey(item.label);
    const matches = (prices.data?.items ?? []).filter((price) => price.label === key);

    return bestPrice(matches, item.store.length > 0 ? item.store : undefined);
  }

  return (
    <>
      {error ? <Banner message={error} /> : null}

      <Card overline={t('nutrition.shoppingOverline')} title={t('nutrition.shoppingTitle')}>
        <View style={styles.summary}>
          <View style={styles.summaryBlock}>
            <Body style={styles.total}>{formatPrice(total)}</Body>
            <Caption>
              {t('nutrition.pricedCount', { priced: coverage.priced, named: coverage.named })}
            </Caption>
          </View>

          {budget !== null ? (
            <Chip
              tone={total > budget ? 'outline' : 'dark'}
              label={t(total > budget ? 'nutrition.overBudget' : 'nutrition.underBudget', {
                budget: formatPrice(budget),
              })}
            />
          ) : null}
        </View>

        <Caption>{t('nutrition.shoppingDays', { count: program.settings.shoppingDays })}</Caption>
      </Card>

      {program.shopping.length === 0 ? (
        <Card tone="soft">
          <Body>{t('nutrition.noShopping')}</Body>
        </Card>
      ) : null}

      {program.shopping.map((category) => (
        <Card key={category.id} title={category.name}>
          {category.items.filter((item) => item.label.trim().length > 0).length === 0 ? (
            <Caption>{t('nutrition.noItems')}</Caption>
          ) : null}

          {category.items
            .filter((item) => item.label.trim().length > 0)
            .map((item) => {
              const suggestion = knownPrice(item);
              const isEditing = editing === item.id;

              return (
                <View key={item.id} style={styles.row}>
                  <Checkbox
                    checked={item.checked}
                    onChange={(checked) =>
                      update.mutate({ itemId: item.id!, patch: { checked } })
                    }
                    label={
                      <View style={styles.labelBlock}>
                        <Body style={item.checked ? styles.done : undefined}>{item.label}</Body>
                        {item.quantity.length > 0 ? <Caption>{item.quantity}</Caption> : null}
                      </View>
                    }
                  />

                  <View style={styles.priceRow}>
                    {item.priceCents !== null ? (
                      <Caption>
                        {formatPrice(item.priceCents)}
                        {item.store.length > 0 ? ` · ${item.store}` : ''}
                      </Caption>
                    ) : suggestion ? (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={t('nutrition.usePrice', {
                          price: formatPrice(suggestion.priceCents),
                          store: suggestion.store,
                        })}
                        onPress={() =>
                          update.mutate({
                            itemId: item.id!,
                            patch: {
                              priceCents: suggestion.priceCents,
                              store: suggestion.store,
                            },
                          })
                        }
                      >
                        <Caption style={styles.suggestion}>
                          {t('nutrition.suggestedPrice', {
                            price: formatPrice(suggestion.priceCents),
                            store: suggestion.store.length > 0 ? suggestion.store : '—',
                          })}
                        </Caption>
                      </Pressable>
                    ) : null}

                    <Button
                      variant="ghost"
                      label={t(item.priceCents === null ? 'nutrition.addPrice' : 'common.edit')}
                      onPress={() => setEditing(isEditing ? null : item.id!)}
                    />
                  </View>

                  {isEditing ? (
                    <PriceForm
                      item={item}
                      onCancel={() => setEditing(null)}
                      onSave={async (priceCents, store) => {
                        await update.mutateAsync({
                          itemId: item.id!,
                          patch: { priceCents, store },
                        });
                        // Mémorisé pour les prochaines listes.
                        await rememberPrice({
                          label: item.label,
                          store,
                          priceCents,
                          unit: item.quantity,
                        });
                        void queryClient.invalidateQueries({ queryKey: ['prices'] });
                        setEditing(null);
                      }}
                    />
                  ) : null}
                </View>
              );
            })}
        </Card>
      ))}

      <Caption>{t('nutrition.pricesAttribution')}</Caption>
    </>
  );
}

/** Saisie d'un prix et de son enseigne. */
function PriceForm({
  item,
  onSave,
  onCancel,
}: {
  item: ShoppingItem;
  onSave: (priceCents: number, store: string) => Promise<void>;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [price, setPrice] = useState(
    item.priceCents === null ? '' : (item.priceCents / 100).toFixed(2).replace('.', ','),
  );
  const [store, setStore] = useState(item.store);
  const [saving, setSaving] = useState(false);

  const cents = Math.round(Number(price.replace(',', '.')) * 100);
  const valid = Number.isFinite(cents) && cents >= 0 && price.trim().length > 0;

  return (
    <View style={styles.form}>
      <TextField
        label={t('nutrition.priceLabel')}
        value={price}
        onChangeText={setPrice}
        keyboardType="decimal-pad"
        suffix="€"
        placeholder="8,99"
      />

      <TextField
        label={t('nutrition.storeLabel')}
        value={store}
        onChangeText={setStore}
        placeholder={FRENCH_STORES[0]}
      />

      <View style={styles.stores}>
        {FRENCH_STORES.map((name) => (
          <Chip
            key={name}
            tone={store === name ? 'dark' : 'outline'}
            label={name}
            selected={store === name}
            onPress={() => setStore(name)}
          />
        ))}
      </View>

      <View style={styles.actions}>
        <Button
          label={t('common.save')}
          loading={saving}
          disabled={!valid}
          onPress={async () => {
            setSaving(true);
            try {
              await onSave(cents, store.trim());
            } finally {
              setSaving(false);
            }
          }}
        />
        <Button variant="ghost" label={t('common.cancel')} onPress={onCancel} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  summary: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, flexWrap: 'wrap' },
  summaryBlock: { flex: 1, gap: spacing.xs, minWidth: 120 },
  total: { fontSize: 22 },
  row: { gap: spacing.xs, paddingVertical: spacing.xs },
  labelBlock: { gap: 2 },
  done: { textDecorationLine: 'line-through', color: colors.muted },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  suggestion: { color: colors.accent },
  form: { gap: spacing.md, paddingTop: spacing.sm },
  stores: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  actions: { flexDirection: 'row', gap: spacing.md, flexWrap: 'wrap' },
});
