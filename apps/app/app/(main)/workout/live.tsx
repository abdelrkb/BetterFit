import { Mascot, isPoseName } from '@betterfit/mascot';
import type { PersonalRecord } from '@betterfit/shared';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useKeepAwake } from 'expo-keep-awake';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { ExercisePicker } from '@/components/ExercisePicker';
import { RestTimer, formatSeconds } from '@/components/RestTimer';
import { errorMessage } from '@/lib/errors';
import { imageUrl } from '@/lib/exercises';
import { buildLiveExercise } from '@/lib/start-workout';
import { liveSummary, useWorkout, type LiveExercise } from '@/stores/workout';
import {
  Banner,
  Body,
  Button,
  Caption,
  Card,
  Chip,
  Heading,
  HeroCard,
  Metric,
  Overline,
  Screen,
  TextField,
  Title,
  colors,
  radii,
  spacing,
} from '@/ui';

/**
 * La séance guidée : un exercice à la fois.
 *
 * Elle fonctionne entièrement hors ligne — tout est écrit dans le stockage de
 * l'appareil — et garde l'écran allumé, parce qu'on repose son téléphone entre
 * deux séries.
 */
export default function LiveWorkoutScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  useKeepAwake();

  const current = useWorkout((state) => state.current);
  const updateSet = useWorkout((state) => state.updateSet);
  const addSet = useWorkout((state) => state.addSet);
  const removeSet = useWorkout((state) => state.removeSet);
  const addExercise = useWorkout((state) => state.addExercise);
  const goTo = useWorkout((state) => state.goTo);
  const cancel = useWorkout((state) => state.cancel);
  const setNotes = useWorkout((state) => state.setNotes);
  const finishWorkout = useWorkout((state) => state.finish);
  const queryClient = useQueryClient();

  /** Instant de la dernière série validée : c'est lui qui lance le repos. */
  const [restStartedAt, setRestStartedAt] = useState<number | null>(null);

  /**
   * Les trois temps de la séance tiennent dans **un seul écran**.
   *
   * Changer de route téléchargerait un nouveau morceau de code : impossible
   * en mode avion, précisément quand on en a besoin. Tout ce dont la séance a
   * besoin est donc déjà chargé.
   */
  const [phase, setPhase] = useState<'sets' | 'finish' | 'done'>('sets');
  /** Ouvert quand on cherche un exercice à ajouter en cours de séance. */
  const [picking, setPicking] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [result, setResult] = useState<{ queued: boolean; records: PersonalRecord[] } | null>(null);

  if (phase === 'done' && result) {
    return <Result queued={result.queued} records={result.records} />;
  }

  if (!current) {
    return (
      <Screen>
        <Card tone="soft" style={styles.empty}>
          <Mascot pose="stand" size={110} />
          <Heading>{t('workout.noneTitle')}</Heading>
          <Body style={styles.center}>{t('workout.noneBody')}</Body>
        </Card>
        <Button
          block
          variant="ghost"
          label={t('common.back')}
          onPress={() => router.replace('/')}
        />
      </Screen>
    );
  }

  if (picking) {
    return (
      <ExercisePicker
        onCancel={() => setPicking(false)}
        onPick={async (picked) => {
          setAddError(null);

          try {
            await addExercise(await buildLiveExercise(picked));
            setPicking(false);
          } catch (caught) {
            setAddError(errorMessage(caught));
            setPicking(false);
          }
        }}
      />
    );
  }

  const index = current.currentIndex;
  const exercise = current.exercises[index];

  /*
   * Une séance libre commence vide : on cherche le premier exercice au
   * moment de le faire. Le minuteur, lui, tourne déjà.
   */
  if (!exercise) {
    return (
      <Screen>
        <Overline>{current.sessionName}</Overline>
        <Title>{t('workout.freeEmptyTitle')}</Title>

        {addError ? <Banner message={addError} /> : null}

        <Card tone="soft" style={styles.empty}>
          <Mascot pose="stand" size={110} />
          <Body style={styles.center}>{t('workout.freeEmptyBody')}</Body>
        </Card>

        <Button block label={t('workout.addExercise')} onPress={() => setPicking(true)} />
        <Button block variant="danger" label={t('workout.abandon')} onPress={() => void cancel()} />
      </Screen>
    );
  }

  const summary = liveSummary(current);
  const isLast = index === current.exercises.length - 1;

  if (phase === 'finish') {
    return (
      <FinishStep
        onBack={() => setPhase('sets')}
        onSaved={(outcome) => {
          setResult(outcome);
          setPhase('done');
          void queryClient.invalidateQueries({ queryKey: ['workouts'] });
        }}
        setNotes={setNotes}
        finishWorkout={finishWorkout}
      />
    );
  }

  return (
    <Screen>
      <View style={styles.headerRow}>
        <View style={styles.headerText}>
          <Overline>{current.sessionName}</Overline>
          <Title>{exercise.name}</Title>
          <Caption>
            {t('workout.exerciseOf', { current: index + 1, total: current.exercises.length })}
          </Caption>
        </View>
        <Photo exercise={exercise} />
      </View>

      {addError ? <Banner message={addError} /> : null}

      <Card>
        <View style={styles.chips}>
          <Chip tone="dark" label={t('workout.plannedSets', { count: exercise.plannedSets })} />
          {exercise.reps ? <Chip label={exercise.reps} /> : null}
          {exercise.load ? <Chip tone="outline" label={exercise.load} /> : null}
          {exercise.tempo ? (
            <Chip tone="outline" label={`${t('training.tempo')} ${exercise.tempo}`} />
          ) : null}
        </View>
        {exercise.notes.length > 0 ? <Body>{exercise.notes}</Body> : null}
        {exercise.lastSets.length > 0 ? (
          <Caption>
            {t('workout.lastTime', {
              detail: exercise.lastSets
                .map((set) => `${set.weightKg ?? '—'} kg × ${set.reps ?? '—'}`)
                .join(', '),
            })}
          </Caption>
        ) : (
          <Caption>{t('workout.firstTime')}</Caption>
        )}
      </Card>

      <Card overline={t('workout.sets')}>
        {exercise.sets.map((set) => (
          <View key={set.setIndex} style={[styles.set, set.done && styles.setDone]}>
            <View style={styles.setNumber}>
              <Body style={styles.setNumberText}>{set.setIndex}</Body>
            </View>

            <TextField
              style={styles.setField}
              label={t('workout.weight')}
              suffix="kg"
              inputMode="decimal"
              value={set.weightKg === null ? '' : String(set.weightKg).replace('.', ',')}
              onChangeText={(value) =>
                void updateSet(index, set.setIndex, {
                  weightKg: value.trim() === '' ? null : Number(value.replace(',', '.')) || 0,
                })
              }
            />

            <TextField
              style={styles.setField}
              label={t('workout.reps')}
              inputMode="numeric"
              value={set.reps === null ? '' : String(set.reps)}
              onChangeText={(value) =>
                void updateSet(index, set.setIndex, {
                  reps: value.trim() === '' ? null : Number(value.replace(/\D/g, '')) || 0,
                })
              }
            />

            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: set.done }}
              accessibilityLabel={t('workout.validateSet', { number: set.setIndex })}
              onPress={() => {
                const done = !set.done;
                void updateSet(index, set.setIndex, { done });
                // Valider lance le repos ; dévalider ne le relance pas.
                if (done) setRestStartedAt(Date.now());
              }}
              style={[styles.check, set.done && styles.checkDone]}
            >
              <Body style={set.done ? styles.checkMarkDone : styles.checkMark}>
                {set.done ? '✓' : '○'}
              </Body>
            </Pressable>
          </View>
        ))}

        <View style={styles.setActions}>
          <Button variant="ghost" label={t('workout.addSet')} onPress={() => void addSet(index)} />
          {exercise.sets.length > 1 ? (
            <Button
              variant="ghost"
              label={t('workout.removeSet')}
              onPress={() => void removeSet(index)}
            />
          ) : null}
        </View>
      </Card>

      <Card overline={t('workout.rest')}>
        <RestTimer seconds={exercise.restSeconds} startedAt={restStartedAt} />
      </Card>

      <Card tone="soft">
        <Caption>
          {t('workout.runningTotals', {
            sets: summary.completedSets,
            volume: Math.round(summary.volumeKg),
          })}
        </Caption>
      </Card>

      <View style={styles.navigation}>
        <Button
          variant="ghost"
          label={t('workout.previousExercise')}
          disabled={index === 0}
          onPress={() => void goTo(index - 1)}
        />
        {isLast ? (
          <Button
            style={styles.navigationMain}
            label={t('workout.finish')}
            onPress={() => setPhase('finish')}
          />
        ) : (
          <Button
            style={styles.navigationMain}
            label={t('workout.nextExercise')}
            onPress={() => void goTo(index + 1)}
          />
        )}
      </View>

      {/* Ajouter un exercice marche aussi pendant une séance du programme :
          la machine qu'on voulait est parfois prise. */}
      <Button
        block
        variant="secondary"
        label={t('workout.addExercise')}
        onPress={() => setPicking(true)}
      />

      <Button
        block
        variant="ghost"
        label={t('workout.finishNow')}
        onPress={() => setPhase('finish')}
      />
      <Button
        block
        variant="ghost"
        label={t('workout.abandon')}
        onPress={() => {
          void cancel();
          router.replace('/');
        }}
      />
    </Screen>
  );
}

