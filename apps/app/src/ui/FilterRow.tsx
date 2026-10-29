import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { colors, fonts, radii, spacing } from './theme';

export type FilterOption<T extends string> = { value: T; label: string };

export type FilterRowProps<T extends string> = {
  options: readonly FilterOption<T>[];
  value: T | undefined;
  onChange: (value: T | undefined) => void;
  /** Libellé du choix « tout », placé en tête. */
  allLabel: string;
  accessibilityLabel: string;
};

/**
 * Rangée de filtres défilable. Appuyer sur le filtre actif le retire : c'est
 * le geste attendu, et ça évite un bouton « effacer » en plus.
 */
export function FilterRow<T extends string>({
  options,
  value,
  onChange,
  allLabel,
  accessibilityLabel,
}: FilterRowProps<T>) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      accessibilityLabel={accessibilityLabel}
      contentContainerStyle={styles.row}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ selected: value === undefined }}
        onPress={() => onChange(undefined)}
        style={[styles.chip, value === undefined && styles.chipSelected]}
      >
        <Text style={[styles.label, value === undefined && styles.labelSelected]}>{allLabel}</Text>
      </Pressable>

      {options.map((option) => {
        const selected = option.value === value;

        return (
          <Pressable
            key={option.value}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            onPress={() => onChange(selected ? undefined : option.value)}
            style={[styles.chip, selected && styles.chipSelected]}
          >
            <Text style={[styles.label, selected && styles.labelSelected]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.sm, paddingVertical: spacing.xs },
  chip: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.card,
    minHeight: 40,
    justifyContent: 'center',
  },
  chipSelected: { backgroundColor: colors.accent, borderColor: colors.accent },
  label: { fontFamily: fonts.bold, fontSize: 13, color: colors.inkSoft },
  labelSelected: { color: colors.onDark },
});
