import {
  LEVEL_LABELS_FR,
  MUSCLE_LABELS_FR,
  PLACE_LABELS_FR,
  TRAINING_GOAL_LABELS_FR,
  WEEK_DAYS,
  WEEK_DAY_SHORT_FR,
  levelSchema,
  muscleSchema,
  placeSchema,
  programInputSchema,
  trainingGoalSchema,
  trainingSessionLabel,
  type Muscle,
} from '@betterfit/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';
import { ExercisePicker } from '@/components/ExercisePicker';
import { errorMessage } from '@/lib/errors';
import {
  draftFromProgram,
  emptyDraft,
  emptySession,
  move,
  scheduleAfterMove,
  scheduleAfterRemoval,
  toInput,
  type Draft,
  type DraftSession,
} from '@/lib/program-draft';
import { createProgram, fetchProgram, saveProgram } from '@/lib/programs';
import {
  Banner,
  Body,
  Button,
  Caption,
  Card,
  Checkbox,
  Chip,
  Heading,
  OptionGroup,
  Overline,
  Screen,
  TextField,
  Title,
  colors,
  radii,
  spacing,
} from '@/ui';

/**
 * L'éditeur de programme.
 *
 * Il travaille sur un brouillon en mémoire et n'enregistre qu'au moment du
 * clic : on peut réordonner, supprimer, revenir en arrière sans qu'un appel
 * réseau parte à chaque geste.
 */
export default function ProgramEditorScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();

  const existing = useQuery({
    queryKey: ['program', id],
    queryFn: () => fetchProgram(id!),
    enabled: Boolean(id),
  });

  if (id && existing.isPending) {
    return (
      <Screen>
        <Body>{t('common.loading')}</Body>
      </Screen>
    );
  }

  if (id && (existing.isError || !existing.data)) {
    return (
      <Screen>
        <Banner message={errorMessage(existing.error)} />
        <Button block variant="ghost" label={t('common.back')} onPress={() => router.back()} />
      </Screen>
    );
  }

  return (
    <Editor
      programId={id}
      initial={existing.data ? draftFromProgram(existing.data) : emptyDraft()}
    />
  );
}

