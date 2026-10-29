import type { ReactNode } from 'react';
import { StyleSheet, Text as RNText, type StyleProp, type TextStyle } from 'react-native';
import { colors, fonts } from './theme';

type TextProps = {
  children: ReactNode;
  style?: StyleProp<TextStyle>;
  /** Posé sur un fond sombre : le texte passe en clair. */
  onDark?: boolean;
  numberOfLines?: number;
};

/** Grand titre d'écran, en Unbounded. */
export function Title({ children, style, onDark }: TextProps) {
  return (
    <RNText
      accessibilityRole="header"
      style={[styles.title, onDark && styles.onDark, style]}
      // Les titres restent lisibles même si l'appareil force de grandes polices.
      maxFontSizeMultiplier={1.4}
    >
      {children}
    </RNText>
  );
}

/** Titre de section, en Unbounded, plus petit. */
export function Heading({ children, style, onDark }: TextProps) {
  return (
    <RNText
      accessibilityRole="header"
      style={[styles.heading, onDark && styles.onDark, style]}
      maxFontSizeMultiplier={1.4}
    >
      {children}
    </RNText>
  );
}

/** Sur-titre en majuscules, couleur d'accent (signature visuelle du produit). */
export function Overline({ children, style, onDark }: TextProps) {
  return (
    <RNText style={[styles.overline, onDark && styles.overlineOnDark, style]}>{children}</RNText>
  );
}

/** Texte courant. */
export function Body({ children, style, onDark, numberOfLines }: TextProps) {
  return (
    <RNText style={[styles.body, onDark && styles.bodyOnDark, style]} numberOfLines={numberOfLines}>
      {children}
    </RNText>
  );
}

/** Légende, libellé secondaire. */
export function Caption({ children, style, onDark, numberOfLines }: TextProps) {
  return (
    <RNText
      style={[styles.caption, onDark && styles.bodyOnDark, style]}
      numberOfLines={numberOfLines}
    >
      {children}
    </RNText>
  );
}

/** Grand chiffre aligné (poids, calories, séries). */
export function Metric({ children, style, onDark }: TextProps) {
  return <RNText style={[styles.metric, onDark && styles.onDark, style]}>{children}</RNText>;
}

const styles = StyleSheet.create({
  title: { fontFamily: fonts.display, fontSize: 26, lineHeight: 34, color: colors.ink },
  heading: { fontFamily: fonts.displaySemi, fontSize: 18, lineHeight: 26, color: colors.ink },
  overline: {
    fontFamily: fonts.bold,
    fontSize: 11,
    lineHeight: 16,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: colors.accent,
  },
  overlineOnDark: { color: colors.lilac },
  body: { fontFamily: fonts.medium, fontSize: 15, lineHeight: 22, color: colors.inkSoft },
  bodyOnDark: { color: colors.onDarkSoft },
  caption: { fontFamily: fonts.medium, fontSize: 13, lineHeight: 18, color: colors.muted },
  metric: {
    fontFamily: fonts.display,
    fontSize: 32,
    lineHeight: 40,
    color: colors.ink,
    fontVariant: ['tabular-nums'],
  },
  onDark: { color: colors.onDark },
});
