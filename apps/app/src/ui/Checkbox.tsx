import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MIN_TOUCH_SIZE, colors, fonts, spacing } from './theme';
import { Caption } from './Text';

export type CheckboxProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: ReactNode;
  error?: string;
};

export function Checkbox({ checked, onChange, label, error }: CheckboxProps) {
  return (
    <View style={styles.container}>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked }}
        onPress={() => onChange(!checked)}
        style={styles.row}
      >
        <View style={[styles.box, checked && styles.boxChecked]}>
          {checked ? <Text style={styles.mark}>✓</Text> : null}
        </View>
        <View style={styles.labelWrapper}>{label}</View>
      </Pressable>
      {error ? <Caption style={styles.error}>{error}</Caption> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.xs },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    minHeight: MIN_TOUCH_SIZE,
  },
  box: {
    width: 26,
    height: 26,
    marginTop: 2,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: colors.violetMid,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
  },
  boxChecked: { backgroundColor: colors.accent, borderColor: colors.accent },
  mark: { color: colors.onDark, fontFamily: fonts.bold, fontSize: 15, lineHeight: 20 },
  labelWrapper: { flex: 1 },
  error: { color: colors.danger },
});
