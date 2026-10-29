import {
  ACTIVITY_COEFFICIENTS,
  targetsFromSettings,
  type ActivityLevel,
  type NutritionSettings,
} from '@betterfit/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { errorMessage } from '@/lib/errors';
import { decimal } from '@/lib/format';
import {
  addCategory,
  addMeal,
  addMealItem,
  addShoppingItem,
  draftFromProgram,
  emptyNutritionDraft,
  removeCategory,
  removeMeal,
  removeMealItem,
  removeShoppingItem,
  toInput,
  updateCategory,
  updateMeal,
  updateMealItem,
  updateShoppingDraftItem,
  type NutritionDraft,
} from '@/lib/nutrition-draft';
import {
  createNutritionProgram,
  fetchNutritionProgram,
  saveNutritionProgram,
} from '@/lib/nutrition';
import { useSession } from '@/stores/session';
import {
  Banner,
  Button,
  Caption,
  Card,
  Metric,
  OptionGroup,
  Screen,
  Tabs,
  TextField,
  Title,
  colors,
  spacing,
} from '@/ui';

type Step = 'settings' | 'meals' | 'shopping';

const ACTIVITY_LABELS: Record<ActivityLevel, string> = {
  sedentary: 'Sédentaire',
  light: 'Peu actif',
  moderate: 'Actif',
  active: 'Très actif',
  very_active: 'Sportif intense',
};

/**
 * L'éditeur de programme alimentaire.
 *
 * Trois étapes : les réglages (qui donnent les cibles), la journée type, la
 * liste de courses. Les cibles se recalculent à chaque frappe — c'est le
 * principe du prototype : on voit tout de suite l'effet d'un déficit.
 */
export default function NutritionEditScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { id } = useLocalSearchParams<{ id?: string }>();

  const profile = useSession((state) => state.profile);
  const latestWeightKg = useSession((state) => state.latestWeightKg);

  const [step, setStep] = useState<Step>('settings');
  /** `null` tant que rien n'a été touché : le brouillon vient alors de la
      requête, ou des valeurs par défaut. */
  const [edited, setEdited] = useState<NutritionDraft | null>(null);
  const [error, setError] = useState<string | null>(null);

  const existing = useQuery({
    queryKey: ['nutrition-program', id],
    queryFn: () => fetchNutritionProgram(id!),
    enabled: Boolean(id),
  });

  /**
   * Le brouillon est **dérivé pendant le rendu**, pas posé par un effet :
   * initialiser un état depuis une requête dans un `useEffect` déclenche un
   * second rendu à chaque fois, et l'écran clignote.
   */
  const initial = useMemo(
    () =>
      id
        ? existing.data
          ? draftFromProgram(existing.data)
          : null
        : emptyNutritionDraft(profile, latestWeightKg),
    [existing.data, id, latestWeightKg, profile],
  );

  const draft = edited ?? initial;
  const setDraft = setEdited;

  const save = useMutation({
    mutationFn: () => {
      if (!draft) throw new Error('brouillon manquant');
      const input = toInput(draft);

      return id ? saveNutritionProgram(id, input) : createNutritionProgram(input);
    },
    onSuccess: (saved) => {
      queryClient.setQueryData(['nutrition-program', saved.id], saved);
      void queryClient.invalidateQueries({ queryKey: ['nutrition-programs'] });
      router.replace('/nutrition');
    },
    onError: (caught) => setError(errorMessage(caught)),
  });

  if (id && existing.isPending) {
    return (
      <Screen>
        <ActivityIndicator color={colors.accent} />
      </Screen>
    );
  }

  if (!draft) {
    return (
      <Screen>
        <ActivityIndicator color={colors.accent} />
      </Screen>
    );
  }

  const targets = targetsFromSettings(draft.settings);

  // Fonction fléchée, et pas `function` : une déclaration de fonction est
  // hissée, donc TypeScript oublie que `draft` vient d'être vérifié non nul.
  const patchSettings = (patch: Partial<NutritionSettings>) => {
    setDraft({ ...draft, settings: { ...draft.settings, ...patch } });
  };

  return (
    <Screen>
      <Title>{id ? t('nutrition.editTitle') : t('nutrition.createTitle')}</Title>

      {error ? <Banner message={error} /> : null}

      <TextField
        label={t('nutrition.planTitleLabel')}
        value={draft.title}
        onChangeText={(title) => setDraft({ ...draft, title })}
        placeholder={t('nutrition.planTitlePlaceholder')}
      />

      <Tabs
        value={step}
        onChange={setStep}
        items={[
          { value: 'settings', label: t('nutrition.stepSettings') },
          { value: 'meals', label: t('nutrition.stepMeals') },
          { value: 'shopping', label: t('nutrition.stepShopping') },
        ]}
      />

      {/* Les cibles restent visibles quelle que soit l'étape : c'est la
          boussole de tout l'écran. */}
      <Card tone="soft" overline={t('nutrition.targetsOverline')}>
        <View style={styles.targets}>
          <View style={styles.target}>
            <Metric>{targets.targetKcal}</Metric>
            <Caption>{t('nutrition.target')}</Caption>
          </View>
          <View style={styles.target}>
            <Metric>{targets.proteinG}</Metric>
            <Caption>{t('nutrition.proteinShort')}</Caption>
          </View>
          <View style={styles.target}>
            <Metric>{targets.carbsG}</Metric>
            <Caption>{t('nutrition.carbsShort')}</Caption>
          </View>
          <View style={styles.target}>
            <Metric>{targets.fatG}</Metric>
            <Caption>{t('nutrition.fatShort')}</Caption>
          </View>
        </View>
        <Caption>
          {t('nutrition.paceHint', { kg: decimal(Math.abs(targets.kgPerWeek), 2) })}
        </Caption>
      </Card>

      {targets.deficitTooLarge ? <Banner message={t('nutrition.deficitTooLarge')} /> : null}

      {step === 'settings' ? (
        <SettingsStep settings={draft.settings} onChange={patchSettings} />
      ) : null}

      {step === 'meals' ? (
        <MealsStep draft={draft} onChange={setDraft} />
      ) : null}

      {step === 'shopping' ? (
        <ShoppingStep draft={draft} onChange={setDraft} />
      ) : null}

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

      <Button block variant="ghost" label={t('common.cancel')} onPress={() => router.back()} />
    </Screen>
  );
}

