import { Mascot } from '@betterfit/mascot';
import type { WeightPoint } from '@betterfit/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import Svg, { Circle, Line, Path, Text as SvgText } from 'react-native-svg';
import { formatSeconds } from '@/components/RestTimer';
import { assignProgram, fetchClient } from '@/lib/coaching';
import { errorMessage } from '@/lib/errors';
import { decimal } from '@/lib/format';
import { listPrograms } from '@/lib/programs';
import {
  Banner,
  Body,
  Button,
  Caption,
  Card,
  Chip,
  Metric,
  Screen,
  Title,
  chartGrid,
  chartSeries,
  colors,
  fonts,
  spacing,
} from '@/ui';

export default function ClientScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [assignError, setAssignError] = useState<string | null>(null);

  const client = useQuery({
    queryKey: ['coach', 'client', id],
    queryFn: () => fetchClient(id),
    enabled: Boolean(id),
  });

  const templates = useQuery({
    queryKey: ['programs', 'templates'],
    queryFn: () => listPrograms({ templates: true }),
  });

  const assign = useMutation({
    mutationFn: (programId: string) => assignProgram(id, programId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['coach', 'client', id] });
      await queryClient.invalidateQueries({ queryKey: ['programs'] });
    },
    onError: (error) => setAssignError(errorMessage(error)),
  });

  if (client.isPending) {
    return (
      <Screen>
        <ActivityIndicator color={colors.accent} />
      </Screen>
    );
  }

  if (client.isError || !client.data) {
    return (
      <Screen>
        <Banner message={errorMessage(client.error)} />
        <Button block variant="ghost" label={t('common.back')} onPress={() => router.back()} />
      </Screen>
    );
  }

  const data = client.data;

  return (
    <Screen>
      <Title>{data.client.name}</Title>
      <Caption>{data.client.email}</Caption>

      <Card>
        <View style={styles.metrics}>
          <View style={styles.metric}>
            <Metric>{data.client.workoutsLast28Days}</Metric>
            <Caption>{t('coach.sheetWorkouts')}</Caption>
          </View>
          <View style={styles.metric}>
            <Metric>{data.programs.length}</Metric>
            <Caption>{t('coach.sheetPrograms')}</Caption>
          </View>
          <View style={styles.metric}>
            <Metric>
              {data.client.latestWeightKg === null ? '—' : decimal(data.client.latestWeightKg)}
            </Metric>
            <Caption>{t('coach.sheetWeight')}</Caption>
          </View>
        </View>
      </Card>

      <Card overline={t('coach.assignOverline')} title={t('coach.assignTitle')}>
        {assignError ? <Banner message={assignError} /> : null}

        {templates.data && templates.data.items.length > 0 ? (
          templates.data.items.map((template) => (
            <View key={template.id} style={styles.templateRow}>
              <Body style={styles.templateName}>{template.title}</Body>
              <Button
                variant="secondary"
                label={t('coach.assign')}
                loading={assign.isPending}
                onPress={() => {
                  setAssignError(null);
                  assign.mutate(template.id);
                }}
              />
            </View>
          ))
        ) : (
          <Body>{t('coach.noTemplate')}</Body>
        )}
      </Card>

      <Card overline={t('coach.sheetProgramsOverline')}>
        {data.programs.length === 0 ? (
          <Body>{t('coach.noAssigned')}</Body>
        ) : (
          data.programs.map((program) => (
            <Pressable
              key={program.id}
              accessibilityRole="button"
              accessibilityLabel={program.title}
              onPress={() => router.push(`/training/${program.id}`)}
              style={styles.templateRow}
            >
              <View style={styles.templateName}>
                <Body style={styles.strong}>{program.title}</Body>
                <Caption>
                  {t('training.sessionCount', { count: program.sessionCount })} ·{' '}
                  {t('training.daysPerWeek', { count: program.trainingDays })}
                </Caption>
              </View>
              <Chip tone="outline" label={t('coach.open')} />
            </Pressable>
          ))
        )}
      </Card>

      <Card overline={t('coach.weightOverline')} title={t('coach.weightTitle')}>
        <WeightChart points={data.weights} />
      </Card>

      <Card overline={t('coach.sheetWorkoutsOverline')}>
        {data.workouts.length === 0 ? (
          <View style={styles.empty}>
            <Mascot pose="stand" size={88} />
            <Body style={styles.center}>{t('coach.noWorkout')}</Body>
          </View>
        ) : (
          data.workouts.map((workout) => (
            <View key={workout.id} style={styles.workout}>
              <Body style={styles.strong}>{workout.sessionName || t('history.freeSession')}</Body>
              <Caption>
                {new Date(workout.finishedAt).toLocaleDateString('fr-FR')} ·{' '}
                {formatSeconds(workout.durationSeconds)} ·{' '}
                {t('history.sets', { count: workout.completedSets })} ·{' '}
                {t('history.volume', { value: Math.round(workout.totalVolumeKg) })}
              </Caption>
            </View>
          ))
        )}
      </Card>

      <Button block variant="ghost" label={t('common.back')} onPress={() => router.back()} />
    </Screen>
  );
}

const HEIGHT = 180;
const PADDING = { top: 16, right: 48, bottom: 26, left: 40 };