/** Le bilan, avant d'enregistrer : ce qu'on a fait, et un mot. */
function FinishStep({
  onBack,
  onSaved,
  setNotes,
  finishWorkout,
}: {
  onBack: () => void;
  onSaved: (outcome: { queued: boolean; records: PersonalRecord[] }) => void;
  setNotes: (notes: string) => Promise<void>;
  finishWorkout: () => Promise<{ queued: boolean; records: PersonalRecord[] }>;
}) {
  const { t } = useTranslation();
  const current = useWorkout((state) => state.current);
  const [saving, setSaving] = useState(false);
  /** Figé à l'ouverture : la durée ne doit pas défiler pendant qu'on écrit. */
  const [closedAt] = useState(() => Date.now());

  if (!current) {
    return (
      <Screen>
        <Banner message={t('workout.brokenSession')} />
      </Screen>
    );
  }

  const summary = liveSummary(current);
  const durationSeconds = Math.max(
    0,
    Math.round((closedAt - new Date(current.startedAt).getTime()) / 1000),
  );

  return (
    <Screen>
      <Title>{t('workout.finishTitle')}</Title>

      <Card>
        <View style={styles.metrics}>
          <View style={styles.metric}>
            <Metric>{formatSeconds(durationSeconds)}</Metric>
            <Caption>{t('workout.duration')}</Caption>
          </View>
          <View style={styles.metric}>
            <Metric>{summary.completedSets}</Metric>
            <Caption>{t('workout.setsDone')}</Caption>
          </View>
          <View style={styles.metric}>
            <Metric>{Math.round(summary.volumeKg)}</Metric>
            <Caption>{t('workout.volume')}</Caption>
          </View>
        </View>
      </Card>

      <Card overline={t('workout.notesLabel')}>
        <TextField
          label={t('workout.notesLabel')}
          hint={t('workout.notesHint')}
          multiline
          value={current.notes}
          onChangeText={(value) => void setNotes(value)}
        />
      </Card>

      <Button
        block
        label={t('workout.save')}
        loading={saving}
        onPress={async () => {
          setSaving(true);
          onSaved(await finishWorkout());
          setSaving(false);
        }}
      />
      <Button block variant="ghost" label={t('workout.backToSession')} onPress={onBack} />
    </Screen>
  );
}

