import { StyleSheet, Text, View } from 'react-native';
import { colors, fonts, radii, spacing } from './theme';

export type ChipProps = {
  label: string;
  /** `dark` sur fond clair, `soft` dans une carte, `outline` pour un filtre inactif. */
  tone?: 'dark' | 'soft' | 'outline';
};

/** Petite étiquette : muscle ciblé, matériel, niveau. */
export function Chip({ label, tone = 'soft' }: ChipProps) {
  return (
    <View style={[styles.chip, styles[tone]]}>
      <Text style={[styles.label, tone === 'dark' && styles.labelOnDark]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  dark: { backgroundColor: colors.night },
  soft: { backgroundColor: colors.accentSoft },
  outline: { backgroundColor: 'transparent', borderColor: colors.cardBorder },
  label: { fontFamily: fonts.bold, fontSize: 12, color: colors.accent },
  labelOnDark: { color: colors.onDark },
});
