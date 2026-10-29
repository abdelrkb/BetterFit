import { POSE_NAMES, poseLabel, Mascot } from '@betterfit/mascot';
import {
  CATEGORY_LABELS_FR,
  EQUIPMENT_LABELS_FR,
  LEVEL_LABELS_FR,
  MUSCLE_LABELS_FR,
  categorySchema,
  customExerciseSchema,
  equipmentSchema,
  levelSchema,
  muscleSchema,
  type CustomExerciseInput,
  type Muscle,
} from '@betterfit/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { createExercise, fetchExercise, updateExercise } from '@/lib/exercises';
import { errorMessage, fieldErrors } from '@/lib/errors';
import {
  Banner,
  Body,
  Button,
  Caption,
  Card,
  Chip,
  OptionGroup,
  Screen,
  TextField,
  Title,
  colors,
  radii,
  spacing,
} from '@/ui';

/**
 * Création et modification d'un exercice personnel.
 *
 * Le même écran sert aux deux : avec `?id=…` il charge l'exercice et
 * l'enregistre par-dessus. Un formulaire de moins à maintenir.
 */
/**
 * Enveloppe : en modification, on attend d'avoir l'exercice avant de monter le
 * formulaire. Les champs partent alors des bonnes valeurs, sans avoir à les
 * recopier dans un effet.
 */
