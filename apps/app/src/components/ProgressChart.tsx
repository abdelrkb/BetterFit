import type { ProgressPoint } from '@betterfit/shared';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Circle, Line, Path, Text as SvgText } from 'react-native-svg';
import { Body, Caption, chartGrid, chartSeries, colors, fonts, spacing } from '@/ui';

/**
 * La progression sur un exercice : charge maximale et 1RM estimé.
 *
 * Les deux mesures sont en kilogrammes, donc **un seul axe** — jamais deux
 * échelles sur un même graphique. Les deux couleurs ont été vérifiées pour
 * rester distinguables en daltonisme, et chaque courbe porte en plus son
 * nom et sa dernière valeur : la couleur ne porte jamais seule l'information.
 *
 * Le tableau sous le graphique donne les mêmes chiffres, pour qui ne peut pas
 * lire la courbe.
 */

const HEIGHT = 200;
const PADDING = { top: 16, right: 56, bottom: 28, left: 40 };

export type Series = {
  key: 'maxWeightKg' | 'estimatedOneRepMaxKg';
  label: string;
  color: string;
};

export function ProgressChart({ points }: { points: ProgressPoint[] }) {
  const { t } = useTranslation();
  const [width, setWidth] = useState(320);
  const [showTable, setShowTable] = useState(false);

  const series: Series[] = [
    { key: 'maxWeightKg', label: t('progress.maxWeight'), color: chartSeries[0] },
    { key: 'estimatedOneRepMaxKg', label: t('progress.oneRepMax'), color: chartSeries[1] },
  ];

  if (points.length === 0) {
    return <Body>{t('progress.empty')}</Body>;
  }

  const values = points.flatMap((point) => [point.maxWeightKg, point.estimatedOneRepMaxKg]);
  const max = Math.max(...values);
  const min = Math.min(...values);
  // Un peu d'air en haut et en bas, et jamais une plage nulle.
  const top = max + Math.max(2, (max - min) * 0.15);
  const bottom = Math.max(0, min - Math.max(2, (max - min) * 0.15));
  const range = top - bottom || 1;

  const plotWidth = Math.max(40, width - PADDING.left - PADDING.right);
  const plotHeight = HEIGHT - PADDING.top - PADDING.bottom;

  const x = (index: number) =>
    PADDING.left + (points.length === 1 ? plotWidth / 2 : (index / (points.length - 1)) * plotWidth);
  const y = (value: number) => PADDING.top + plotHeight - ((value - bottom) / range) * plotHeight;

  const pathOf = (key: Series['key']) =>
    points.map((point, index) => `${index === 0 ? 'M' : 'L'}${x(index)} ${y(point[key])}`).join(' ');

  const gridValues = [bottom, bottom + range / 2, top];

  return (
    <View style={styles.container} onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
      <View style={styles.legend}>
        {series.map((item) => (
          <View key={item.key} style={styles.legendItem}>
            <View style={[styles.legendSwatch, { backgroundColor: item.color }]} />
            <Caption>{item.label}</Caption>
          </View>
        ))}
      </View>

      <Svg width={width} height={HEIGHT} accessibilityLabel={t('progress.chartLabel')}>
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
            key={`label-${value}`}
            x={PADDING.left - 6}
            y={y(value) + 4}
            fontSize={11}
            fill={colors.muted}
            textAnchor="end"
            fontFamily={fonts.medium}
          >
            {Math.round(value)}
          </SvgText>
        ))}

        {series.map((item) => (
          <Path
            key={item.key}
            d={pathOf(item.key)}
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
              r={4}
              fill={item.color}
              // Un anneau de la couleur du fond sépare deux points superposés.
              stroke={colors.card}
              strokeWidth={2}
            />
          )),
        )}

        {/* Étiquette directe sur le dernier point : l'identité ne tient pas
            qu'à la couleur. */}
        {series.map((item) => {
          const last = points[points.length - 1]!;

          return (
            <SvgText
              key={`end-${item.key}`}
              x={x(points.length - 1) + 8}
              y={y(last[item.key]) + 4}
              fontSize={12}
              fill={colors.inkSoft}
              fontFamily={fonts.bold}
            >
              {`${Math.round(last[item.key])} kg`}
            </SvgText>
          );
        })}

        <SvgText
          x={PADDING.left}
          y={HEIGHT - 8}
          fontSize={11}
          fill={colors.muted}
          fontFamily={fonts.medium}
        >
          {formatDate(points[0]!.date)}
        </SvgText>
        {points.length > 1 ? (
          <SvgText
            x={PADDING.left + plotWidth}
            y={HEIGHT - 8}
            fontSize={11}
            fill={colors.muted}
            textAnchor="middle"
            fontFamily={fonts.medium}
          >
            {formatDate(points[points.length - 1]!.date)}
          </SvgText>
        ) : null}
      </Svg>

      <Pressable
        accessibilityRole="button"
        onPress={() => setShowTable((value) => !value)}
        style={styles.tableToggle}
      >
        <Caption style={styles.tableToggleText}>
          {showTable ? t('progress.hideTable') : t('progress.showTable')}
        </Caption>
      </Pressable>

      {showTable ? (
        <View style={styles.table}>
          <View style={styles.tableRow}>
            <Caption style={styles.tableCell}>{t('progress.date')}</Caption>
            <Caption style={styles.tableCell}>{t('progress.maxWeight')}</Caption>
            <Caption style={styles.tableCell}>{t('progress.oneRepMax')}</Caption>
            <Caption style={styles.tableCell}>{t('progress.volume')}</Caption>
          </View>
          {points.map((point) => (
            <View key={point.date} style={styles.tableRow}>
              <Caption style={styles.tableCell}>{formatDate(point.date)}</Caption>
              <Caption style={styles.tableCell}>{Math.round(point.maxWeightKg)}</Caption>
              <Caption style={styles.tableCell}>{Math.round(point.estimatedOneRepMaxKg)}</Caption>
              <Caption style={styles.tableCell}>{Math.round(point.volumeKg)}</Caption>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function formatDate(iso: string): string {
  const [year, month, day] = iso.split('-');
  return `${day}/${month}/${year?.slice(2)}`;
}

const styles = StyleSheet.create({
  container: { gap: spacing.sm },
  legend: { flexDirection: 'row', gap: spacing.lg, flexWrap: 'wrap' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  legendSwatch: { width: 12, height: 12, borderRadius: 3 },
  tableToggle: { alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center' },
  tableToggleText: { color: colors.accent },
  table: { gap: 2 },
  tableRow: { flexDirection: 'row', gap: spacing.sm },
  tableCell: { flex: 1, fontVariant: ['tabular-nums'] },
});
