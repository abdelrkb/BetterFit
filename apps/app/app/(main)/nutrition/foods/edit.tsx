import { kcalFromMacros, type CustomFoodInput } from '@betterfit/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { errorMessage } from '@/lib/errors';
import { createFood, deleteFood, fetchFood, saveFood } from '@/lib/foods';
import { Banner, Body, Button, Caption, Card, Screen, TextField, Title, colors, spacing } from '@/ui';

function emptyFood(): CustomFoodInput {
  return {
    name: '',
    brand: '',
    category: '',
    kcal: null,
    proteinG: null,
    carbsG: null,
    sugarsG: null,
    fatG: null,
    saturatedFatG: null,
    fiberG: null,
    saltG: null,
    servingLabel: '',
    servingG: null,
    barcode: null,
  };
}

/** Créer ou modifier un aliment personnel. */
export default function FoodEditScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { id } = useLocalSearchParams<{ id?: string }>();

  const [edited, setEdited] = useState<CustomFoodInput | null>(null);
  const [error, setError] = useState<string | null>(null);

  const existing = useQuery({
    queryKey: ['food', id],
    queryFn: () => fetchFood(id!),
    enabled: Boolean(id),
  });

  const initial = useMemo(() => {
    if (!id) return emptyFood();
    if (!existing.data) return null;

    const { id: _id, ownerId: _o, source: _s, externalId: _e, ...rest } = existing.data;
    return rest;
  }, [existing.data, id]);

  const draft = edited ?? initial;
  const setDraft = setEdited;

  const save = useMutation({
    mutationFn: () => {
      if (!draft) throw new Error('brouillon manquant');
      return id ? saveFood(id, draft) : createFood(draft);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['foods'] });
      router.back();
    },
    onError: (caught) => setError(errorMessage(caught)),
  });

  const remove = useMutation({
    mutationFn: () => deleteFood(id!),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['foods'] });
      router.back();
    },
    onError: (caught) => setError(errorMessage(caught)),
  });

  if (!draft) {
    return (
      <Screen>
        <ActivityIndicator color={colors.accent} />
      </Screen>
    );
  }

  /**
   * Les calories reconstituées depuis les macros, quand elles manquent.
   * Proposé, jamais imposé : un plat du restaurant a souvent des calories
   * connues et des macros inconnues, et l'inverse arrive aussi.
   */
  const suggestedKcal =
    draft.kcal === null && (draft.proteinG !== null || draft.carbsG !== null || draft.fatG !== null)
      ? kcalFromMacros({
          proteinG: draft.proteinG ?? 0,
          carbsG: draft.carbsG ?? 0,
          fatG: draft.fatG ?? 0,
        })
      : null;

  return (
    <Screen>
      <Title>{id ? t('foods.editTitle') : t('foods.createTitle')}</Title>

      {error ? <Banner message={error} /> : null}

      <Card title={t('foods.identityTitle')}>
        <TextField
          label={t('foods.nameLabel')}
          value={draft.name}
          onChangeText={(name) => setDraft({ ...draft, name })}
          placeholder={t('foods.namePlaceholder')}
        />
        <TextField
          label={t('foods.brandLabel')}
          value={draft.brand}
          onChangeText={(brand) => setDraft({ ...draft, brand })}
        />
        <TextField
          label={t('foods.categoryLabel')}
          value={draft.category}
          onChangeText={(category) => setDraft({ ...draft, category })}
        />
        <TextField
          label={t('foods.barcodeLabel')}
          value={draft.barcode ?? ''}
          onChangeText={(value) =>
            setDraft({ ...draft, barcode: value.trim().length === 0 ? null : value.trim() })
          }
          keyboardType="number-pad"
          hint={t('foods.barcodeHint')}
        />
      </Card>

      <Card title={t('foods.per100Title')}>
        <Caption>{t('foods.per100Hint')}</Caption>

        <View style={styles.row}>
          <NumberField
            style={styles.cell}
            label="kcal"
            value={draft.kcal}
            onChange={(kcal) => setDraft({ ...draft, kcal })}
          />
          <NumberField
            style={styles.cell}
            label={t('foods.proteinLabel')}
            value={draft.proteinG}
            onChange={(proteinG) => setDraft({ ...draft, proteinG })}
          />
        </View>
        <View style={styles.row}>
          <NumberField
            style={styles.cell}
            label={t('foods.carbsLabel')}
            value={draft.carbsG}
            onChange={(carbsG) => setDraft({ ...draft, carbsG })}
          />
          <NumberField
            style={styles.cell}
            label={t('foods.fatLabel')}
            value={draft.fatG}
            onChange={(fatG) => setDraft({ ...draft, fatG })}
          />
        </View>
        <View style={styles.row}>
          <NumberField
            style={styles.cell}
            label={t('foods.fiberLabel')}
            value={draft.fiberG}
            onChange={(fiberG) => setDraft({ ...draft, fiberG })}
          />
          <NumberField
            style={styles.cell}
            label={t('foods.saltLabel')}
            value={draft.saltG}
            onChange={(saltG) => setDraft({ ...draft, saltG })}
          />
        </View>

        {suggestedKcal !== null ? (
          <View style={styles.suggestion}>
            <Body>{t('foods.suggestedKcal', { kcal: suggestedKcal })}</Body>
            <Button
              variant="secondary"
              label={t('foods.useSuggested')}
              onPress={() => setDraft({ ...draft, kcal: suggestedKcal })}
            />
          </View>
        ) : null}
      </Card>

      <Card title={t('foods.servingTitle')}>
        <Caption>{t('foods.servingHint')}</Caption>
        <TextField
          label={t('foods.servingLabelLabel')}
          value={draft.servingLabel}
          onChangeText={(servingLabel) => setDraft({ ...draft, servingLabel })}
          placeholder={t('foods.servingPlaceholder')}
        />
        <NumberField
          label={t('foods.servingGramsLabel')}
          value={draft.servingG}
          onChange={(servingG) => setDraft({ ...draft, servingG })}
          suffix="g"
        />
      </Card>

      <Button
        block
        label={t('common.save')}
        loading={save.isPending}
        disabled={draft.name.trim().length < 2}
        onPress={() => {
          setError(null);
          save.mutate();
        }}
      />

      {id ? (
        <Button
          block
          variant="ghost"
          label={t('foods.delete')}
          loading={remove.isPending}
          onPress={() => remove.mutate()}
        />
      ) : null}

      <Button block variant="ghost" label={t('common.cancel')} onPress={() => router.back()} />
    </Screen>
  );
}

/** Champ numérique tolérant : vide vaut « je ne sais pas », pas zéro. */
function NumberField({
  label,
  value,
  onChange,
  suffix,
  style,
}: {
  label: string;
  value: number | null;
  onChange: (value: number | null) => void;
  suffix?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const [text, setText] = useState(value === null ? '' : String(value).replace('.', ','));

  return (
    <TextField
      style={style}
      label={label}
      value={text}
      suffix={suffix}
      keyboardType="decimal-pad"
      onChangeText={(next) => {
        setText(next);

        const trimmed = next.trim();
        if (trimmed.length === 0) {
          onChange(null);
          return;
        }

        const parsed = Number(trimmed.replace(',', '.'));
        if (Number.isFinite(parsed)) onChange(parsed);
      }}
    />
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.md, flexWrap: 'wrap' },
  cell: { flex: 1, minWidth: 110 },
  suggestion: { gap: spacing.sm },
});
