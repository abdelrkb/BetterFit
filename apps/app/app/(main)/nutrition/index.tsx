import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { CalorieRing } from '@/components/CalorieRing';
import { MacroBars } from '@/components/MacroBars';
import { decimal } from '@/lib/format';
import { useDailyTargets } from '@/lib/use-daily-targets';
import {
  Banner,
  Body,
  Caption,
  Card,
  Metric,
  Screen,
  Title,
  spacing,
  useWideScreen,
} from '@/ui';

/**
 * L'onglet Nutrition : les objectifs du jour et leur explication.
 *
 * Le menu, les plats et la liste de courses s'ajoutent à l'étape 7 ; les
 * chiffres affichés ici viennent déjà de `computeNutritionTargets`, qui fait
 * foi et est testé contre le prototype.
 */
export default function NutritionScreen() {
  const { t } = useTranslation();
  const wide = useWideScreen();
  const targets = useDailyTargets();

  if (targets === null) {
    return (
      <Screen>
        <Title>{t('nutrition.title')}</Title>
        <Card title={t('nutrition.noProfileTitle')}>
          <Body>{t('nutrition.noProfileBody')}</Body>
        </Card>
      </Screen>
    );
  }

  return (
    <Screen>
      <Title>{t('nutrition.title')}</Title>

      {targets.deficitTooLarge ? <Banner message={t('nutrition.deficitTooLarge')} /> : null}

      <View style={[styles.stack, wide && styles.columns]}>
        <View style={[styles.stack, wide && styles.column]}>
          <Card overline={t('nutrition.todayOverline')} title={t('nutrition.todayTitle')}>
            <CalorieRing targetKcal={targets.targetKcal} consumedKcal={0} />
            <Caption>{t('nutrition.journalComing')}</Caption>
          </Card>

          <Card title={t('nutrition.macrosTitle')}>
            <MacroBars targets={targets} />
          </Card>
        </View>

        <View style={[styles.stack, wide && styles.column]}>
          <Card overline={t('nutrition.deficitOverline')} title={t('nutrition.deficitTitle')}>
            <View style={styles.metrics}>
              <View style={styles.metric}>
                <Metric>{targets.bmrKcal}</Metric>
                <Caption>{t('nutrition.bmr')}</Caption>
              </View>
              <View style={styles.metric}>
                <Metric>{targets.maintenanceKcal}</Metric>
                <Caption>{t('nutrition.maintenance')}</Caption>
              </View>
              <View style={styles.metric}>
                <Metric>{targets.targetKcal}</Metric>
                <Caption>{t('nutrition.target')}</Caption>
              </View>
            </View>

            <Body>
              {targets.deficitKcal === 0
                ? t('nutrition.explainMaintain')
                : t(targets.deficitKcal > 0 ? 'nutrition.explainLose' : 'nutrition.explainGain', {
                    kcal: Math.abs(targets.deficitKcal),
                    kg: decimal(Math.abs(targets.kgPerWeek), 2),
                  })}
            </Body>

            <Caption>{t('nutrition.water', { liters: decimal(targets.waterLiters) })}</Caption>
          </Card>

          <Card title={t('nutrition.comingTitle')}>
            <Body>{t('nutrition.comingBody')}</Body>
          </Card>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  stack: { gap: spacing.lg },
  columns: { flexDirection: 'row', alignItems: 'flex-start' },
  column: { flex: 1 },
  metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg },
  metric: { gap: spacing.xs, minWidth: 90 },
});