export default function CustomExerciseScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();

  const existing = useQuery({
    queryKey: ['exercise', id],
    queryFn: () => fetchExercise(id!),
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

  const item = existing.data;

  return (
    <CustomExerciseForm
      exerciseId={id}
      initial={{
        name: item?.name ?? '',
        primaryMuscles: (item?.primaryMuscles ?? []) as Muscle[],
        secondaryMuscles: (item?.secondaryMuscles ?? []) as Muscle[],
        equipment: item?.equipment ?? 'body only',
        level: item?.level ?? 'beginner',
        category: item?.category ?? 'strength',
        instructions: item && item.instructions.length > 0 ? item.instructions : [''],
        mascotPose: item?.mascotPose ?? 'stand',
      }}
    />
  );
}

type InitialValues = {
  name: string;
  primaryMuscles: Muscle[];
  secondaryMuscles: Muscle[];
  equipment: CustomExerciseInput['equipment'];
  level: CustomExerciseInput['level'];
  category: CustomExerciseInput['category'];
  instructions: string[];
  mascotPose: string | null;
};

function CustomExerciseForm({
  exerciseId,
  initial,
}: {
  exerciseId: string | undefined;
  initial: InitialValues;
}) {
  const { t } = useTranslation();
  const router = useRouter();
  const queryClient = useQueryClient();
  const editing = Boolean(exerciseId);

  const [name, setName] = useState(initial.name);
  const [primaryMuscles, setPrimaryMuscles] = useState<Muscle[]>(initial.primaryMuscles);
  const [secondaryMuscles, setSecondaryMuscles] = useState<Muscle[]>(initial.secondaryMuscles);
  const [equipment, setEquipment] = useState(initial.equipment);
  const [level, setLevel] = useState(initial.level);
  const [category, setCategory] = useState(initial.category);
  const [steps, setSteps] = useState<string[]>(initial.instructions);
  const [mascotPose, setMascotPose] = useState<string | null>(initial.mascotPose);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);

  function collect() {
    return {
      name,
      primaryMuscles,
      secondaryMuscles,
      equipment,
      level,
      category,
      instructions: steps.map((step) => step.trim()).filter((step) => step.length > 0),
      mascotPose,
    };
  }

  const save = useMutation({
    mutationFn: async () => {
      const input = customExerciseSchema.parse(collect());

      return editing ? updateExercise(exerciseId!, input) : createExercise(input);
    },
    onSuccess: async (exercise) => {
      await queryClient.invalidateQueries({ queryKey: ['exercises'] });
      await queryClient.invalidateQueries({ queryKey: ['exercise', exercise.id] });
      router.replace(`/exercises/${exercise.id}`);
    },
    onError: (error) => {
      setServerError(errorMessage(error));
      setErrors(fieldErrors(error));
    },
  });

  function submit() {
    setServerError(null);
    setErrors({});

    const parsed = customExerciseSchema.safeParse(collect());

    if (!parsed.success) {
      // On montre l'erreur sur le champ fautif plutôt qu'un message général.
      setErrors(
        Object.fromEntries(
          parsed.error.issues.map((issue) => [String(issue.path[0] ?? 'name'), issue.message]),
        ),
      );
      return;
    }

    save.mutate();
  }

  return (
    <Screen>
      <Title>{editing ? t('exercises.editTitle') : t('exercises.createTitle')}</Title>
      <Body>{t('exercises.createSubtitle')}</Body>

      {serverError ? <Banner message={serverError} /> : null}

      <Card>
        <TextField
          label={t('exercises.nameLabel')}
          placeholder={t('exercises.namePlaceholder')}
          value={name}
          onChangeText={setName}
          error={errors.name}
        />
      </Card>

      <Card overline={t('exercises.musclesPrimary')}>
        <Caption>{t('exercises.musclesPrimaryHint')}</Caption>
        <MusclePicker selected={primaryMuscles} onToggle={setPrimaryMuscles} max={4} />
        {errors.primaryMuscles ? <Caption style={styles.error}>{errors.primaryMuscles}</Caption> : null}
      </Card>

      <Card overline={t('exercises.musclesSecondary')}>
        <MusclePicker selected={secondaryMuscles} onToggle={setSecondaryMuscles} max={6} />
      </Card>

      <Card>
        <OptionGroup
          layout="row"
          label={t('exercises.equipmentLabel')}
          value={equipment}
          onChange={setEquipment}
          options={equipmentSchema.options.map((value) => ({
            value,
            label: EQUIPMENT_LABELS_FR[value],
          }))}
        />
        <OptionGroup
          layout="row"
          label={t('exercises.levelLabel')}
          value={level}
          onChange={setLevel}
          options={levelSchema.options.map((value) => ({ value, label: LEVEL_LABELS_FR[value] }))}
        />
        <OptionGroup
          layout="row"
          label={t('exercises.categoryLabel')}
          value={category}
          onChange={setCategory}
          options={categorySchema.options.map((value) => ({
            value,
            label: CATEGORY_LABELS_FR[value],
          }))}
        />
      </Card>

      <Card overline={t('exercises.poseLabel')}>
        <Caption>{t('exercises.poseHint')}</Caption>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.poseRow}>
            {POSE_NAMES.map((pose) => (
              <Pressable
                key={pose}
                accessibilityRole="radio"
                accessibilityLabel={poseLabel(pose)}
                accessibilityState={{ selected: mascotPose === pose }}
                onPress={() => setMascotPose(pose)}
                style={[styles.poseCell, mascotPose === pose && styles.poseCellSelected]}
              >
                <Mascot pose={pose} size={64} />
                <Caption numberOfLines={1}>{poseLabel(pose)}</Caption>
              </Pressable>
            ))}
          </View>
        </ScrollView>
      </Card>

      <Card overline={t('exercises.instructions')}>
        <Caption>{t('exercises.instructionsHint')}</Caption>
        {steps.map((step, index) => (
          <TextField
            key={index}
            label={t('exercises.step', { number: index + 1 })}
            value={step}
            multiline
            onChangeText={(value) =>
              setSteps((current) => current.map((item, i) => (i === index ? value : item)))
            }
          />
        ))}
        <View style={styles.stepActions}>
          <Button
            variant="ghost"
            label={t('exercises.addStep')}
            onPress={() => setSteps((current) => [...current, ''])}
          />
          {steps.length > 1 ? (
            <Button
              variant="ghost"
              label={t('exercises.removeStep')}
              onPress={() => setSteps((current) => current.slice(0, -1))}
            />
          ) : null}
        </View>
      </Card>

      <Button
        block
        label={editing ? t('common.save') : t('exercises.create')}
        loading={save.isPending}
        onPress={submit}
      />
      <Button block variant="ghost" label={t('common.cancel')} onPress={() => router.back()} />
    </Screen>
  );
}

function MusclePicker({
  selected,
  onToggle,
  max,
}: {
  selected: Muscle[];
  onToggle: (value: Muscle[]) => void;
  max: number;
}) {
  return (
    <View style={styles.muscles}>
      {muscleSchema.options.map((muscle) => {
        const isSelected = selected.includes(muscle);

        return (
          <Pressable
            key={muscle}
            accessibilityRole="checkbox"
            accessibilityLabel={MUSCLE_LABELS_FR[muscle]}
            accessibilityState={{ checked: isSelected }}
            onPress={() =>
              onToggle(
                isSelected
                  ? selected.filter((item) => item !== muscle)
                  : selected.length < max
                    ? [...selected, muscle]
                    : selected,
              )
            }
          >
            <Chip label={MUSCLE_LABELS_FR[muscle]} tone={isSelected ? 'dark' : 'outline'} />
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  muscles: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  poseRow: { flexDirection: 'row', gap: spacing.sm },
  poseCell: {
    alignItems: 'center',
    gap: spacing.xs,
    padding: spacing.sm,
    borderRadius: radii.tile,
    borderWidth: 2,
    borderColor: 'transparent',
    width: 96,
  },
  poseCellSelected: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
  stepActions: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  error: { color: colors.danger },
});
