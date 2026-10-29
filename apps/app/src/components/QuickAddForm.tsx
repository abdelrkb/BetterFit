import { kcalFromMacros } from '@betterfit/shared';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { Body, Button, Caption, Card, Screen, TextField, Title, spacing } from '@/ui';

export type QuickEntry = {
  label: string;
  kcal: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
};

/**
 * La saisie rapide : un nom et des calories, le reste facultatif.
 *
 * C'est le chemin pour ce qu'on ne trouvera jamais dans une base : le plat
 * du restaurant, la part de gâteau d'un collègue. Exiger les macros ferait
 * renoncer à loguer, et une journée non remplie vaut moins qu'une journée
 * approximative.
 */
export function QuickAddForm({
  onSubmit,
  onCancel,
}: {
  onSubmit: (entry: QuickEntry) => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [label, setLabel] = useState('');
  const [kcal, setKcal] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');

  const parse = (value: string): number | null => {
    const trimmed = value.trim();
    if (trimmed.length === 0) return null;

    const parsed = Number(trimmed.replace(',', '.'));
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
  };

  const macros = {
    proteinG: parse(protein),
    carbsG: parse(carbs),
    fatG: parse(fat),
  };

  // Si les macros sont là mais pas les calories, on les propose.
  const suggested =
    parse(kcal) === null &&
    (macros.proteinG !== null || macros.carbsG !== null || macros.fatG !== null)
      ? kcalFromMacros({
          proteinG: macros.proteinG ?? 0,
          carbsG: macros.carbsG ?? 0,
          fatG: macros.fatG ?? 0,
        })
      : null;

  return (
    <Screen>
      <Title>{t('journal.quickTitle')}</Title>
      <Body>{t('journal.quickSubtitle')}</Body>

      <Card>
        <TextField
          label={t('journal.quickLabel')}
          value={label}
          onChangeText={setLabel}
          placeholder={t('journal.quickPlaceholder')}
          autoFocus
        />
        <TextField
          label={t('journal.quickKcal')}
          value={kcal}
          onChangeText={setKcal}
          keyboardType="number-pad"
          suffix="kcal"
        />

        <Caption>{t('journal.quickMacrosHint')}</Caption>
        <View style={styles.row}>
          <TextField
            style={styles.cell}
            label={t('foods.proteinLabel')}
            value={protein}
            onChangeText={setProtein}
            keyboardType="decimal-pad"
          />
          <TextField
            style={styles.cell}
            label={t('foods.carbsLabel')}
            value={carbs}
            onChangeText={setCarbs}
            keyboardType="decimal-pad"
          />
          <TextField
            style={styles.cell}
            label={t('foods.fatLabel')}
            value={fat}
            onChangeText={setFat}
            keyboardType="decimal-pad"
          />
        </View>

        {suggested !== null ? (
          <View style={styles.suggestion}>
            <Body>{t('journal.quickSuggested', { kcal: suggested })}</Body>
            <Button
              variant="secondary"
              label={t('foods.useSuggested')}
              onPress={() => setKcal(String(suggested))}
            />
          </View>
        ) : null}
      </Card>

      <Button
        block
        label={t('journal.quickAdd')}
        disabled={label.trim().length === 0}
        onPress={() =>
          onSubmit({
            label: label.trim(),
            kcal: parse(kcal) ?? suggested,
            ...macros,
          })
        }
      />
      <Button block variant="ghost" label={t('common.cancel')} onPress={onCancel} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  cell: { flex: 1, minWidth: 90 },
  suggestion: { gap: spacing.sm },
});
