import { Mascot } from '@betterfit/mascot';
import { ageFromBirthDate } from '@betterfit/shared';
import { Link } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { CoachingCard } from '@/components/CoachingCard';
import { TodaySessionCard } from '@/components/TodaySessionCard';
import { useSession } from '@/stores/session';
import { Body, Button, Caption, Card, HeroCard, Logo, Metric, Screen, Title, spacing } from '@/ui';

export default function HomeScreen() {
  const { t } = useTranslation();
  const user = useSession((state) => state.user);
  const profile = useSession((state) => state.profile);
  const latestWeightKg = useSession((state) => state.latestWeightKg);

  const age = profile ? ageFromBirthDate(profile.birthDate) : null;

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

      <TodaySessionCard />

      <Card title={t('home.profileCardTitle')}>
        <View style={styles.metrics}>
          <View style={styles.metric}>
            <Metric>
              {latestWeightKg === null ? '—' : latestWeightKg.toFixed(1).replace('.', ',')}
            </Metric>
            <Caption>{latestWeightKg === null ? t('home.noWeight') : t('home.weightUnit')}</Caption>
          </View>
          <View style={styles.metric}>
            <Metric>{profile?.heightCm ?? '—'}</Metric>
            <Caption>{t('home.heightUnit')}</Caption>
          </View>
          <View style={styles.metric}>
            <Metric>{age ?? '—'}</Metric>
            <Caption>{t('home.ageUnit')}</Caption>
          </View>
        </View>
        {profile ? (
          <Caption>{t('home.sessions', { count: profile.weeklySessions })}</Caption>
        ) : null}

        <Link href="/profile" asChild>
          <Button block variant="secondary" label={t('home.openProfile')} onPress={() => {}} />
        </Link>
      </Card>

      <Link href="/training" asChild>
        <Button block label={t('home.openTraining')} onPress={() => {}} />
      </Link>

      <Link href="/exercises" asChild>
        <Button block variant="secondary" label={t('home.openExercises')} onPress={() => {}} />
      </Link>

      <Link href="/workout/history" asChild>
        <Button block variant="secondary" label={t('home.openHistory')} onPress={() => {}} />
      </Link>

      <Link href="/coach" asChild>
        <Button block variant="secondary" label={t('home.openCoach')} onPress={() => {}} />
      </Link>

      <Link href="/demo" asChild>
        <Button block variant="ghost" label={t('home.openDemo')} onPress={() => {}} />
      </Link>
    </Screen>
  );
}

const styles = StyleSheet.create({
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  heroText: { flex: 1, gap: spacing.sm, minWidth: 180 },
  heroTitle: { marginTop: spacing.sm },
  metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg },
  metric: { gap: spacing.xs, minWidth: 90 },
});
