import { Mascot, isPoseName } from '@betterfit/mascot';
import {
  CATEGORY_LABELS_FR,
  EQUIPMENT_LABELS_FR,
  FORCE_LABELS_FR,
  LEVEL_LABELS_FR,
  MECHANIC_LABELS_FR,
  MUSCLE_LABELS_FR,
  type Exercise,
  type Muscle,
} from '@betterfit/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Image, StyleSheet, View } from 'react-native';
import { errorMessage } from '@/lib/errors';
import { deleteExercise, fetchExercise, imageUrl, saveTranslation } from '@/lib/exercises';
import { useSession } from '@/stores/session';
import {
  Banner,
  Body,
  Button,
  Caption,
  Card,
  Chip,
  Heading,
  Screen,
  TextField,
  Title,
  colors,
  radii,
  spacing,
} from '@/ui';

export default function ExerciseDetailScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const queryClient = useQueryClient();
  const canEditLibrary = useSession((state) => state.user?.canEditLibrary ?? false);

  const exercise = useQuery({
    queryKey: ['exercise', id],
    queryFn: () => fetchExercise(id),
    enabled: Boolean(id),
  });

  const removal = useMutation({
    mutationFn: () => deleteExercise(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['exercises'] });
      router.back();
    },
  });

  if (exercise.isPending) {
    return (
      <Screen>
        <ActivityIndicator color={colors.accent} />
      </Screen>
    );
  }

  if (exercise.isError || !exercise.data) {
    return (
      <Screen>
        <Banner message={errorMessage(exercise.error)} />
        <Button block variant="ghost" label={t('common.back')} onPress={() => router.back()} />
      </Screen>
    );
  }

  const item = exercise.data;
  const steps = item.translated ? item.instructions : item.instructionsEn;

  return (
    <Screen>
      <Title>{item.name}</Title>
      {item.nameEn && item.nameEn !== item.name ? <Caption>{item.nameEn}</Caption> : null}

      <Photos exercise={item} />

      <Card>
        <View style={styles.chips}>
          {item.primaryMuscles.map((muscle) => (
            <Chip key={muscle} tone="dark" label={MUSCLE_LABELS_FR[muscle as Muscle]} />
          ))}
          {item.secondaryMuscles.map((muscle) => (
            <Chip key={muscle} label={MUSCLE_LABELS_FR[muscle as Muscle]} />
          ))}
        </View>
        <View style={styles.chips}>
          <Chip tone="outline" label={EQUIPMENT_LABELS_FR[item.equipment]} />
          <Chip tone="outline" label={LEVEL_LABELS_FR[item.level]} />
          <Chip tone="outline" label={CATEGORY_LABELS_FR[item.category]} />
          {item.force ? <Chip tone="outline" label={FORCE_LABELS_FR[item.force]} /> : null}
          {item.mechanic ? <Chip tone="outline" label={MECHANIC_LABELS_FR[item.mechanic]} /> : null}
        </View>
      </Card>

      <Card overline={t('exercises.instructions')}>
        {steps.length === 0 ? (
          <Body>{t('exercises.noInstructions')}</Body>
        ) : (
          steps.map((step, index) => (
            <View key={index} style={styles.step}>
              <View style={styles.stepNumber}>
                <Caption style={styles.stepNumberText}>{index + 1}</Caption>
              </View>
              <Body style={styles.stepText}>{step}</Body>
            </View>
          ))
        )}

        {!item.translated && item.instructionsEn.length > 0 ? (
          <Banner tone="info" message={t('exercises.englishNotice')} />
        ) : null}
      </Card>

      {item.source === 'library' && canEditLibrary ? <TranslationCard exercise={item} /> : null}

      {item.source === 'custom' ? (
        <>
          <Button
            block
            variant="secondary"
            label={t('exercises.edit')}
            onPress={() => router.push(`/exercises/new?id=${item.id}`)}
          />
          <Button
            block
            variant="danger"
            label={t('exercises.delete')}
            loading={removal.isPending}
            onPress={() => removal.mutate()}
          />
          {removal.isError ? <Banner message={errorMessage(removal.error)} /> : null}
        </>
      ) : null}

      <Button block variant="ghost" label={t('common.back')} onPress={() => router.back()} />
    </Screen>
  );
}

