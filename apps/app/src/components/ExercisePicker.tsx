import {
  EQUIPMENT_LABELS_FR,
  MUSCLE_GROUP_LABELS_FR,
  MUSCLE_GROUP_ORDER,
  MUSCLE_LABELS_FR,
  type ExerciseSummary,
  type Muscle,
  type MuscleGroup,
} from '@betterfit/shared';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Image, Pressable, StyleSheet, View } from 'react-native';
import { errorMessage } from '@/lib/errors';
import { imageUrl, searchExercises } from '@/lib/exercises';
import {
  Banner,
  Body,
  Button,
  Caption,
  Card,
  FilterRow,
  Screen,
  TextField,
  Title,
  colors,
  radii,
  spacing,
} from '@/ui';

/**
 * Choix d'un exercice dans la bibliothèque.
 *
 * Présenté comme un écran plein plutôt qu'une fenêtre : sur téléphone, une
 * fenêtre avec une recherche et une liste est inutilisable.
 */
export function ExercisePicker({
  onPick,
  onCancel,
}: {
  onPick: (exercise: ExerciseSummary) => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [rawQuery, setRawQuery] = useState('');
  const [query, setQuery] = useState('');
  const [muscleGroup, setMuscleGroup] = useState<MuscleGroup | undefined>();

  useEffect(() => {
    const timer = setTimeout(() => setQuery(rawQuery), 300);
    return () => clearTimeout(timer);
  }, [rawQuery]);

  const results = useQuery({
    queryKey: ['exercises', 'picker', { query, muscleGroup }],
    queryFn: () => searchExercises({ q: query || undefined, muscleGroup }),
    placeholderData: keepPreviousData,
  });

  const muscleOptions = useMemo(
    () => MUSCLE_GROUP_ORDER.map((group) => ({ value: group, label: MUSCLE_GROUP_LABELS_FR[group] })),
    [],
  );

  return (
    <Screen>
      <Title>{t('training.pickExercise')}</Title>

      <TextField
        label={t('exercises.searchLabel')}
        placeholder={t('exercises.searchPlaceholder')}
        value={rawQuery}
        onChangeText={setRawQuery}
        autoCapitalize="none"
        inputMode="search"
      />

      <FilterRow
        accessibilityLabel={t('exercises.filterMuscle')}
        allLabel={t('exercises.allMuscles')}
        options={muscleOptions}
        value={muscleGroup}
        onChange={setMuscleGroup}
      />

      <Button block variant="ghost" label={t('common.cancel')} onPress={onCancel} />

      {results.isError ? <Banner message={errorMessage(results.error)} /> : null}

      {results.isPending ? (
        <ActivityIndicator color={colors.accent} />
      ) : results.data && results.data.items.length > 0 ? (
        results.data.items.map((exercise) => (
          <Pressable
            key={exercise.id}
            accessibilityRole="button"
            accessibilityLabel={exercise.name}
            onPress={() => onPick(exercise)}
            style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
          >
            <Thumb exercise={exercise} />
            <View style={styles.rowText}>
              <Body style={styles.rowName}>{exercise.name}</Body>
              <Caption numberOfLines={1}>
                {exercise.primaryMuscles
                  .map((muscle) => MUSCLE_LABELS_FR[muscle as Muscle])
                  .join(', ')}{' '}
                · {EQUIPMENT_LABELS_FR[exercise.equipment]}
              </Caption>
            </View>
          </Pressable>
        ))
      ) : (
        <Card tone="soft">
          <Body>{t('exercises.emptyBody')}</Body>
        </Card>
      )}
    </Screen>
  );
}

function Thumb({ exercise }: { exercise: ExerciseSummary }) {
  const [failed, setFailed] = useState(false);
  const photo = exercise.images[0];

  if (!photo || failed) return <View style={styles.thumb} />;

  return (
    <Image
      source={{ uri: imageUrl(photo) }}
      style={styles.thumb}
      resizeMode="cover"
      onError={() => setFailed(true)}
      accessibilityIgnoresInvertColors
    />
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.sm,
    borderRadius: radii.tile,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    minHeight: 64,
  },
  rowPressed: { borderColor: colors.accent },
  rowText: { flex: 1, gap: 2 },
  rowName: { fontWeight: '700', color: colors.ink },
  thumb: { width: 56, height: 56, borderRadius: radii.tile, backgroundColor: colors.accentSoft },
});