function Editor({ programId, initial }: { programId?: string; initial: Draft }) {
  const { t } = useTranslation();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [draft, setDraft] = useState<Draft>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [pickerFor, setPickerFor] = useState<number | null>(null);

  function patch(changes: Partial<Draft>) {
    setDraft((current) => ({ ...current, ...changes }));
  }

  function patchSession(index: number, changes: Partial<DraftSession>) {
    setDraft((current) => ({
      ...current,
      sessions: current.sessions.map((session, i) =>
        i === index ? { ...session, ...changes } : session,
      ),
    }));
  }

  const save = useMutation({
    mutationFn: async () => {
      const input = programInputSchema.parse(toInput(draft));

      return programId ? saveProgram(programId, input) : createProgram(input);
    },
    onSuccess: async (program) => {
      await queryClient.invalidateQueries({ queryKey: ['programs'] });
      await queryClient.invalidateQueries({ queryKey: ['program', program.id] });
      router.replace(`/training/${program.id}`);
    },
    onError: (error) => setServerError(errorMessage(error)),
  });

  function submit() {
    setServerError(null);
    setErrors({});

    const parsed = programInputSchema.safeParse(toInput(draft));

    if (!parsed.success) {
      setErrors(
        Object.fromEntries(
          parsed.error.issues.map((issue) => [issue.path.join('.') || 'title', issue.message]),
        ),
      );
      return;
    }

    save.mutate();
  }

  if (pickerFor !== null) {
    return (
      <ExercisePicker
        onCancel={() => setPickerFor(null)}
        onPick={(exercise) => {
          patchSession(pickerFor, {
            exercises: [
              ...draft.sessions[pickerFor]!.exercises,
              {
                exerciseId: exercise.id,
                exercise,
                sets: 3,
                reps: '8-12',
                load: '',
                restSeconds: 90,
                tempo: '',
                notes: '',
              },
            ],
          });
          setPickerFor(null);
        }}
      />
    );
  }

  return (
    <Screen>
      <Title>{programId ? t('training.editTitle') : t('training.createTitle')}</Title>

      {serverError ? <Banner message={serverError} /> : null}
      {errors.sessions ? <Banner message={errors.sessions} /> : null}

      <Card overline={t('training.infoSection')}>
        <TextField
          label={t('training.titleLabel')}
          placeholder={t('training.titlePlaceholder')}
          value={draft.title}
          onChangeText={(value) => patch({ title: value })}
          error={errors.title}
        />

        <OptionGroup
          label={t('training.goalLabel')}
          value={draft.details.goal}
          onChange={(goal) => patch({ details: { ...draft.details, goal } })}
          options={trainingGoalSchema.options.map((value) => ({
            value,
            label: TRAINING_GOAL_LABELS_FR[value],
          }))}
        />

        <OptionGroup
          layout="row"
          label={t('training.levelLabel')}
          value={draft.details.level}
          onChange={(level) => patch({ details: { ...draft.details, level } })}
          options={levelSchema.options.map((value) => ({ value, label: LEVEL_LABELS_FR[value] }))}
        />

        <OptionGroup
          layout="row"
          label={t('training.placeLabel')}
          value={draft.details.place}
          onChange={(place) => patch({ details: { ...draft.details, place } })}
          options={placeSchema.options.map((value) => ({ value, label: PLACE_LABELS_FR[value] }))}
        />

        <View style={styles.pair}>
          <TextField
            style={styles.pairItem}
            label={t('training.sessionMinutes')}
            suffix="min"
            inputMode="numeric"
            value={String(draft.details.sessionMinutes)}
            onChangeText={(value) =>
              patch({
                details: { ...draft.details, sessionMinutes: Number(value.replace(/\D/g, '')) || 0 },
              })
            }
          />
          <TextField
            style={styles.pairItem}
            label={t('training.weeks')}
            suffix={t('training.weeksUnit')}
            inputMode="numeric"
            value={String(draft.details.weeks)}
            onChangeText={(value) =>
              patch({ details: { ...draft.details, weeks: Number(value.replace(/\D/g, '')) || 0 } })
            }
          />
        </View>

        <TextField
          label={t('training.coachNote')}
          hint={t('training.coachNoteHint')}
          multiline
          value={draft.details.coachNote}
          onChangeText={(value) => patch({ details: { ...draft.details, coachNote: value } })}
        />

        <Checkbox
          checked={draft.isTemplate}
          onChange={(isTemplate) => patch({ isTemplate })}
          label={<Body>{t('training.isTemplate')}</Body>}
        />
      </Card>

      <Card overline={t('training.planningSection')}>
        <Caption>{t('training.planningHint')}</Caption>
        <View style={styles.planning}>
          {WEEK_DAYS.map((day) => {
            const index = day - 1;
            const value = draft.schedule[index] ?? null;

            return (
              <View key={day} style={styles.day}>
                <Overline>{WEEK_DAY_SHORT_FR[day]}</Overline>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('training.dayAction', {
                    day: WEEK_DAY_SHORT_FR[day],
                    session: value === null ? t('training.rest') : trainingSessionLabel(value),
                  })}
                  onPress={() => {
                    // Un appui fait défiler : repos → A → B → … → repos.
                    const next =
                      value === null
                        ? 0
                        : value + 1 >= draft.sessions.length
                          ? null
                          : value + 1;

                    patch({
                      schedule: draft.schedule.map((item, i) => (i === index ? next : item)),
                    });
                  }}
                  style={[styles.dayButton, value !== null && styles.dayButtonActive]}
                >
                  <Body style={value !== null ? styles.dayLabelActive : styles.dayLabel}>
                    {value === null ? t('training.restShort') : trainingSessionLabel(value)}
                  </Body>
                </Pressable>
              </View>
            );
          })}
        </View>
      </Card>

      {draft.sessions.map((session, index) => (
        <SessionCard
          key={index}
          index={index}
          session={session}
          total={draft.sessions.length}
          onChange={(changes) => patchSession(index, changes)}
          onAddExercise={() => setPickerFor(index)}
          onMove={(direction) => {
            const to = index + direction;
            if (to < 0 || to >= draft.sessions.length) return;

            patch({
              sessions: move(draft.sessions, index, direction),
              schedule: scheduleAfterMove(draft.schedule, index, to),
            });
          }}
          onRemove={() =>
            patch({
              sessions: draft.sessions.filter((_, i) => i !== index),
              schedule: scheduleAfterRemoval(draft.schedule, index),
            })
          }
        />
      ))}

      <Button
        block
        variant="secondary"
        label={t('training.addSession')}
        onPress={() =>
          patch({
            sessions: [
              ...draft.sessions,
              emptySession(
                t('training.newSessionName', {
                  label: trainingSessionLabel(draft.sessions.length),
                }),
              ),
            ],
          })
        }
      />

      <Button
        block
        label={t('common.save')}
        loading={save.isPending}
        onPress={submit}
      />
      <Button block variant="ghost" label={t('common.cancel')} onPress={() => router.back()} />
    </Screen>
  );
}

