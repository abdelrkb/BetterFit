import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { ProgressChart } from '@/components/ProgressChart';
import { errorMessage } from '@/lib/errors';
import { fetchProgress } from '@/lib/workouts';
import { Banner, Button, Caption, Card, Metric, Screen, Title, colors, spacing } from '@/ui';

export default function ProgressScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { exerciseId } = useLocalSearchParams<{ exerciseId: string }>();

  const progress = useQuery({
    queryKey: ['progress', exerciseId],
    queryFn: () => fetchProgress(exerciseId),
    enabled: Boolean(exerciseId),
  });

  if (progress.isPending) {
    return (
      <Screen>
        <ActivityIndicator color={colors.accent} />
      </Screen>
    );
  }

  if (progress.isError || !progress.data) {
    return (
      <Screen>
        <Banner message={errorMessage(progress.error)} />
        <Button block variant="ghost" label={t('common.back')} onPress={() => router.back()} />
      </Screen>
    );
  }

  const data = progress.data;

  return (
    <Screen>
      <Title>{data.exercise?.name ?? t('progress.title')}</Title>

      <Card>
        <View style={styles.metrics}>
          <View style={styles.metric}>
            <Metric>{data.bestWeightKg === null ? '—' : Math.round(data.bestWeightKg)}</Metric>
            <Caption>{t('progress.bestWeight')}</Caption>
          </View>
          <View style={styles.metric}>
            <Metric>
              {data.bestOneRepMaxKg === null ? '—' : Math.round(data.bestOneRepMaxKg)}
            </Metric>
            <Caption>{t('progress.bestOneRepMax')}</Caption>
          </View>
          <View style={styles.metric}>
            <Metric>{data.points.length}</Metric>
            <Caption>{t('progress.sessions')}</Caption>
          </View>
        </View>
      </Card>

      <Card overline={t('progress.overline')} title={t('progress.chartTitle')}>
        <ProgressChart points={data.points} />
      </Card>

      <Button block variant="ghost" label={t('common.back')} onPress={() => router.back()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg },
  metric: { gap: spacing.xs, minWidth: 90 },
});