/** Après l'enregistrement : les records, et où aller ensuite. */
function Result({ queued, records }: { queued: boolean; records: PersonalRecord[] }) {
  const { t } = useTranslation();
  const router = useRouter();

  return (
    <Screen>
      <HeroCard>
        <View style={styles.headerRow}>
          <View style={styles.headerText}>
            <Overline onDark>{t('workout.savedOverline')}</Overline>
            <Title onDark>{t('workout.savedTitle')}</Title>
            <Body onDark>{t(queued ? 'workout.savedOffline' : 'workout.savedOnline')}</Body>
          </View>
          <Mascot pose="flex" size={96} tone="onDark" />
        </View>
      </HeroCard>

      {records.length > 0 ? (
        <Card overline={t('workout.recordsOverline')} title={t('workout.recordsTitle')}>
          {records.map((record, index) => (
            <View key={`${record.exerciseId}-${record.kind}-${index}`} style={styles.record}>
              <Heading>{record.exerciseName}</Heading>
              <Body>
                {t(record.kind === 'weight' ? 'workout.recordWeight' : 'workout.recordOneRepMax', {
                  value: record.value,
                })}
              </Body>
              {record.previous !== null ? (
                <Caption>{t('workout.recordPrevious', { value: record.previous })}</Caption>
              ) : (
                <Caption>{t('workout.recordFirst')}</Caption>
              )}
            </View>
          ))}
        </Card>
      ) : null}

      <Button block label={t('workout.backHome')} onPress={() => router.replace('/')} />
      <Button
        block
        variant="secondary"
        label={t('workout.seeHistory')}
        onPress={() => router.replace('/workout/history')}
      />
    </Screen>
  );
}

function Photo({ exercise }: { exercise: LiveExercise }) {
  const [failed, setFailed] = useState(false);

  if (!exercise.imageUrl || failed) {
    const pose =
      exercise.mascotPose && isPoseName(exercise.mascotPose) ? exercise.mascotPose : 'stand';

    return <Mascot pose={pose} size={96} accessibilityLabel={exercise.name} />;
  }

  return (
    <Image
      source={{ uri: imageUrl(exercise.imageUrl) }}
      style={styles.photo}
      resizeMode="cover"
      onError={() => setFailed(true)}
      accessibilityLabel={exercise.name}
    />
  );
}

export { formatSeconds };

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
  headerText: { flex: 1, gap: spacing.xs, minWidth: 160 },
  photo: { width: 108, height: 108, borderRadius: radii.card, backgroundColor: colors.accentSoft },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  set: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: radii.tile,
    backgroundColor: colors.paper,
  },
  setDone: { backgroundColor: '#E8F5EE' },
  setNumber: {
    width: 32,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  setNumberText: { fontWeight: '700', color: colors.muted },
  setField: { flex: 1, minWidth: 80 },
  check: {
    width: 48,
    height: 48,
    borderRadius: radii.tile,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accentSoft,
  },
  checkDone: { backgroundColor: colors.success },
  checkMark: { color: colors.accent, fontWeight: '700' },
  checkMarkDone: { color: colors.onDark, fontWeight: '700' },
  setActions: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  navigation: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  navigationMain: { flex: 1 },
  empty: { alignItems: 'center', gap: spacing.sm },
  center: { textAlign: 'center' },
  metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg },
  metric: { gap: spacing.xs, minWidth: 90 },
  record: {
    gap: 2,
    paddingVertical: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.cardBorder,
  },
});
