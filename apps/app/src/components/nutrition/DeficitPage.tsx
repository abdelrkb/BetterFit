import { Mascot } from '@betterfit/mascot';
import { roundToTen, type NutritionTargets } from '@betterfit/shared';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { decimal } from '@/lib/format';
import { Banner, Body, Caption, Card, Heading, Metric, colors, spacing } from '@/ui';

/**
 * « Le déficit calorique », la page pédagogique du prototype, remplie avec
 * les chiffres de la personne.
 *
 * Les calories sont arrondies à la dizaine : annoncer « 1 753 kcal »
 * donnerait une fausse impression de précision sur une estimation à ±10 %.
 */
export function DeficitPage({ targets }: { targets: NutritionTargets }) {
  const { t } = useTranslation();

  const rules = [
    {
      key: 'protein',
      title: t('deficit.rule1Title'),
      body: t('deficit.rule1Body', { grams: targets.proteinG }),
    },
    { key: 'slow', title: t('deficit.rule2Title'), body: t('deficit.rule2Body') },
    {
      key: 'water',
      title: t('deficit.rule3Title'),
      body: t('deficit.rule3Body', { liters: decimal(targets.waterLiters) }),
    },
    { key: 'sleep', title: t('deficit.rule4Title'), body: t('deficit.rule4Body') },
  ];

  return (
    <>
      <Card overline={t('nutrition.deficitOverline')} title={t('nutrition.deficitTitle')}>
        <View style={styles.steps}>
          <Step
            value={roundToTen(targets.bmrKcal)}
            label={t('nutrition.bmr')}
            hint={t('deficit.bmrHint')}
          />
          <Step
            value={roundToTen(targets.maintenanceKcal)}
            label={t('nutrition.maintenance')}
            hint={t('deficit.maintenanceHint')}
          />
          <Step
            value={roundToTen(targets.targetKcal)}
            label={t('nutrition.target')}
            hint={t('deficit.targetHint')}
            highlight
          />
        </View>

        <Body>
          {targets.deficitKcal === 0
            ? t('nutrition.explainMaintain')
            : t(targets.deficitKcal > 0 ? 'nutrition.explainLose' : 'nutrition.explainGain', {
                kcal: Math.abs(targets.deficitKcal),
                kg: decimal(Math.abs(targets.kgPerWeek), 2),
              })}
        </Body>
      </Card>

      {targets.deficitTooLarge ? <Banner message={t('nutrition.deficitTooLarge')} /> : null}

      <Card title={t('deficit.rulesTitle')}>
        {rules.map((rule) => (
          <View key={rule.key} style={styles.rule}>
            <Heading>{rule.title}</Heading>
            <Body>{rule.body}</Body>
          </View>
        ))}
      </Card>

      <Card tone="soft">
        <View style={styles.mascotRow}>
          <Mascot pose="stand" size={88} />
          <View style={styles.mascotText}>
            <Heading>{t('deficit.patienceTitle')}</Heading>
            <Body>{t('deficit.patienceBody')}</Body>
          </View>
        </View>
      </Card>
    </>
  );
}

function Step({
  value,
  label,
  hint,
  highlight,
}: {
  value: number;
  label: string;
  hint: string;
  highlight?: boolean;
}) {
  return (
    <View style={[styles.step, highlight && styles.stepHighlight]}>
      <Metric>{value}</Metric>
      <Caption>{label}</Caption>
      <Caption>{hint}</Caption>
    </View>
  );
}

const styles = StyleSheet.create({
  steps: { gap: spacing.md },
  step: { gap: spacing.xs },
  stepHighlight: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginHorizontal: -spacing.md,
    borderRadius: 14,
    backgroundColor: colors.accentSoft,
  },
  rule: { gap: spacing.xs, paddingVertical: spacing.sm },
  mascotRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  mascotText: { flex: 1, gap: spacing.xs, minWidth: 140 },
});
