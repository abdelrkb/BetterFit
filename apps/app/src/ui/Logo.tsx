import { StyleSheet, Text } from 'react-native';
import { colors, fonts } from './theme';

/** Le logo « BETTERFIT », avec « FIT » en couleur d'accent (`docs/DESIGN.md`). */
export function Logo({ size = 22, onDark = false }: { size?: number; onDark?: boolean }) {
  return (
    <Text
      accessibilityRole="header"
      accessibilityLabel="BetterFit"
      style={[styles.logo, { fontSize: size }, onDark && styles.onDark]}
    >
      BETTER<Text style={onDark ? styles.fitOnDark : styles.fit}>FIT</Text>
    </Text>
  );
}

const styles = StyleSheet.create({
  logo: { fontFamily: fonts.display, letterSpacing: 1.5, color: colors.ink },
  onDark: { color: colors.onDark },
  fit: { color: colors.accent },
  fitOnDark: { color: colors.lilac },
});