function SettingsStep({
  settings,
  onChange,
}: {
  settings: NutritionSettings;
  onChange: (patch: Partial<NutritionSettings>) => void;
}) {
  const { t } = useTranslation();

  return (
    <>
      <Card title={t('nutrition.whoTitle')}>
        <Caption>{t('nutrition.whoHint')}</Caption>

        <OptionGroup
          label={t('onboarding.sexLabel')}
          layout="row"
          value={settings.sex}
          onChange={(sex) => onChange({ sex })}
          options={[
            { value: 'female' as const, label: t('onboarding.sexFemale') },
            { value: 'male' as const, label: t('onboarding.sexMale') },
          ]}
        />

        <NumberField
          label={t('nutrition.ageLabel')}
          value={settings.age}
          onChange={(age) => onChange({ age })}
          suffix={t('home.ageUnit')}
        />
        <NumberField
          label={t('nutrition.weightLabel')}
          value={settings.weightKg}
          onChange={(weightKg) => onChange({ weightKg })}
          suffix="kg"
          decimals
        />
        <NumberField
          label={t('nutrition.heightLabel')}
          value={settings.heightCm}
          onChange={(heightCm) => onChange({ heightCm })}
          suffix="cm"
        />

        <OptionGroup
          label={t('nutrition.activityLabel')}
          value={settings.activityLevel}
          onChange={(activityLevel) => onChange({ activityLevel })}
          options={(Object.keys(ACTIVITY_COEFFICIENTS) as ActivityLevel[]).map((level) => ({
            value: level,
            label: ACTIVITY_LABELS[level],
          }))}
        />
      </Card>

      <Card title={t('nutrition.settingsTitle')}>
        <NumberField
          label={t('nutrition.deficitLabel')}
          value={settings.deficitKcal}
          onChange={(deficitKcal) => onChange({ deficitKcal })}
          suffix="kcal"
          hint={t('nutrition.deficitHint')}
          allowNegative
        />
        <NumberField
          label={t('nutrition.proteinPerKgLabel')}
          value={settings.proteinGPerKg}
          onChange={(proteinGPerKg) => onChange({ proteinGPerKg })}
          suffix="g/kg"
          decimals
        />
        <NumberField
          label={t('nutrition.fatPerKgLabel')}
          value={settings.fatGPerKg}
          onChange={(fatGPerKg) => onChange({ fatGPerKg })}
          suffix="g/kg"
          decimals
        />
        <NumberField
          label={t('nutrition.fiberLabel')}
          value={settings.fiberG}
          onChange={(fiberG) => onChange({ fiberG })}
          suffix="g"
        />
      </Card>

      <Card title={t('nutrition.goalTitle')}>
        <TextField
          label={t('nutrition.goalTitleLabel')}
          value={settings.goalTitle}
          onChangeText={(goalTitle) => onChange({ goalTitle })}
          placeholder={t('nutrition.goalTitlePlaceholder')}
        />
        <TextField
          label={t('nutrition.goalTextLabel')}
          value={settings.goalText}
          onChangeText={(goalText) => onChange({ goalText })}
          multiline
        />
        <TextField
          label={t('nutrition.preferredLabel')}
          value={settings.preferred.join(', ')}
          onChangeText={(value) => onChange({ preferred: splitList(value) })}
          hint={t('nutrition.listHint')}
        />
        <TextField
          label={t('nutrition.limitedLabel')}
          value={settings.limited.join(', ')}
          onChangeText={(value) => onChange({ limited: splitList(value) })}
          hint={t('nutrition.listHint')}
        />
        <TextField
          label={t('nutrition.coachNoteLabel')}
          value={settings.coachNote}
          onChangeText={(coachNote) => onChange({ coachNote })}
          multiline
        />
      </Card>
    </>
  );
}

