import type { RecipeInput } from '@betterfit/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { errorMessage } from '@/lib/errors';
import { createRecipe, deleteRecipe, fetchRecipe, saveRecipe } from '@/lib/recipes';
import {
  Banner,
  Button,
  Caption,
  Card,
  Screen,
  TextField,
  Title,
  colors,
  spacing,
} from '@/ui';

function emptyRecipe(): RecipeInput {
  return {
    title: '',
    category: '',
    prepMinutes: null,
    cookMinutes: null,
    servings: 2,
    kcal: null,
    proteinG: null,
    carbsG: null,
    fatG: null,
    tip: '',
    ingredients: [{ foodId: null, label: '', quantity: '', quantityG: null }],
    steps: [''],
  };
}

/** Créer ou modifier une recette. */
export default function RecipeEditScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { id } = useLocalSearchParams<{ id?: string }>();

  const [edited, setEdited] = useState<RecipeInput | null>(null);
  const [error, setError] = useState<string | null>(null);

  const existing = useQuery({
    queryKey: ['recipe', id],
    queryFn: () => fetchRecipe(id!),
    enabled: Boolean(id),
  });

  /** Dérivé pendant le rendu, pas posé par un effet : voir `nutrition/edit`. */
  const initial = useMemo(() => {
    if (!id) return emptyRecipe();
    if (!existing.data) return null;

    const { id: _id, ownerId: _o, photoUrl: _p, updatedAt: _u, ...rest } = existing.data;
    return rest;
  }, [existing.data, id]);

  const draft = edited ?? initial;
  const setDraft = setEdited;

  const save = useMutation({
    mutationFn: () => {
      if (!draft) throw new Error('brouillon manquant');

      const cleaned: RecipeInput = {
        ...draft,
        ingredients: draft.ingredients.filter((item) => item.label.trim().length > 0),
        steps: draft.steps.filter((step) => step.trim().length > 0),
      };

      return id ? saveRecipe(id, cleaned) : createRecipe(cleaned);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['recipes'] });
      router.replace('/nutrition/recipes');
    },
    onError: (caught) => setError(errorMessage(caught)),
  });

  const remove = useMutation({
    mutationFn: () => deleteRecipe(id!),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['recipes'] });
      router.replace('/nutrition/recipes');
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

  return (
    <Screen>
      <Title>{id ? t('recipes.editTitle') : t('recipes.createTitle')}</Title>

      {error ? <Banner message={error} /> : null}

      <Card title={t('recipes.aboutTitle')}>
        <TextField
          label={t('recipes.titleLabel')}
          value={draft.title}
          onChangeText={(title) => setDraft({ ...draft, title })}
          placeholder={t('recipes.titlePlaceholder')}
        />
        <TextField
          label={t('recipes.categoryLabel')}
          value={draft.category}
          onChangeText={(category) => setDraft({ ...draft, category })}
          placeholder={t('recipes.categoryPlaceholder')}
        />

        <View style={styles.row}>
          <NumberField
            style={styles.third}
            label={t('recipes.prepLabel')}
            value={draft.prepMinutes}
            onChange={(prepMinutes) => setDraft({ ...draft, prepMinutes })}
            suffix="min"
          />
          <NumberField
            style={styles.third}
            label={t('recipes.cookLabel')}
            value={draft.cookMinutes}
            onChange={(cookMinutes) => setDraft({ ...draft, cookMinutes })}
            suffix="min"
          />
          <NumberField
            style={styles.third}
            label={t('recipes.servingsLabel')}
            value={draft.servings}
            onChange={(servings) => setDraft({ ...draft, servings: servings ?? 1 })}
          />
        </View>

        <Caption>{t('recipes.photoComing')}</Caption>
      </Card>

      <Card title={t('recipes.macrosTitle')}>
        <Caption>{t('recipes.macrosHint')}</Caption>
        <View style={styles.row}>
          <NumberField
            style={styles.quarter}
            label="kcal"
            value={draft.kcal}
            onChange={(kcal) => setDraft({ ...draft, kcal })}
          />
          <NumberField
            style={styles.quarter}
            label={t('nutrition.proteinShort')}
            value={draft.proteinG}
            onChange={(proteinG) => setDraft({ ...draft, proteinG })}
          />
          <NumberField
            style={styles.quarter}
            label={t('nutrition.carbsShort')}
            value={draft.carbsG}
            onChange={(carbsG) => setDraft({ ...draft, carbsG })}
          />
          <NumberField
            style={styles.quarter}
            label={t('nutrition.fatShort')}
            value={draft.fatG}
            onChange={(fatG) => setDraft({ ...draft, fatG })}
          />
        </View>
      </Card>

      <Card title={t('recipes.ingredientsTitle')}>
        {draft.ingredients.map((ingredient, index) => (
          <View key={index} style={styles.row}>
            <TextField
              style={styles.grow}
              label={t('recipes.ingredientLabel')}
              value={ingredient.label}
              onChangeText={(label) =>
                setDraft({
                  ...draft,
                  ingredients: draft.ingredients.map((item, i) =>
                    i === index ? { ...item, label } : item,
                  ),
                })
              }
            />
            <TextField
              style={styles.narrow}
              label={t('recipes.quantityLabel')}
              value={ingredient.quantity}
              onChangeText={(quantity) =>
                setDraft({
                  ...draft,
                  ingredients: draft.ingredients.map((item, i) =>
                    i === index ? { ...item, quantity } : item,
                  ),
                })
              }
            />
            <Button
              variant="ghost"
              label={t('common.remove')}
              onPress={() =>
                setDraft({
                  ...draft,
                  ingredients: draft.ingredients.filter((_, i) => i !== index),
                })
              }
            />
          </View>
        ))}

        <Button
          block
          variant="secondary"
          label={t('recipes.addIngredient')}
          onPress={() =>
            setDraft({
              ...draft,
              ingredients: [
                ...draft.ingredients,
                { foodId: null, label: '', quantity: '', quantityG: null },
              ],
            })
          }
        />
      </Card>

      <Card title={t('recipes.stepsTitle')}>
        {draft.steps.map((step, index) => (
          <View key={index} style={styles.step}>
            <TextField
              label={t('recipes.stepLabel', { number: index + 1 })}
              value={step}
              multiline
              onChangeText={(text) =>
                setDraft({
                  ...draft,
                  steps: draft.steps.map((item, i) => (i === index ? text : item)),
                })
              }
            />
            <Button
              variant="ghost"
              label={t('common.remove')}
              onPress={() =>
                setDraft({ ...draft, steps: draft.steps.filter((_, i) => i !== index) })
              }
            />
          </View>
        ))}

        <Button
          block
          variant="secondary"
          label={t('recipes.addStep')}
          onPress={() => setDraft({ ...draft, steps: [...draft.steps, ''] })}
        />
      </Card>

      <Card title={t('recipes.tipTitle')}>
        <TextField
          label={t('recipes.tipLabel')}
          value={draft.tip}
          onChangeText={(tip) => setDraft({ ...draft, tip })}
          multiline
        />
      </Card>

      <Button
        block
        label={t('common.save')}
        loading={save.isPending}
        disabled={draft.title.trim().length === 0}
        onPress={() => {
          setError(null);
          save.mutate();
        }}
      />

      {id ? (
        <Button
          block
          variant="ghost"
          label={t('recipes.delete')}
          loading={remove.isPending}
          onPress={() => remove.mutate()}
        />
      ) : null}

      <Button block variant="ghost" label={t('common.cancel')} onPress={() => router.back()} />
    </Screen>
  );
}

/** Champ numérique tolérant : vide vaut « non renseigné ». */
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
  const [text, setText] = useState(value === null ? '' : String(value));

  return (
    <TextField
      style={style}
      label={label}
      value={text}
      suffix={suffix}
      keyboardType="number-pad"
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
  row: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-end', flexWrap: 'wrap' },
  grow: { flex: 2, minWidth: 140 },
  narrow: { flex: 1, minWidth: 90 },
  third: { flex: 1, minWidth: 90 },
  quarter: { flex: 1, minWidth: 70 },
  step: {
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.cardBorder,
  },
});
