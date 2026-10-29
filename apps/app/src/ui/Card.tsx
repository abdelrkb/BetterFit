import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, radii, spacing } from './theme';
import { Heading, Overline } from './Text';

export type CardProps = {
  children?: ReactNode;
  /** Sur-titre en majuscules, au-dessus du titre. */
  overline?: string;
  title?: string;
  /** Élément placé à droite du titre (bouton, chiffre, pastille). */
  trailing?: ReactNode;
  /** Variante douce, violet pâle : pour les encarts et les fonds de mascotte. */
  tone?: 'plain' | 'soft';
  style?: StyleProp<ViewStyle>;
};

export function Card({ children, overline, title, trailing, tone = 'plain', style }: CardProps) {
  const hasHeader = Boolean(overline ?? title ?? trailing);

  return (
    <View style={[styles.card, tone === 'soft' && styles.soft, style]}>
      {hasHeader ? (
        <View style={styles.header}>
          <View style={styles.headerText}>
            {overline ? <Overline>{overline}</Overline> : null}
            {title ? <Heading>{title}</Heading> : null}
          </View>
          {trailing}
        </View>
      ) : null}
      {children}
    </View>
  );
}

/**
 * Grande carte sombre avec les cercles violets qui débordent : c'est la
 * signature visuelle de BetterFit (`docs/DESIGN.md`).
 */
export function HeroCard({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.hero, style]}>
      <View style={[styles.heroCircle, styles.heroCircleTop]} />
      <View style={[styles.heroCircle, styles.heroCircleBottom]} />
      <View style={styles.heroContent}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderColor: colors.cardBorder,
    borderWidth: 1,
    borderRadius: radii.card,
    padding: spacing.lg,
    gap: spacing.md,
  },
  soft: { backgroundColor: colors.accentSoft, borderColor: 'transparent' },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  headerText: { flex: 1, gap: spacing.xs },
  hero: {
    backgroundColor: colors.night,
    borderRadius: radii.hero,
    overflow: 'hidden',
  },
  heroContent: { padding: spacing.xxl, gap: spacing.sm },
  heroCircle: {
    position: 'absolute',
    backgroundColor: colors.accent,
    opacity: 0.55,
    borderRadius: radii.pill,
  },
  heroCircleTop: { right: -48, top: -56, width: 168, height: 168 },
  heroCircleBottom: { left: -64, bottom: -72, width: 136, height: 136 },
});
