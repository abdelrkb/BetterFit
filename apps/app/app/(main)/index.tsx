import { Mascot } from '@betterfit/mascot';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { CalorieRing } from '@/components/CalorieRing';
import { CoachingCard } from '@/components/CoachingCard';
import { RecentWorkouts } from '@/components/RecentWorkouts';
import { TodaySessionCard } from '@/components/TodaySessionCard';
import { WeightWidget } from '@/components/WeightWidget';
import { useDailyTargets } from '@/lib/use-daily-targets';
import { useSession } from '@/stores/session';
import { Body, Card, HeroCard, Logo, Screen, Title, spacing, useWideScreen } from '@/ui';

/**
 * L'accueil : où j'en suis aujourd'hui.
 *
 * Trois réponses, dans l'ordre : ce qu'il me reste à manger, ce que je dois
 * m'entraîner, et où en est mon poids. Le reste de l'app est dans les onglets.
 */
export default function HomeScreen() {
  const { t } = useTranslation();
  const user = useSession((state) => state.user);
  const wide = useWideScreen();
  const targets = useDailyTargets();

  return (
    <Screen>
      <HeroCard>
        <View style={styles.heroRow}>
          <View style={styles.heroText}>
            <Logo onDark />
            <Title onDark style={styles.heroTitle}>
              {t('home.greeting', { name: user?.name ?? '' })}
            </Title>
            <Body onDark>{t('home.subtitle')}</Body>
          </View>
          <Mascot pose="flex" size={88} tone="onDark" />
        </View>
      </HeroCard>

      <CoachingCard />

      <View style={[styles.stack, wide && styles.columns]}>
        <View style={[styles.stack, wide && styles.column]}>
          <Card overline={t('home.caloriesOverline')} title={t('home.caloriesTitle')}>
            {targets === null ? (
              <Body>{t('home.caloriesNoProfile')}</Body>
            ) : (
              <CalorieRing targetKcal={targets.targetKcal} consumedKcal={0} />
            )}
          </Card>

          <WeightWidget />
        </View>

        <View style={[styles.stack, wide && styles.column]}>
          <TodaySessionCard />
          <RecentWorkouts />
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  heroText: { flex: 1, gap: spacing.sm, minWidth: 180 },
  heroTitle: { marginTop: spacing.sm },
  stack: { gap: spacing.lg },
  // Sur grand écran, deux colonnes ; sur téléphone, tout s'empile.
  columns: { flexDirection: 'row', alignItems: 'flex-start' },
  column: { flex: 1 },
});
