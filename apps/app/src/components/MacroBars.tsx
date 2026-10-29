import type { NutritionTargets } from '@betterfit/shared';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { Body, Caption, colors, radii, spacing } from '@/ui';

/**
 * La répartition des macronutriments, en trois barres.
 *
 * Chaque barre porte son nom, ses grammes et son pourcentage : on peut lire
 * la répartition sans distinguer les trois violets.
 */
export function MacroBars({ targets }: { targets: NutritionTargets }) {
  const { t } = useTranslation();

  const rows = [
    {
      key: 'protein',
      label: t('nutrition.protein'),
      grams: targets.proteinG,
      pct: targets.proteinPct,
      color: colors.accent,
    },
    {
      key: 'carbs',
      label: t('nutrition.carbs'),
      grams: targets.carbsG,
      pct: targets.carbsPct,
      color: colors.violetMid,
    },
    {
      key: 'fat',
      label: t('nutrition.fat'),
      grams: targets.fatG,
      pct: targets.fatPct,
      color: colors.lilac,
    },
  ];

  return (
    <View style={styles.wrapper}>
      {rows.map((row) => (
        <View key={row.key} style={styles.row}>
          <View style={styles.header}>
            <Body>{row.label}</Body>
            <Caption>{t('nutrition.macroValue', { grams: row.grams, pct: row.pct })}</Caption>
          </View>
          <View style={styles.track}>
            <View
              style={[
                styles.fill,
                { width: `${Math.min(100, row.pct)}%`, backgroundColor: row.color },
              ]}
            />
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: spacing.md },
  row: { gap: spacing.xs },
  header: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm },
  track: {
    height: 10,
    borderRadius: radii.pill,
    backgroundColor: colors.accentSoft,
    overflow: 'hidden',
  },
  fill: { height: '100%', borderRadius: radii.pill },
});
