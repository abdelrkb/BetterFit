import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MIN_TOUCH_SIZE, colors, fonts, radii, spacing } from './theme';

export type ChipProps = {
  label: string;
  /** `dark` sur fond clair, `soft` dans une carte, `outline` pour un filtre inactif. */
  tone?: 'dark' | 'soft' | 'outline';
  /**
   * Rend la pastille cliquable : elle devient un choix, pas une étiquette.
   * La zone tactile est alors portée à la taille minimale.
   */
  onPress?: () => void;
  /** Avec `onPress` : l'état annoncé aux lecteurs d'écran. */
  selected?: boolean;
};

/** Petite étiquette : muscle ciblé, matériel, niveau. Cliquable au besoin. */
export function Chip({ label, tone = 'soft', onPress, selected }: ChipProps) {
  const content = (
    <Text style={[styles.label, tone === 'dark' && styles.labelOnDark]}>{label}</Text>
  );

  if (!onPress) {
    return <View style={[styles.chip, styles[tone]]}>{content}</View>;
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={selected === undefined ? undefined : { selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        styles[tone],
        styles.pressable,
        pressed && styles.pressed,
      ]}
    >
      {content}
    </Pressable>
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
  // Une pastille qu'on touche doit rester attrapable au pouce.
  pressable: { minHeight: MIN_TOUCH_SIZE, justifyContent: 'center' },
  pressed: { opacity: 0.7 },
  dark: { backgroundColor: colors.night },
  soft: { backgroundColor: colors.accentSoft },
  outline: { backgroundColor: 'transparent', borderColor: colors.cardBorder },
  label: { fontFamily: fonts.bold, fontSize: 12, color: colors.accent },
  labelOnDark: { color: colors.onDark },
});
