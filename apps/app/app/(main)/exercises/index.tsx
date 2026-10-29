import { Mascot } from '@betterfit/mascot';
import {
  EQUIPMENT_LABELS_FR,
  LEVEL_LABELS_FR,
  MUSCLE_GROUP_LABELS_FR,
  MUSCLE_GROUP_ORDER,
  MUSCLE_LABELS_FR,
  equipmentSchema,
  levelSchema,
  type Equipment,
  type ExerciseSummary,
  type Level,
  type Muscle,
  type MuscleGroup,
} from '@betterfit/shared';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Link, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { imageUrl, searchExercises } from '@/lib/exercises';
import { errorMessage } from '@/lib/errors';
import {
  Banner,
  Body,
  Button,
  Caption,
  CONTENT_MAX_WIDTH,
  Chip,
  FilterRow,
  Heading,
  TextField,
  Title,
  colors,
  radii,
  spacing,
} from '@/ui';

export default function ExerciseLibraryScreen() {
  const { t } = useTranslation();
  const router = useRouter();

  const [rawQuery, setRawQuery] = useState('');
  const [query, setQuery] = useState('');
  const [muscleGroup, setMuscleGroup] = useState<MuscleGroup | undefined>();
  const [equipment, setEquipment] = useState<Equipment | undefined>();
  const [level, setLevel] = useState<Level | undefined>();
  const [mine, setMine] = useState(false);
  const [page, setPage] = useState(1);

  // On attend que la frappe se calme avant d'interroger le serveur.
  useEffect(() => {
    const timer = setTimeout(() => {
      setQuery(rawQuery);
      setPage(1);
    }, 300);

    return () => clearTimeout(timer);
  }, [rawQuery]);

  const search = useQuery({
    queryKey: ['exercises', { query, muscleGroup, equipment, level, mine, page }],
    queryFn: () =>
      searchExercises({
        q: query || undefined,
        muscleGroup,
        equipment,
        level,
        mine: mine || undefined,
        page,
      }),
    placeholderData: keepPreviousData,
  });

  const muscleOptions = useMemo(
    () =>
      MUSCLE_GROUP_ORDER.map((group) => ({ value: group, label: MUSCLE_GROUP_LABELS_FR[group] })),
    [],
  );
  const equipmentOptions = useMemo(
    () =>
      equipmentSchema.options.map((item) => ({ value: item, label: EQUIPMENT_LABELS_FR[item] })),
    [],
  );
  const levelOptions = useMemo(
    () => levelSchema.options.map((item) => ({ value: item, label: LEVEL_LABELS_FR[item] })),
    [],
  );

  const total = search.data?.total ?? 0;
  const lastPage = Math.max(1, Math.ceil(total / (search.data?.pageSize ?? 30)));

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <View style={styles.column}>
        <View style={styles.header}>
          <Title>{t('exercises.title')}</Title>

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
            onChange={(value) => {
              setMuscleGroup(value);
              setPage(1);
            }}
          />
          <FilterRow
            accessibilityLabel={t('exercises.filterEquipment')}
            allLabel={t('exercises.allEquipment')}
            options={equipmentOptions}
            value={equipment}
            onChange={(value) => {
              setEquipment(value);
              setPage(1);
            }}
          />
          <FilterRow
            accessibilityLabel={t('exercises.filterLevel')}
            allLabel={t('exercises.allLevels')}
            options={levelOptions}
            value={level}
            onChange={(value) => {
              setLevel(value);
              setPage(1);
            }}
          />

          <View style={styles.actions}>
            <Button
              variant={mine ? 'primary' : 'ghost'}
              label={t('exercises.onlyMine')}
              onPress={() => {
                setMine((value) => !value);
                setPage(1);
              }}
            />
            <Link href="/exercises/new" asChild>
              <Button variant="secondary" label={t('exercises.create')} onPress={() => {}} />
            </Link>
          </View>

          <Caption>
            {search.isPending ? t('common.loading') : t('exercises.resultCount', { count: total })}
          </Caption>
        </View>

        {search.isError ? <Banner message={errorMessage(search.error)} /> : null}

        {/* L'en-tête reste visible, seule la liste défile. */}
        <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
          {search.isPending ? (
            <ActivityIndicator color={colors.accent} style={styles.spinner} />
          ) : (
            <ExerciseGrid
              items={search.data?.items ?? []}
              onOpen={(id) => router.push(`/exercises/${id}`)}
            />
          )}

          {lastPage > 1 ? (
            <View style={styles.pagination}>
              <Button
                variant="ghost"
                label={t('exercises.previous')}
                disabled={page <= 1}
                onPress={() => setPage((value) => Math.max(1, value - 1))}
              />
              <Caption>{t('exercises.pageOf', { current: page, total: lastPage })}</Caption>
              <Button
                variant="ghost"
                label={t('exercises.next')}
                disabled={page >= lastPage}
                onPress={() => setPage((value) => Math.min(lastPage, value + 1))}
              />
            </View>
          ) : null}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

function ExerciseGrid({
  items,
  onOpen,
}: {
  items: ExerciseSummary[];
  onOpen: (id: string) => void;
}) {
  const { t } = useTranslation();

  if (items.length === 0) {
    return (
      <View style={styles.empty}>
        <Mascot pose="stand" size={120} />
        <Heading>{t('exercises.emptyTitle')}</Heading>
        <Body style={styles.emptyText}>{t('exercises.emptyBody')}</Body>
      </View>
    );
  }

  return (
    <View style={styles.grid}>
      {items.map((item) => (
        <ExerciseCard key={item.id} exercise={item} onPress={() => onOpen(item.id)} />
      ))}
    </View>
  );
}

function ExerciseCard({ exercise, onPress }: { exercise: ExerciseSummary; onPress: () => void }) {
  const { t } = useTranslation();
  const [imageFailed, setImageFailed] = useState(false);
  const photo = exercise.images[0];
  const showPhoto = photo !== undefined && !imageFailed;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={exercise.name}
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
    >
      <View style={styles.thumb}>
        {showPhoto ? (
          <Image
            source={{ uri: imageUrl(photo) }}
            style={styles.image}
            resizeMode="cover"
            onError={() => setImageFailed(true)}
            accessibilityIgnoresInvertColors
          />
        ) : (
          <Mascot pose={asPose(exercise.mascotPose)} size={72} />
        )}
      </View>

      <View style={styles.cardBody}>
        <Body numberOfLines={2} style={styles.cardTitle}>
          {exercise.name}
        </Body>
        <Caption numberOfLines={1}>
          {exercise.primaryMuscles.map((muscle) => MUSCLE_LABELS_FR[muscle as Muscle]).join(', ')}
        </Caption>
        <View style={styles.cardChips}>
          <Chip label={EQUIPMENT_LABELS_FR[exercise.equipment]} />
          {exercise.source === 'custom' ? <Chip label={t('exercises.mine')} tone="dark" /> : null}
        </View>
      </View>
    </Pressable>
  );
}

/** Pose de secours quand l'exercice n'a ni photo ni pose choisie. */
function asPose(pose: string | null): 'stand' {
  return (pose ?? 'stand') as 'stand';
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.paper },
  column: {
    flex: 1,
    width: '100%',
    maxWidth: CONTENT_MAX_WIDTH,
    alignSelf: 'center',
    paddingHorizontal: spacing.xl,
    gap: spacing.md,
  },
  header: { gap: spacing.sm, paddingTop: spacing.lg },
  list: { paddingBottom: spacing.xxxl, gap: spacing.md },
  actions: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  spinner: { marginTop: spacing.xxxl },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  card: {
    flexBasis: 150,
    flexGrow: 1,
    maxWidth: 220,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: radii.card,
    overflow: 'hidden',
  },
  cardPressed: { borderColor: colors.accent },
  thumb: {
    height: 110,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: { width: '100%', height: '100%' },
  cardBody: { padding: spacing.md, gap: spacing.xs },
  cardTitle: { color: colors.ink, fontWeight: '700' },
  cardChips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.xs },
  empty: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xxxl },
  emptyText: { textAlign: 'center' },
  pagination: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
  },
});
