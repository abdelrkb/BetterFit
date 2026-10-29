import type { WeightPoint } from '@betterfit/shared';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Circle, Line, Path, Text as SvgText } from 'react-native-svg';
import { decimal } from '@/lib/format';
import { Body, Caption, chartGrid, chartSeries, colors, fonts, spacing } from '@/ui';

/**
 * La courbe de poids : les pesées, et la **tendance sur sept jours**.
 *
 * Les deux séries sont en kilogrammes, donc **un seul axe** — jamais deux
 * échelles sur un même graphique. La tendance est tracée en trait plein, les
 * pesées en points : c'est la tendance qu'il faut lire, le poids du matin
 * bouge d'un kilo rien qu'avec l'eau.
 *
 * Chaque série porte son nom dans la légende et sa dernière valeur en bout
 * de courbe, et un tableau donne les mêmes chiffres : la couleur ne porte
 * jamais seule l'information.
 */

const HEIGHT = 200;
const PADDING = { top: 16, right: 52, bottom: 28, left: 42 };

export function WeightChart({ points }: { points: WeightPoint[] }) {
  const { t } = useTranslation();
  const [width, setWidth] = useState(320);
  const [showTable, setShowTable] = useState(false);

  if (points.length === 0) {
    return <Body>{t('weight.chartEmpty')}</Body>;
  }

  const values = points.flatMap((point) => [point.weightKg, point.trendKg]);
  const max = Math.max(...values);
  const min = Math.min(...values);
  // Un peu d'air, et jamais une plage nulle : une seule pesée donnerait une
  // division par zéro.
  const margin = Math.max(0.5, (max - min) * 0.15);
  const top = max + margin;
  const bottom = min - margin;
  const range = top - bottom || 1;

  const plotWidth = Math.max(40, width - PADDING.left - PADDING.right);
  const plotHeight = HEIGHT - PADDING.top - PADDING.bottom;

  const x = (index: number) =>
    PADDING.left + (points.length === 1 ? plotWidth / 2 : (index / (points.length - 1)) * plotWidth);
  const y = (value: number) => PADDING.top + plotHeight - ((value - bottom) / range) * plotHeight;

  const trendPath = points
    .map((point, index) => `${index === 0 ? 'M' : 'L'}${x(index)} ${y(point.trendKg)}`)
    .join(' ');

  const gridValues = [bottom, (bottom + top) / 2, top];
  const last = points[points.length - 1]!;

  return (
    <View style={styles.container} onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendSwatch, { backgroundColor: chartSeries[0] }]} />
          <Caption>{t('weight.trendSeries')}</Caption>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: chartSeries[1] }]} />
          <Caption>{t('weight.weighInSeries')}</Caption>
        </View>
      </View>

      <Svg width={width} height={HEIGHT} accessibilityLabel={t('weight.chartLabel')}>
        {gridValues.map((value) => (
          <Line
            key={`grid-${value}`}
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
            {decimal(value, 1)}
          </SvgText>
        ))}

        <Path
          d={trendPath}
          stroke={chartSeries[0]}
          strokeWidth={2}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {points.map((point, index) => (
          <Circle
            key={point.date}
            cx={x(index)}
            cy={y(point.weightKg)}
            r={3.5}
            fill={chartSeries[1]}
            // Un anneau de la couleur du fond sépare deux points superposés.
            stroke={colors.card}
            strokeWidth={1.5}
          />
        ))}

        {/* La dernière valeur est étiquetée : on la lit sans compter les
            graduations. */}
        <SvgText
          x={PADDING.left + plotWidth + 6}
          y={y(last.trendKg) + 4}
          fontSize={12}
          fill={chartSeries[0]}
          fontFamily={fonts.bold}
        >
          {decimal(last.trendKg, 1)}
        </SvgText>
      </Svg>

      <Pressable
        accessibilityRole="button"
        onPress={() => setShowTable((shown) => !shown)}
        style={styles.toggle}
      >
        <Caption>{showTable ? t('weight.hideTable') : t('weight.showTable')}</Caption>
      </Pressable>

      {showTable ? (
        <View style={styles.table}>
          <View style={styles.tableRow}>
            <Caption style={styles.tableCell}>{t('weight.tableDate')}</Caption>
            <Caption style={styles.tableCell}>{t('weight.weighInSeries')}</Caption>
            <Caption style={styles.tableCell}>{t('weight.trendSeries')}</Caption>
          </View>
          {[...points].reverse().map((point) => (
            <View key={point.date} style={styles.tableRow}>
              <Caption style={styles.tableCell}>
                {new Date(`${point.date}T12:00:00Z`).toLocaleDateString('fr-FR', {
                  day: 'numeric',
                  month: 'short',
                })}
              </Caption>
              <Caption style={styles.tableCell}>{decimal(point.weightKg)}</Caption>
              <Caption style={styles.tableCell}>{decimal(point.trendKg)}</Caption>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.sm },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  legendSwatch: { width: 16, height: 3, borderRadius: 2 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  toggle: { minHeight: 44, justifyContent: 'center' },
  table: { gap: spacing.xs },
  tableRow: { flexDirection: 'row', gap: spacing.sm },
  tableCell: { flex: 1 },
});
