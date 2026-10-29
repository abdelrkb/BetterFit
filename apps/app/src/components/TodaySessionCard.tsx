import { Mascot } from '@betterfit/mascot';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { errorMessage } from '@/lib/errors';
import { fetchProgram, listPrograms } from '@/lib/programs';
import { buildLiveWorkout, todaySession } from '@/lib/start-workout';
import { useWorkout } from '@/stores/workout';
import { Banner, Body, Button, Caption, Card, Chip, spacing } from '@/ui';

/**
 * « La séance du jour ».
 *
 * On prend le programme actif le plus récent et on regarde ce que son planning
 * prévoit aujourd'hui. Choisir le dernier programme modifié est le plus proche
 * de ce qu'attend quelqu'un qui vient de s'en créer un.
 */
export function TodaySessionCard() {
  const { t } = useTranslation();
  const router = useRouter();
  const start = useWorkout((state) => state.start);
  const current = useWorkout((state) => state.current);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  const programs = useQuery({
    queryKey: ['programs', 'active'],
    queryFn: () => listPrograms({ templates: false }),
  });

  const activeId = programs.data?.items[0]?.id;

  const program = useQuery({
    queryKey: ['program', activeId],
    queryFn: () => fetchProgram(activeId!),
    enabled: Boolean(activeId),
  });

  if (current) {
    return (
      <Card tone="soft" title={t('workout.resumeTitle')}>
        <Body>{t('workout.resumeBody', { name: current.sessionName })}</Body>
        <Button block label={t('workout.resume')} onPress={() => router.push('/workout/live')} />
      </Card>
    );
  }

  if (!activeId || !program.data) {
    return (
      <Card tone="soft" title={t('workout.todayTitle')}>
        <Body>{t('workout.noProgram')}</Body>
        <Button
          block
          variant="secondary"
          label={t('training.create')}
          onPress={() => router.push('/training/edit')}
        />
      </Card>
    );
  }

  const session = todaySession(program.data);

  if (!session) {
    return (
      <Card tone="soft" title={t('workout.todayTitle')}>
        <View style={styles.restRow}>
          <Mascot pose="stand" size={72} />
          <View style={styles.restText}>
            <Body>{t('workout.restDay')}</Body>
            <Caption>{t('workout.restDayHint')}</Caption>
          </View>
        </View>
        <Button
          block
          variant="ghost"
          label={t('workout.chooseSession')}
          onPress={() => router.push(`/training/${program.data.id}`)}
        />
      </Card>
    );
  }

  return (
    <Card overline={t('workout.todayTitle')} title={session.name}>
      {error ? <Banner message={error} /> : null}

      <View style={styles.chips}>
        <Chip tone="dark" label={t('training.minutes', { count: session.durationMinutes })} />
        <Chip label={t('training.exerciseCount', { count: session.exercises.length })} />
      </View>

      <Button
        block
        label={t('workout.start')}
        loading={starting}
        onPress={async () => {
          setError(null);
          setStarting(true);

          try {
            await start(await buildLiveWorkout(program.data, session));
            router.push('/workout/live');
          } catch (caught) {
            setError(errorMessage(caught));
          } finally {
            setStarting(false);
          }
        }}
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  restRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  restText: { flex: 1, gap: spacing.xs },
});
