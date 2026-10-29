import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { MIN_TOUCH_SIZE, colors, fonts, radii, spacing } from './theme';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

export type ButtonProps = {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  /** Occupe toute la largeur disponible. */
  block?: boolean;
  disabled?: boolean;
  loading?: boolean;
  /** Icône ou mascotte placée avant le libellé. */
  leading?: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** À renseigner quand le libellé seul ne suffit pas à comprendre l'action. */
  accessibilityHint?: string;
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  block = false,
  disabled = false,
  loading = false,
  leading,
  style,
  accessibilityHint,
}: ButtonProps) {
  const inactive = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        variants[variant].container,
        block && styles.block,
        pressed && !inactive && variants[variant].pressed,
        inactive && styles.inactive,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variants[variant].spinnerColor} />
      ) : (
        <View style={styles.content}>
          {leading ? <View style={styles.leading}>{leading}</View> : null}
          <Text style={[styles.label, variants[variant].label]} numberOfLines={1}>
            {label}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: MIN_TOUCH_SIZE,
    borderRadius: radii.tile,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  block: { alignSelf: 'stretch' },
  content: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  // Sans ça, le flex écrase l'icône ou la mascotte posée avant le libellé.
  leading: { flexShrink: 0 },
  label: { fontFamily: fonts.bold, fontSize: 16 },
  inactive: { opacity: 0.45 },
});

const variants: Record<
  ButtonVariant,
  { container: ViewStyle; pressed: ViewStyle; label: { color: string }; spinnerColor: string }
> = {
  primary: {
    container: { backgroundColor: colors.accent },
    pressed: { backgroundColor: '#5A33BC' },
    label: { color: colors.onDark },
    spinnerColor: colors.onDark,
  },
  secondary: {
    container: { backgroundColor: colors.accentSoft, borderColor: colors.cardBorder },
    pressed: { backgroundColor: '#DFD3F6' },
    label: { color: colors.accent },
    spinnerColor: colors.accent,
  },
  ghost: {
    container: { backgroundColor: 'transparent', borderColor: colors.cardBorder },
    pressed: { backgroundColor: colors.accentSoft },
    label: { color: colors.accent },
    spinnerColor: colors.accent,
  },
  danger: {
    container: { backgroundColor: colors.danger },
    pressed: { backgroundColor: '#97332D' },
    label: { color: colors.onDark },
    spinnerColor: colors.onDark,
  },
};
