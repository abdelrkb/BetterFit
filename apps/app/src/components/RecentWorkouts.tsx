import { Mascot } from '@betterfit/mascot';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';
import { decimal } from '@/lib/format';
import { listWorkouts } from '@/lib/workouts';
import { Body, Button, Caption, Card, Heading, MIN_TOUCH_SIZE, colors, radii, spacing } from '@/ui';

/** Combien de séances l'accueil montre avant de renvoyer vers l'historique. */
const COUNT = 3;

/**
 * Les dernières séances terminées, sur l'accueil.
 *
 * Trois suffisent : l'accueil répond à « où j'en suis », l'historique complet
 * répond à « qu'est-ce que j'ai fait le 12 ».
 */
export function RecentWorkouts() {
  const { t } = useTranslation();
  const router = useRouter();

  const workouts = useQuery({ queryKey: ['workouts'], queryFn: listWorkouts });

  if (workouts.isPending) return null;

  const items = workouts.data?.items.slice(0, COUNT) ?? [];

  if (items.length === 0) {
    return (
      <Card overline={t('home.recentOverline')} title={t('home.recentEmptyTitle')}>
        <View style={styles.emptyRow}>
          <Mascot pose="stand" size={72} />
          <Body style={styles.emptyText}>{t('home.recentEmptyBody')}</Body>
        </View>
      </Card>
    );
  }

  return (
    <Card overline={t('home.recentOverline')} title={t('home.recentTitle')}>
      {items.map((workout) => (
        <Pressable
          key={workout.id}
          style={styles.row}
          accessibilityRole="button"
          accessibilityLabel={t('home.recentOpen', { name: workout.sessionName })}
          onPress={() => router.push(`/workout/${workout.id}`)}
        >
          <View style={styles.rowText}>
            <Heading>{workout.sessionName}</Heading>
            <Caption>
              {t('home.recentLine', {
                date: new Date(workout.startedAt).toLocaleDateString('fr-FR', {
                  weekday: 'short',
                  day: 'numeric',
                  month: 'short',
                }),
                minutes: Math.round(workout.durationSeconds / 60),
                volume: decimal(workout.totalVolumeKg / 1000, 1),
              })}
            </Caption>
          </View>
        </Pressable>
      ))}

      <Button
        block
        variant="ghost"
        label={t('home.openHistory')}
        onPress={() => router.push('/workout/history')}
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: MIN_TOUCH_SIZE,
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radii.tile,
    backgroundColor: colors.accentSoft,
  },
  rowText: { gap: spacing.xs },
  emptyRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  emptyText: { flex: 1 },
});
