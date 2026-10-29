import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { Body, Caption, Metric, colors, fonts, spacing } from '@/ui';

/**
 * L'anneau de calories de l'accueil : ce qu'il reste à manger aujourd'hui.
 *
 * L'anneau se remplit à mesure qu'on mange. Au-delà de l'objectif il passe
 * en couleur d'alerte et le chiffre du centre devient un dépassement — mais
 * la couleur ne porte jamais seule l'information : le libellé sous le chiffre
 * dit « restantes » ou « au-dessus », et l'anneau annonce son état aux
 * lecteurs d'écran.
 */

const SIZE = 180;
const STROKE = 16;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export type CalorieRingProps = {
  /** Objectif du jour, en kcal. */
  targetKcal: number;
  /** Ce qui a déjà été mangé, en kcal. */
  consumedKcal: number;
};

export function CalorieRing({ targetKcal, consumedKcal }: CalorieRingProps) {
  const { t } = useTranslation();

  const remaining = Math.round(targetKcal - consumedKcal);
  const over = remaining < 0;
  // L'anneau sature à 100 % : au-delà, c'est la couleur et le texte qui
  // disent le dépassement, pas un deuxième tour d'anneau illisible.
  const ratio = targetKcal > 0 ? Math.min(1, consumedKcal / targetKcal) : 0;
  const color = over ? colors.warning : colors.accent;

  const label = t('home.ringLabel', {
    consumed: Math.round(consumedKcal),
    target: Math.round(targetKcal),
  });

  return (
    <View style={styles.wrapper}>
      <View style={styles.ring} accessible accessibilityRole="image" accessibilityLabel={label}>
        <Svg width={SIZE} height={SIZE}>
          <Circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            stroke={colors.accentSoft}
            strokeWidth={STROKE}
            fill="none"
          />
          <Circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            stroke={color}
            strokeWidth={STROKE}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={CIRCUMFERENCE * (1 - ratio)}
            // L'anneau part du haut, pas de la droite.
            transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
          />
        </Svg>

        <View style={styles.center} pointerEvents="none">
          <Metric style={styles.number}>{Math.abs(remaining)}</Metric>
          <Caption>{over ? t('home.ringOver') : t('home.ringRemaining')}</Caption>
        </View>
      </View>

      <Body style={styles.detail}>
        {t('home.ringDetail', {
          consumed: Math.round(consumedKcal),
          target: Math.round(targetKcal),
        })}
      </Body>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { alignItems: 'center', gap: spacing.md },
  ring: { width: SIZE, height: SIZE, alignItems: 'center', justifyContent: 'center' },
  center: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  number: { fontFamily: fonts.display },
  detail: { textAlign: 'center' },
});