function MealsStep({
  draft,
  onChange,
}: {
  draft: NutritionDraft;
  onChange: (draft: NutritionDraft) => void;
}) {
  const { t } = useTranslation();

  return (
    <>
      {draft.meals.map((meal, mealIndex) => (
        <Card key={mealIndex} title={meal.name || t('nutrition.mealFallback')}>
          <View style={styles.row}>
            <TextField
              style={styles.grow}
              label={t('nutrition.mealNameLabel')}
              value={meal.name}
              onChangeText={(name) => onChange(updateMeal(draft, mealIndex, { name }))}
            />
            <TextField
              style={styles.narrow}
              label={t('nutrition.mealTimeLabel')}
              value={meal.time}
              onChangeText={(time) => onChange(updateMeal(draft, mealIndex, { time }))}
              placeholder="07h30"
            />
          </View>

          <NumberField
            label={t('nutrition.mealKcalLabel')}
            value={meal.kcalOverride}
            onChange={(kcalOverride) =>
              onChange(updateMeal(draft, mealIndex, { kcalOverride }))
            }
            suffix="kcal"
            hint={t('nutrition.mealKcalHint')}
            nullable
          />

          {meal.items.map((item, itemIndex) => (
            <View key={itemIndex} style={styles.item}>
              <TextField
                label={t('nutrition.itemLabel')}
                value={item.label}
                onChangeText={(label) =>
                  onChange(updateMealItem(draft, mealIndex, itemIndex, { label }))
                }
              />
              <View style={styles.row}>
                <TextField
                  style={styles.grow}
                  label={t('nutrition.itemQuantityLabel')}
                  value={item.quantity}
                  onChangeText={(quantity) =>
                    onChange(updateMealItem(draft, mealIndex, itemIndex, { quantity }))
                  }
                  placeholder="160 g"
                />
                <NumberField
                  style={styles.narrow}
                  label="kcal"
                  value={item.kcal}
                  onChange={(kcal) =>
                    onChange(updateMealItem(draft, mealIndex, itemIndex, { kcal }))
                  }
                  nullable
                />
              </View>
              <TextField
                label={t('nutrition.itemAlternativeLabel')}
                value={item.alternative}
                onChangeText={(alternative) =>
                  onChange(updateMealItem(draft, mealIndex, itemIndex, { alternative }))
                }
              />
              <Button
                variant="ghost"
                label={t('nutrition.removeItem')}
                onPress={() => onChange(removeMealItem(draft, mealIndex, itemIndex))}
              />
            </View>
          ))}

          <Button
            block
            variant="secondary"
            label={t('nutrition.addItem')}
            onPress={() => onChange(addMealItem(draft, mealIndex))}
          />
          <Button
            block
            variant="ghost"
            label={t('nutrition.removeMeal')}
            onPress={() => onChange(removeMeal(draft, mealIndex))}
          />
        </Card>
      ))}

      <Button block label={t('nutrition.addMeal')} onPress={() => onChange(addMeal(draft))} />
    </>
  );
}