function Photos({ exercise }: { exercise: Exercise }) {
  const { t } = useTranslation();
  const [failed, setFailed] = useState<Record<number, boolean>>({});
  const usable = exercise.images.filter((_, index) => !failed[index]);

  if (usable.length === 0) {
    const pose =
      exercise.mascotPose && isPoseName(exercise.mascotPose) ? exercise.mascotPose : 'stand';

    return (
      <Card tone="soft" style={styles.posterFallback}>
        <Mascot pose={pose} size={140} accessibilityLabel={exercise.name} />
      </Card>
    );
  }

  return (
    <View style={styles.photos}>
      {exercise.images.map((image, index) =>
        failed[index] ? null : (
          <View key={image} style={styles.photo}>
            <Image
              source={{ uri: imageUrl(image) }}
              style={styles.photoImage}
              resizeMode="cover"
              onError={() => setFailed((state) => ({ ...state, [index]: true }))}
              accessibilityLabel={t(index === 0 ? 'exercises.photoStart' : 'exercises.photoEnd', {
                name: exercise.name,
              })}
            />
            <Caption style={styles.photoCaption}>
              {t(index === 0 ? 'exercises.start' : 'exercises.end')}
            </Caption>
          </View>
        ),
      )}
    </View>
  );
}

/** Formulaire de traduction, visible seulement par un compte autorisé. */
function TranslationCard({ exercise }: { exercise: Exercise }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(exercise.name);
  const [steps, setSteps] = useState<string[]>(
    exercise.instructions.length > 0 ? exercise.instructions : exercise.instructionsEn,
  );

  const save = useMutation({
    mutationFn: () =>
      saveTranslation(exercise.id, {
        name: name.trim(),
        instructions: steps.map((step) => step.trim()).filter((step) => step.length > 0),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['exercise', exercise.id] });
      await queryClient.invalidateQueries({ queryKey: ['exercises'] });
      setOpen(false);
    },
  });

  if (!open) {
    return (
      <Card tone="soft">
        <Body>{t('exercises.translateHint')}</Body>
        <Button
          block
          variant="secondary"
          label={t('exercises.translateAction')}
          onPress={() => setOpen(true)}
        />
      </Card>
    );
  }

  return (
    <Card overline={t('exercises.translateOverline')} title={t('exercises.translateTitle')}>
      {save.isError ? <Banner message={errorMessage(save.error)} /> : null}

      <TextField label={t('exercises.translateName')} value={name} onChangeText={setName} />

      <Heading>{t('exercises.instructions')}</Heading>
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

      <View style={styles.translationActions}>
        <Button
          variant="ghost"
          label={t('exercises.addStep')}
          onPress={() => setSteps((current) => [...current, ''])}
        />
        {steps.length > 0 ? (
          <Button
            variant="ghost"
            label={t('exercises.removeStep')}
            onPress={() => setSteps((current) => current.slice(0, -1))}
          />
        ) : null}
      </View>

      <Button
        block
        label={t('common.save')}
        loading={save.isPending}
        onPress={() => save.mutate()}
      />
      <Button block variant="ghost" label={t('common.cancel')} onPress={() => setOpen(false)} />

      <Caption>{t('exercises.translateExportHint')}</Caption>
    </Card>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  photos: { flexDirection: 'row', gap: spacing.md, flexWrap: 'wrap' },
  photo: { flexGrow: 1, flexBasis: 150, gap: spacing.xs },
  photoImage: {
    width: '100%',
    aspectRatio: 4 / 3,
    borderRadius: radii.card,
    backgroundColor: colors.accentSoft,
  },
  photoCaption: { textAlign: 'center' },
  posterFallback: { alignItems: 'center' },
  step: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  stepNumber: {
    width: 24,
    height: 24,
    borderRadius: radii.pill,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumberText: { color: colors.accent, fontWeight: '700' },
  stepText: { flex: 1 },
  translationActions: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
});
