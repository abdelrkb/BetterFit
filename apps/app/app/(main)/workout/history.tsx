import { Mascot } from '@betterfit/mascot';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { formatSeconds } from '@/components/RestTimer';
import { errorMessage } from '@/lib/errors';
import { listWorkouts } from '@/lib/workouts';
import { useWorkout } from '@/stores/workout';
import {
  Banner,
  Body,
  Button,
  Caption,
  Card,
  Heading,
  Screen,
  Title,
  colors,
  spacing,
} from '@/ui';

export default function WorkoutHistoryScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const pending = useWorkout((state) => state.queue.length);
  const flush = useWorkout((state) => state.flush);
  const queryClient = useQueryClient();

  const workouts = useQuery({ queryKey: ['workouts'], queryFn: listWorkouts });

  // On vient ici pour vérifier qu'une séance est bien arrivée : c'est le bon
  // moment pour retenter l'envoi de celles qui attendent.
  useEffect(() => {
    if (pending === 0) return;

    void flush().then(() => queryClient.invalidateQueries({ queryKey: ['workouts'] }));
  }, [pending, flush, queryClient]);

  return (
    <Screen>
      <Title>{t('history.title')}</Title>

      {pending > 0 ? (
        <Banner tone="info" message={t('history.pending', { count: pending })} />
      ) : null}

      {workouts.isError ? <Banner message={errorMessage(workouts.error)} /> : null}

      {workouts.isPending ? (
        <ActivityIndicator color={colors.accent} />
      ) : workouts.data && workouts.data.items.length > 0 ? (
        workouts.data.items.map((item) => (
          <Pressable
            key={item.id}
            accessibilityRole="button"
            accessibilityLabel={item.sessionName}
            onPress={() => router.push(`/workout/${item.id}`)}
          >
            <Card title={item.sessionName || t('history.freeSession')}>
              <Caption>{formatDateTime(item.finishedAt)}</Caption>
              <View style={styles.metrics}>
                <Caption>{t('history.duration', { value: formatSeconds(item.durationSeconds) })}</Caption>
                <Caption>{t('history.sets', { count: item.completedSets })}</Caption>
                <Caption>{t('history.volume', { value: Math.round(item.totalVolumeKg) })}</Caption>
              </View>
            </Card>
          </Pressable>
        ))
      ) : (
        <Card tone="soft" style={styles.empty}>
          <Mascot pose="stand" size={110} />
          <Heading>{t('history.empty')}</Heading>
          <Body style={styles.center}>{t('history.emptyHint')}</Body>
        </Card>
      )}

      <Button block variant="ghost" label={t('common.back')} onPress={() => router.back()} />
    </Screen>
  );
}

function formatDateTime(iso: string): string {
  const date = new Date(iso);
  return `${date.toLocaleDateString('fr-FR')} · ${date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
}

const styles = StyleSheet.create({
  metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  empty: { alignItems: 'center', gap: spacing.sm },
  center: { textAlign: 'center' },
});
