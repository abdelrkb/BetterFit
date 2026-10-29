import { useId, useState } from 'react';
import {
  StyleSheet,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { MIN_TOUCH_SIZE, colors, fonts, radii, spacing } from './theme';
import { Caption, Overline } from './Text';

export type TextFieldProps = Omit<TextInputProps, 'style' | 'placeholderTextColor'> & {
  label: string;
  /** Explication sous le champ : unité attendue, format, conseil. */
  hint?: string;
  /** Message d'erreur. Il remplace l'explication et colore le champ. */
  error?: string;
  /** Texte fixe à droite (« kg », « cm », « kcal »). */
  suffix?: string;
  style?: StyleProp<ViewStyle>;
};

export function TextField({ label, hint, error, suffix, style, ...input }: TextFieldProps) {
  const [focused, setFocused] = useState(false);
  const describedBy = useId();

  return (
    <View style={[styles.container, style]}>
      <Overline>{label}</Overline>
      <View
        style={[styles.field, focused && styles.fieldFocused, Boolean(error) && styles.fieldError]}
      >
        <TextInput
          {...input}
          accessibilityLabel={label}
          accessibilityHint={error ?? hint}
          aria-describedby={describedBy}
          placeholderTextColor={colors.muted}
          style={styles.input}
          onFocus={(event) => {
            setFocused(true);
            input.onFocus?.(event);
          }}
          onBlur={(event) => {
            setFocused(false);
            input.onBlur?.(event);
          }}
        />
        {suffix ? <Caption style={styles.suffix}>{suffix}</Caption> : null}
      </View>
      {(error ?? hint) ? (
        <Caption style={error ? styles.errorText : undefined}>{error ?? hint}</Caption>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.xs },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: MIN_TOUCH_SIZE,
    paddingHorizontal: spacing.md,
    borderRadius: radii.tile,
    borderWidth: 1.5,
    borderColor: colors.cardBorder,
    backgroundColor: colors.card,
  },
  fieldFocused: { borderColor: colors.accent },
  fieldError: { borderColor: colors.danger },
  input: {
    flex: 1,
    paddingVertical: spacing.sm,
    fontFamily: fonts.semibold,
    fontSize: 16,
    color: colors.ink,
    // Enlève le contour bleu par défaut du navigateur : la bordure du champ
    // signale déjà le focus. `outlineWidth` est ignoré sur mobile.
    outlineWidth: 0,
  },
  suffix: { fontFamily: fonts.bold, color: colors.muted },
  errorText: { color: colors.danger },
});
