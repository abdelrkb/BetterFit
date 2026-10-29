import { MUSCLE_LABELS_FR, type Muscle } from '@betterfit/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { formatSeconds } from '@/components/RestTimer';
import { errorMessage } from '@/lib/errors';
import { deleteWorkout, fetchWorkout } from '@/lib/workouts';
import {
  Banner,
  Body,
  Button,
  Caption,
  Card,
  Metric,
  Screen,
  Title,
  colors,
  spacing,
} from '@/ui';

export default function WorkoutDetailScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { id } = useLocalSearchParams<{ id: string }>();

  const workout = useQuery({
    queryKey: ['workout', id],
    queryFn: () => fetchWorkout(id),
    enabled: Boolean(id),
  });

  const removal = useMutation({
    mutationFn: () => deleteWorkout(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['workouts'] });
      router.replace('/workout/history');
    },
  });

  if (workout.isPending) {
    return (
      <Screen>
        <ActivityIndicator color={colors.accent} />
      </Screen>
    );
  }

  if (workout.isError || !workout.data) {
    return (
      <Screen>
        <Banner message={errorMessage(workout.error)} />
        <Button block variant="ghost" label={t('common.back')} onPress={() => router.back()} />
      </Screen>
    );
  }

  const item = workout.data;

  return (
    <Screen>
      <Title>{item.sessionName || t('history.freeSession')}</Title>
      <Caption>{new Date(item.finishedAt).toLocaleString('fr-FR')}</Caption>

      <Card>
        <View style={styles.metrics}>
          <View style={styles.metric}>
            <Metric>{formatSeconds(item.durationSeconds)}</Metric>
            <Caption>{t('workout.duration')}</Caption>
          </View>
          <View style={styles.metric}>
            <Metric>{item.completedSets}</Metric>
            <Caption>{t('workout.setsDone')}</Caption>
          </View>
          <View style={styles.metric}>
            <Metric>{Math.round(item.totalVolumeKg)}</Metric>
            <Caption>{t('workout.volume')}</Caption>
          </View>
        </View>
      </Card>

      {item.exercises.map((exercise) => (
        <Card
          key={exercise.exerciseId}
          title={exercise.exercise?.name ?? t('training.unknownExercise')}
        >
          {exercise.exercise ? (
            <Caption>
              {exercise.exercise.primaryMuscles
                .map((muscle) => MUSCLE_LABELS_FR[muscle as Muscle])
                .join(', ')}
            </Caption>
          ) : null}

          {exercise.sets.map((set) => (
            <Caption key={set.setIndex} style={set.done ? styles.done : styles.skipped}>
              {t('history.setLine', {
                index: set.setIndex,
                weight: set.weightKg ?? '—',
                reps: set.reps ?? '—',
              })}
              {set.done ? '' : ` · ${t('history.skipped')}`}
            </Caption>
          ))}

          <Button
            block
            variant="ghost"
            label={t('progress.see')}
            onPress={() => router.push(`/workout/progress?exerciseId=${exercise.exerciseId}`)}
          />
        </Card>
      ))}

      {item.notes.length > 0 ? (
        <Card overline={t('workout.notesLabel')}>
          <Body>{item.notes}</Body>
        </Card>
      ) : null}

      {removal.isError ? <Banner message={errorMessage(removal.error)} /> : null}

      <Button
        block
        variant="danger"
        label={t('history.delete')}
        loading={removal.isPending}
        onPress={() => removal.mutate()}
      />
      <Button block variant="ghost" label={t('common.back')} onPress={() => router.back()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg },
  metric: { gap: spacing.xs, minWidth: 90 },
  done: { color: colors.inkSoft },
  skipped: { color: colors.muted },
});