function SessionCard({
  index,
  session,
  total,
  onChange,
  onAddExercise,
  onMove,
  onRemove,
}: {
  index: number;
  session: DraftSession;
  total: number;
  onChange: (changes: Partial<DraftSession>) => void;
  onAddExercise: () => void;
  onMove: (direction: -1 | 1) => void;
  onRemove: () => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(index === 0);

  return (
    <Card
      overline={t('training.session', { label: trainingSessionLabel(index) })}
      title={session.name || t('training.untitledSession')}
      trailing={
        <View style={styles.sessionActions}>
          <SmallButton
            label="↑"
            accessibilityLabel={t('training.moveUp')}
            disabled={index === 0}
            onPress={() => onMove(-1)}
          />
          <SmallButton
            label="↓"
            accessibilityLabel={t('training.moveDown')}
            disabled={index === total - 1}
            onPress={() => onMove(1)}
          />
        </View>
      }
    >
      <Button
        variant="ghost"
        label={open ? t('training.collapse') : t('training.expand')}
        onPress={() => setOpen((value) => !value)}
      />

      {open ? (
        <>
          <TextField
            label={t('training.sessionName')}
            value={session.name}
            onChangeText={(name) => onChange({ name })}
          />

          <Overline>{t('training.targetMuscles')}</Overline>
          <View style={styles.muscles}>
            {muscleSchema.options.map((muscle) => {
              const selected = session.targetMuscles.includes(muscle);

              return (
                <Pressable
                  key={muscle}
                  accessibilityRole="checkbox"
                  accessibilityLabel={MUSCLE_LABELS_FR[muscle]}
                  accessibilityState={{ checked: selected }}
                  onPress={() =>
                    onChange({
                      targetMuscles: selected
                        ? session.targetMuscles.filter((item) => item !== muscle)
                        : [...session.targetMuscles, muscle as Muscle].slice(0, 8),
                    })
                  }
                >
                  <Chip label={MUSCLE_LABELS_FR[muscle]} tone={selected ? 'dark' : 'outline'} />
                </Pressable>
              );
            })}
          </View>

          <TextField
            label={t('training.duration')}
            suffix="min"
            inputMode="numeric"
            value={String(session.durationMinutes)}
            onChangeText={(value) =>
              onChange({ durationMinutes: Number(value.replace(/\D/g, '')) || 0 })
            }
          />

          <TextField
            label={t('training.warmup')}
            multiline
            value={session.warmup}
            onChangeText={(warmup) => onChange({ warmup })}
          />
          <TextField
            label={t('training.cooldown')}
            multiline
            value={session.cooldown}
            onChangeText={(cooldown) => onChange({ cooldown })}
          />

          <Heading>{t('training.exercises')}</Heading>

          {session.exercises.length === 0 ? (
            <Caption>{t('training.noExercise')}</Caption>
          ) : (
            session.exercises.map((line, lineIndex) => (
              <View key={lineIndex} style={styles.line}>
                <View style={styles.lineHeader}>
                  <Body style={styles.lineName}>
                    {line.exercise?.name ?? t('training.unknownExercise')}
                  </Body>
                  <View style={styles.sessionActions}>
                    <SmallButton
                      label="↑"
                      accessibilityLabel={t('training.moveUp')}
                      disabled={lineIndex === 0}
                      onPress={() =>
                        onChange({ exercises: move(session.exercises, lineIndex, -1) })
                      }
                    />
                    <SmallButton
                      label="↓"
                      accessibilityLabel={t('training.moveDown')}
                      disabled={lineIndex === session.exercises.length - 1}
                      onPress={() => onChange({ exercises: move(session.exercises, lineIndex, 1) })}
                    />
                    <SmallButton
                      label="×"
                      accessibilityLabel={t('training.removeExercise')}
                      onPress={() =>
                        onChange({
                          exercises: session.exercises.filter((_, i) => i !== lineIndex),
                        })
                      }
                    />
                  </View>
                </View>

                <View style={styles.pair}>
                  <TextField
                    style={styles.pairItem}
                    label={t('training.sets')}
                    inputMode="numeric"
                    value={String(line.sets)}
                    onChangeText={(value) =>
                      onChange({
                        exercises: session.exercises.map((item, i) =>
                          i === lineIndex
                            ? { ...item, sets: Number(value.replace(/\D/g, '')) || 0 }
                            : item,
                        ),
                      })
                    }
                  />
                  <TextField
                    style={styles.pairItem}
                    label={t('training.reps')}
                    hint={t('training.repsHint')}
                    value={line.reps}
                    onChangeText={(value) =>
                      onChange({
                        exercises: session.exercises.map((item, i) =>
                          i === lineIndex ? { ...item, reps: value } : item,
                        ),
                      })
                    }
                  />
                </View>

                <View style={styles.pair}>
                  <TextField
                    style={styles.pairItem}
                    label={t('training.load')}
                    value={line.load}
                    onChangeText={(value) =>
                      onChange({
                        exercises: session.exercises.map((item, i) =>
                          i === lineIndex ? { ...item, load: value } : item,
                        ),
                      })
                    }
                  />
                  <TextField
                    style={styles.pairItem}
                    label={t('training.rest')}
                    suffix="s"
                    inputMode="numeric"
                    value={String(line.restSeconds)}
                    onChangeText={(value) =>
                      onChange({
                        exercises: session.exercises.map((item, i) =>
                          i === lineIndex
                            ? { ...item, restSeconds: Number(value.replace(/\D/g, '')) || 0 }
                            : item,
                        ),
                      })
                    }
                  />
                </View>

                <View style={styles.pair}>
                  <TextField
                    style={styles.pairItem}
                    label={t('training.tempo')}
                    hint={t('training.tempoHint')}
                    value={line.tempo}
                    onChangeText={(value) =>
                      onChange({
                        exercises: session.exercises.map((item, i) =>
                          i === lineIndex ? { ...item, tempo: value } : item,
                        ),
                      })
                    }
                  />
                  <TextField
                    style={styles.pairItem}
                    label={t('training.lineNotes')}
                    value={line.notes}
                    onChangeText={(value) =>
                      onChange({
                        exercises: session.exercises.map((item, i) =>
                          i === lineIndex ? { ...item, notes: value } : item,
                        ),
                      })
                    }
                  />
                </View>
              </View>
            ))
          )}

          <Button
            block
            variant="secondary"
            label={t('training.addExercise')}
            onPress={onAddExercise}
          />

          {total > 1 ? (
            <Button
              block
              variant="ghost"
              label={t('training.removeSession')}
              onPress={onRemove}
            />
          ) : null}
        </>
      ) : (
        <Caption>
          {t('training.exerciseCount', { count: session.exercises.length })} ·{' '}
          {t('training.minutes', { count: session.durationMinutes })}
        </Caption>
      )}
    </Card>
  );
}

function SmallButton({
  label,
  accessibilityLabel,
  onPress,
  disabled,
}: {
  label: string;
  accessibilityLabel: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[styles.smallButton, disabled && styles.smallButtonDisabled]}
    >
      <Body style={styles.smallButtonLabel}>{label}</Body>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pair: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  pairItem: { flexGrow: 1, flexBasis: 130 },
  planning: { flexDirection: 'row', gap: spacing.xs, flexWrap: 'wrap' },
  day: { alignItems: 'center', gap: spacing.xs, flexGrow: 1, flexBasis: 44 },
  dayButton: {
    minWidth: 44,
    minHeight: 44,
    borderRadius: radii.tile,
    borderWidth: 1.5,
    borderColor: colors.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'stretch',
  },
  dayButtonActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  dayLabel: { color: colors.muted },
  dayLabelActive: { color: colors.onDark, fontWeight: '700' },
  sessionActions: { flexDirection: 'row', gap: spacing.xs },
  smallButton: {
    width: 44,
    height: 44,
    borderRadius: radii.tile,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  smallButtonDisabled: { opacity: 0.35 },
  smallButtonLabel: { color: colors.accent, fontWeight: '700' },
  muscles: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  line: {
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radii.tile,
    backgroundColor: colors.paper,
  },
  lineHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  lineName: { flex: 1, fontWeight: '700', color: colors.ink },
});