function ShoppingStep({
  draft,
  onChange,
}: {
  draft: NutritionDraft;
  onChange: (draft: NutritionDraft) => void;
}) {
  const { t } = useTranslation();

  return (
    <>
      <Card title={t('nutrition.shoppingSettingsTitle')}>
        <NumberField
          label={t('nutrition.shoppingDaysLabel')}
          value={draft.settings.shoppingDays}
          onChange={(shoppingDays) =>
            onChange({ ...draft, settings: { ...draft.settings, shoppingDays } })
          }
          suffix={t('nutrition.daysSuffix')}
        />
        <NumberField
          label={t('nutrition.budgetLabel')}
          value={draft.settings.budgetCents === null ? null : draft.settings.budgetCents / 100}
          onChange={(euros) =>
            onChange({
              ...draft,
              settings: {
                ...draft.settings,
                budgetCents: euros === null ? null : Math.round(euros * 100),
              },
            })
          }
          suffix="€"
          decimals
          nullable
        />
      </Card>

      {draft.shopping.map((category, categoryIndex) => (
        <Card key={categoryIndex} title={category.name || t('nutrition.categoryFallback')}>
          <TextField
            label={t('nutrition.categoryNameLabel')}
            value={category.name}
            onChangeText={(name) => onChange(updateCategory(draft, categoryIndex, { name }))}
          />

          {category.items.map((item, itemIndex) => (
            <View key={itemIndex} style={styles.row}>
              <TextField
                style={styles.grow}
                label={t('nutrition.articleLabel')}
                value={item.label}
                onChangeText={(label) =>
                  onChange(updateShoppingDraftItem(draft, categoryIndex, itemIndex, { label }))
                }
              />
              <TextField
                style={styles.narrow}
                label={t('nutrition.articleQuantityLabel')}
                value={item.quantity}
                onChangeText={(quantity) =>
                  onChange(updateShoppingDraftItem(draft, categoryIndex, itemIndex, { quantity }))
                }
              />
              <Button
                variant="ghost"
                label={t('common.remove')}
                onPress={() => onChange(removeShoppingItem(draft, categoryIndex, itemIndex))}
              />
            </View>
          ))}

          <Button
            block
            variant="secondary"
            label={t('nutrition.addArticle')}
            onPress={() => onChange(addShoppingItem(draft, categoryIndex))}
          />
          <Button
            block
            variant="ghost"
            label={t('nutrition.removeCategory')}
            onPress={() => onChange(removeCategory(draft, categoryIndex))}
          />
        </Card>
      ))}

      <Button
        block
        label={t('nutrition.addCategory')}
        onPress={() => onChange(addCategory(draft))}
      />
    </>
  );
}

/**
 * Un champ numérique qui accepte la virgule française.
 *
 * On ne reformate pas la valeur pendant la frappe : sinon on ne peut plus
 * effacer un chiffre ni taper « 0, » avant la décimale. Le texte saisi vit
 * à côté de la valeur, et seule une saisie valide remonte.
 */
type NumberFieldCommon = {
  label: string;
  suffix?: string;
  hint?: string;
  decimals?: boolean;
  allowNegative?: boolean;
  style?: StyleProp<ViewStyle>;
};

type NumberFieldProps =
  | (NumberFieldCommon & { nullable: true; value: number | null; onChange: (value: number | null) => void })
  | (NumberFieldCommon & { nullable?: false; value: number; onChange: (value: number) => void });

function NumberField(props: NumberFieldProps) {
  const { label, value, suffix, hint, decimals = false, allowNegative = false, style } = props;
  const [text, setText] = useState(value === null ? '' : String(value).replace('.', ','));

  return (
    <TextField
      style={style}
      label={label}
      value={text}
      hint={hint}
      suffix={suffix}
      keyboardType={
        decimals ? 'decimal-pad' : allowNegative ? 'numbers-and-punctuation' : 'number-pad'
      }
      onChangeText={(next) => {
        setText(next);

        const trimmed = next.trim();

        if (trimmed.length === 0) {
          if (props.nullable) props.onChange(null);
          return;
        }

        const parsed = Number(trimmed.replace(',', '.'));
        if (!Number.isFinite(parsed)) return;

        if (props.nullable) props.onChange(parsed);
        else props.onChange(parsed);
      }}
    />
  );
}

function splitList(value: string): string[] {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

const styles = StyleSheet.create({
  targets: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg },
  target: { gap: spacing.xs, minWidth: 70 },
  row: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-end', flexWrap: 'wrap' },
  grow: { flex: 2, minWidth: 140 },
  narrow: { flex: 1, minWidth: 90 },
  item: {
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.cardBorder,
  },
});