/**
 * Le poids et sa tendance sur sept jours.
 *
 * Les deux séries sont en kilogrammes : un seul axe. La tendance est la série
 * qui compte, c'est elle qui porte la couleur d'accent.
 */
function WeightChart({ points }: { points: WeightPoint[] }) {
  const { t } = useTranslation();
  const [width, setWidth] = useState(320);
  const [showTable, setShowTable] = useState(false);

  if (points.length === 0) {
    return <Body>{t('coach.noWeight')}</Body>;
  }

  const values = points.flatMap((point) => [point.weightKg, point.trendKg]);
  const max = Math.max(...values);
  const min = Math.min(...values);
  const top = max + Math.max(0.5, (max - min) * 0.2);
  const bottom = min - Math.max(0.5, (max - min) * 0.2);
  const range = top - bottom || 1;

  const plotWidth = Math.max(40, width - PADDING.left - PADDING.right);
  const plotHeight = HEIGHT - PADDING.top - PADDING.bottom;

  const x = (index: number) =>
    PADDING.left +
    (points.length === 1 ? plotWidth / 2 : (index / (points.length - 1)) * plotWidth);
  const y = (value: number) => PADDING.top + plotHeight - ((value - bottom) / range) * plotHeight;

  const series = [
    { key: 'trendKg' as const, label: t('coach.trend'), color: chartSeries[0] },
    { key: 'weightKg' as const, label: t('coach.rawWeight'), color: chartSeries[1] },
  ];

  const gridValues = [bottom, (bottom + top) / 2, top];

  return (
    <View style={styles.chart} onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
      <View style={styles.legend}>
        {series.map((item) => (
          <View key={item.key} style={styles.legendItem}>
            <View style={[styles.swatch, { backgroundColor: item.color }]} />
            <Caption>{item.label}</Caption>
          </View>
        ))}
      </View>

      <Svg width={width} height={HEIGHT} accessibilityLabel={t('coach.weightChartLabel')}>
        {gridValues.map((value) => (
          <Line
            key={value}
            x1={PADDING.left}
            y1={y(value)}
            x2={PADDING.left + plotWidth}
            y2={y(value)}
            stroke={chartGrid}
            strokeWidth={1}
          />
        ))}
        {gridValues.map((value) => (
          <SvgText
            key={`l-${value}`}
            x={PADDING.left - 6}
            y={y(value) + 4}
            fontSize={11}
            fill={colors.muted}
            textAnchor="end"
            fontFamily={fonts.medium}
          >
            {decimal(value)}
          </SvgText>
        ))}

        {series.map((item) => (
          <Path
            key={item.key}
            d={points
              .map((point, index) => `${index === 0 ? 'M' : 'L'}${x(index)} ${y(point[item.key])}`)
              .join(' ')}
            stroke={item.color}
            strokeWidth={2}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}

        {series.map((item) =>
          points.map((point, index) => (
            <Circle
              key={`${item.key}-${index}`}
              cx={x(index)}
              cy={y(point[item.key])}
              r={3.5}
              fill={item.color}
              stroke={colors.card}
              strokeWidth={2}
            />
          )),
        )}

        {series.map((item) => (
          <SvgText
            key={`end-${item.key}`}
            x={x(points.length - 1) + 8}
            y={y(points[points.length - 1]![item.key]) + 4}
            fontSize={12}
            fill={colors.inkSoft}
            fontFamily={fonts.bold}
          >
            {decimal(points[points.length - 1]![item.key])}
          </SvgText>
        ))}
      </Svg>

      <Pressable
        accessibilityRole="button"
        onPress={() => setShowTable((value) => !value)}
        style={styles.tableToggle}
      >
        <Caption style={styles.accent}>
          {showTable ? t('progress.hideTable') : t('progress.showTable')}
        </Caption>
      </Pressable>

      {showTable ? (
        <View>
          <View style={styles.tableRow}>
            <Caption style={styles.cell}>{t('progress.date')}</Caption>
            <Caption style={styles.cell}>{t('coach.rawWeight')}</Caption>
            <Caption style={styles.cell}>{t('coach.trend')}</Caption>
          </View>
          {points.map((point) => (
            <View key={point.date} style={styles.tableRow}>
              <Caption style={styles.cell}>{point.date}</Caption>
              <Caption style={styles.cell}>{decimal(point.weightKg)}</Caption>
              <Caption style={styles.cell}>{decimal(point.trendKg)}</Caption>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg },
  metric: { gap: spacing.xs, minWidth: 90 },
  templateRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  templateName: { flex: 1, gap: 2 },
  strong: { fontWeight: '700', color: colors.ink },
  workout: { gap: 2, paddingVertical: spacing.xs },
  empty: { alignItems: 'center', gap: spacing.sm },
  center: { textAlign: 'center' },
  chart: { gap: spacing.sm },
  legend: { flexDirection: 'row', gap: spacing.lg, flexWrap: 'wrap' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  swatch: { width: 12, height: 12, borderRadius: 3 },
  tableToggle: { alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center' },
  accent: { color: colors.accent },
  tableRow: { flexDirection: 'row', gap: spacing.sm },
  cell: { flex: 1, fontVariant: ['tabular-nums'] },
});
