import { Mascot } from '@betterfit/mascot';
import {
  LEVEL_LABELS_FR,
  MUSCLE_LABELS_FR,
  PLACE_LABELS_FR,
  TRAINING_GOAL_LABELS_FR,
  WEEK_DAYS,
  WEEK_DAY_SHORT_FR,
  trainingSessionLabel,
  type Muscle,
  type Program,
} from '@betterfit/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { errorMessage } from '@/lib/errors';
import { openProgramPdf } from '@/lib/pdf';
import { deleteProgram, duplicateProgram, fetchProgram } from '@/lib/programs';
import {
  Banner,
  Body,
  Button,
  Caption,
  Card,
  Chip,
  Heading,
  HeroCard,
  Overline,
  Screen,
  Title,
  colors,
  radii,
  spacing,
} from '@/ui';

export default function ProgramScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { id } = useLocalSearchParams<{ id: string }>();

  const program = useQuery({
    queryKey: ['program', id],
    queryFn: () => fetchProgram(id),
    enabled: Boolean(id),
  });

  const removal = useMutation({
    mutationFn: () => deleteProgram(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['programs'] });
      router.replace('/training');
    },
  });

  const copy = useMutation({
    mutationFn: () => duplicateProgram(id),
    onSuccess: async (created) => {
      await queryClient.invalidateQueries({ queryKey: ['programs'] });
      router.replace(`/training/${created.id}`);
    },
  });

  if (program.isPending) {
    return (
      <Screen>
        <ActivityIndicator color={colors.accent} />
      </Screen>
    );
  }

  if (program.isError || !program.data) {
    return (
      <Screen>
        <Banner message={errorMessage(program.error)} />
        <Button block variant="ghost" label={t('common.back')} onPress={() => router.back()} />
      </Screen>
    );
  }

  const item = program.data;

  return (
    <Screen>
      <HeroCard>
        <View style={styles.heroRow}>
          <View style={styles.heroText}>
            <Overline onDark>{TRAINING_GOAL_LABELS_FR[item.details.goal]}</Overline>
            <Title onDark>{item.title}</Title>
            <Body onDark>
              {t('training.weeksSummary', { count: item.details.weeks })} ·{' '}
              {t('training.daysPerWeek', {
                count: item.schedule.filter((day) => day !== null).length,
              })}
            </Body>
          </View>
          <Mascot pose="squat" size={88} tone="onDark" />
        </View>
      </HeroCard>

      <Card>
        <View style={styles.chips}>
          <Chip tone="dark" label={LEVEL_LABELS_FR[item.details.level]} />
          <Chip label={PLACE_LABELS_FR[item.details.place]} />
          <Chip
            tone="outline"
            label={t('training.minutes', { count: item.details.sessionMinutes })}
          />
          {item.isTemplate ? <Chip tone="outline" label={t('training.template')} /> : null}
        </View>
        {item.details.coachNote.length > 0 ? (
          <>
            <Overline>{t('training.coachNote')}</Overline>
            <Body>{item.details.coachNote}</Body>
          </>
        ) : null}
      </Card>

      <Planning program={item} />

      {item.sessions.map((session, index) => (
        <Card
          key={session.id}
          overline={t('training.session', { label: trainingSessionLabel(index) })}
          title={session.name}
        >
          <View style={styles.chips}>
            {session.targetMuscles.map((muscle) => (
              <Chip key={muscle} label={MUSCLE_LABELS_FR[muscle as Muscle]} />
            ))}
            <Chip
              tone="outline"
              label={t('training.minutes', { count: session.durationMinutes })}
            />
          </View>

          {session.warmup.length > 0 ? (
            <>
              <Overline>{t('training.warmup')}</Overline>
              <Body>{session.warmup}</Body>
            </>
          ) : null}

          <Heading>{t('training.exercises')}</Heading>
          {session.exercises.length === 0 ? (
            <Caption>{t('training.noExercise')}</Caption>
          ) : (
            session.exercises.map((line, lineIndex) => (
              <View key={line.id} style={styles.line}>
                <Body style={styles.lineName}>
                  {lineIndex + 1}. {line.exercise?.name ?? t('training.unknownExercise')}
                </Body>
                <Caption>
                  {t('training.setsAndReps', { sets: line.sets, reps: line.reps || '—' })}
                  {line.load ? ` · ${line.load}` : ''}
                  {line.restSeconds
                    ? ` · ${t('training.restSummary', { seconds: line.restSeconds })}`
                    : ''}
                  {line.tempo ? ` · ${t('training.tempo')} ${line.tempo}` : ''}
                </Caption>
                {line.notes.length > 0 ? <Caption>{line.notes}</Caption> : null}
              </View>
            ))
          )}

          {session.cooldown.length > 0 ? (
            <>
              <Overline>{t('training.cooldown')}</Overline>
              <Body>{session.cooldown}</Body>
            </>
          ) : null}
        </Card>
      ))}

      {removal.isError ? <Banner message={errorMessage(removal.error)} /> : null}
      {copy.isError ? <Banner message={errorMessage(copy.error)} /> : null}

      <Button
        block
        label={t('training.edit')}
        onPress={() => router.push(`/training/edit?id=${item.id}`)}
      />
      <Button
        block
        variant="secondary"
        label={t('training.exportPdf')}
        onPress={() => {
          void openProgramPdf('training', item.id);
        }}
      />
      <Button
        block
        variant="secondary"
        label={t('training.duplicate')}
        loading={copy.isPending}
        onPress={() => copy.mutate()}
      />
      <Button
        block
        variant="danger"
        label={t('training.delete')}
        loading={removal.isPending}
        onPress={() => removal.mutate()}
      />
      <Button block variant="ghost" label={t('common.back')} onPress={() => router.back()} />
    </Screen>
  );
}

function Planning({ program }: { program: Program }) {
  const { t } = useTranslation();

  return (
    <Card overline={t('training.planningSection')}>
      <View style={styles.planning}>
        {WEEK_DAYS.map((day) => {
          const index = program.schedule[day - 1] ?? null;
          const session = index === null ? null : program.sessions[index];

          return (
            <View key={day} style={styles.day}>
              <Overline>{WEEK_DAY_SHORT_FR[day]}</Overline>
              <View style={[styles.dayBox, session && styles.dayBoxActive]}>
                <Body style={session ? styles.dayLabelActive : styles.dayLabel}>
                  {session ? trainingSessionLabel(index!) : t('training.restShort')}
                </Body>
              </View>
              <Caption numberOfLines={2} style={styles.dayName}>
                {session ? session.name : t('training.rest')}
              </Caption>
            </View>
          );
        })}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  heroText: { flex: 1, gap: spacing.sm, minWidth: 180 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  planning: { flexDirection: 'row', gap: spacing.xs, flexWrap: 'wrap' },
  day: { alignItems: 'center', gap: spacing.xs, flexGrow: 1, flexBasis: 44 },
  dayBox: {
    minWidth: 44,
    minHeight: 44,
    alignSelf: 'stretch',
    borderRadius: radii.tile,
    borderWidth: 1.5,
    borderColor: colors.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayBoxActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  dayLabel: { color: colors.muted },
  dayLabelActive: { color: colors.onDark, fontWeight: '700' },
  dayName: { textAlign: 'center', fontSize: 11 },
  line: { gap: 2, paddingVertical: spacing.xs },
  lineName: { fontWeight: '700', color: colors.ink },
});
