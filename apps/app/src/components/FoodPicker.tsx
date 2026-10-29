import {
  FOOD_SOURCE_ATTRIBUTION_FR,
  macrosForFood,
  type Food,
} from '@betterfit/shared';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { errorMessage } from '@/lib/errors';
import { searchFoods } from '@/lib/foods';
import { decimal } from '@/lib/format';
import {
  Banner,
  Body,
  Button,
  Caption,
  Card,
  Chip,
  Heading,
  Screen,
  TextField,
  Title,
  colors,
  radii,
  spacing,
} from '@/ui';

/**
 * Choix d'un aliment, puis de sa quantité.
 *
 * Écran plein, comme le choix d'un exercice : une fenêtre avec une recherche
 * et une liste est inutilisable sur téléphone.
 *
 * La recherche porte **toujours sur notre base** (Ciqual, produits déjà
 * scannés, aliments perso) : Open Food Facts limite à dix recherches par
 * minute et par IP, ce qui interdit de chercher au fil de la frappe.
 */
export function FoodPicker({
  onPick,
  onCancel,
  onCreate,
}: {
  onPick: (food: Food, grams: number) => void;
  onCancel: () => void;
  /** Proposé quand rien ne correspond : créer son propre aliment. */
  onCreate?: () => void;
}) {
  const { t } = useTranslation();
  const [rawQuery, setRawQuery] = useState('');
  const [query, setQuery] = useState('');
  const [chosen, setChosen] = useState<Food | null>(null);

  // On attend que la frappe se calme : sans ça, chaque lettre déclenche une
  // requête, et les réponses arrivent dans le désordre.
  useEffect(() => {
    const timer = setTimeout(() => setQuery(rawQuery), 300);
    return () => clearTimeout(timer);
  }, [rawQuery]);

  const results = useQuery({
    queryKey: ['foods', 'picker', query],
    queryFn: () => searchFoods({ q: query || undefined }),
    placeholderData: keepPreviousData,
  });

  if (chosen) {
    return (
      <QuantityStep
        food={chosen}
        onBack={() => setChosen(null)}
        onConfirm={(grams) => onPick(chosen, grams)}
      />
    );
  }

  return (
    <Screen>
      <Title>{t('foods.pickTitle')}</Title>

      <TextField
        label={t('foods.searchLabel')}
        value={rawQuery}
        onChangeText={setRawQuery}
        placeholder={t('foods.searchPlaceholder')}
        autoFocus
      />

      {results.isError ? <Banner message={errorMessage(results.error)} /> : null}
      {results.isPending ? <ActivityIndicator color={colors.accent} /> : null}

      {results.data?.items.length === 0 ? (
        <Card tone="soft">
          <Body>{t('foods.noResult')}</Body>
          {onCreate ? (
            <Button block variant="secondary" label={t('foods.createOne')} onPress={onCreate} />
          ) : null}
        </Card>
      ) : null}

      {results.data?.items.map((food) => (
        <Pressable
          key={food.id}
          accessibilityRole="button"
          accessibilityLabel={food.name}
          style={styles.row}
          onPress={() => setChosen(food)}
        >
          <View style={styles.rowText}>
            <Body>{food.name}</Body>
            <Caption>
              {[food.brand, food.category].filter((part) => part.length > 0).join(' · ')}
            </Caption>
          </View>
          <Caption>
            {food.kcal === null ? t('foods.unknownKcal') : t('foods.per100', { kcal: food.kcal })}
          </Caption>
        </Pressable>
      ))}

      {results.data && results.data.total > results.data.items.length ? (
        <Caption>
          {t('foods.moreResults', { shown: results.data.items.length, total: results.data.total })}
        </Caption>
      ) : null}

      <Button block variant="ghost" label={t('common.cancel')} onPress={onCancel} />
    </Screen>
  );
}

/** Deuxième temps : combien on en mange. */
function QuantityStep({
  food,
  onConfirm,
  onBack,
}: {
  food: Food;
  onConfirm: (grams: number) => void;
  onBack: () => void;
}) {
  const { t } = useTranslation();
  const [text, setText] = useState(food.servingG === null ? '100' : String(food.servingG));

  const grams = Number(text.replace(',', '.'));
  const valid = Number.isFinite(grams) && grams > 0 && grams <= 10000;
  const macros = valid ? macrosForFood(food, grams) : null;

  return (
    <Screen>
      <Title>{food.name}</Title>
      {food.brand.length > 0 ? <Caption>{food.brand}</Caption> : null}

      <Card title={t('foods.quantityTitle')}>
        <TextField
          label={t('foods.quantityLabel')}
          value={text}
          onChangeText={setText}
          keyboardType="decimal-pad"
          suffix="g"
          autoFocus
        />

        {food.servingG !== null ? (
          <View style={styles.servings}>
            <Chip
              label={t('foods.useServing', {
                label: food.servingLabel.length > 0 ? food.servingLabel : t('foods.oneServing'),
                grams: food.servingG,
              })}
              onPress={() => setText(String(food.servingG))}
            />
          </View>
        ) : null}

        {macros ? (
          <View style={styles.macros}>
            <Heading>{t('foods.kcalValue', { kcal: macros.kcal })}</Heading>
            <Caption>
              {t('foods.macrosValue', {
                protein: decimal(macros.proteinG),
                carbs: decimal(macros.carbsG),
                fat: decimal(macros.fatG),
              })}
            </Caption>
          </View>
        ) : null}

        {food.kcal === null ? <Caption>{t('foods.noValues')}</Caption> : null}
      </Card>

      {FOOD_SOURCE_ATTRIBUTION_FR[food.source].length > 0 ? (
        <Caption>{FOOD_SOURCE_ATTRIBUTION_FR[food.source]}</Caption>
      ) : null}

      <Button
        block
        label={t('foods.add')}
        disabled={!valid}
        onPress={() => onConfirm(grams)}
      />
      <Button block variant="ghost" label={t('common.back')} onPress={onBack} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    minHeight: 56,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radii.tile,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  rowText: { flex: 1, gap: 2 },
  servings: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  macros: { gap: spacing.xs },
});
