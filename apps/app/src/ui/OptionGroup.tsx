import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MIN_TOUCH_SIZE, colors, fonts, radii, spacing } from './theme';
import { Caption, Overline } from './Text';

export type Option<T extends string> = {
  value: T;
  label: string;
  /** Précision affichée sous le libellé (par exemple « 3 à 5 séances »). */
  hint?: string;
};

export type OptionGroupProps<T extends string> = {
  label: string;
  options: readonly Option<T>[];
  value: T | undefined;
  onChange: (value: T) => void;
  error?: string;
  /** `row` pour deux ou trois choix courts, `column` quand il y a une précision. */
  layout?: 'row' | 'column';
};

/** Choix unique parmi quelques possibilités : sexe, objectif, niveau d'activité. */
export function OptionGroup<T extends string>({
  label,
  options,
  value,
  onChange,
  error,
  layout = 'column',
}: OptionGroupProps<T>) {
  return (
    <View style={styles.container}>
      <Overline>{label}</Overline>
      {/*
        Le groupe s'annonce comme un groupe de boutons radio, et chaque option
        dit `checked` : un lecteur d'écran n'annonce pas l'état d'un radio
        marqué `selected`, qui est réservé aux onglets et aux listes.
      */}
      <View
        accessibilityRole="radiogroup"
        accessibilityLabel={label}
        style={layout === 'row' ? styles.row : styles.column}
      >
        {options.map((option) => {
          const selected = option.value === value;

          return (
            <Pressable
              key={option.value}
              accessibilityRole="radio"
              accessibilityLabel={option.label}
              accessibilityHint={option.hint}
              accessibilityState={{ checked: selected, selected }}
              onPress={() => onChange(option.value)}
              style={({ pressed }) => [
                styles.option,
                layout === 'row' && styles.optionInRow,
                selected && styles.optionSelected,
                pressed && !selected && styles.optionPressed,
              ]}
            >
              <Text style={[styles.label, selected && styles.labelSelected]}>{option.label}</Text>
              {option.hint ? (
                <Caption style={selected ? styles.hintSelected : undefined}>{option.hint}</Caption>
              ) : null}
            </Pressable>
          );
        })}
      </View>
      {error ? <Caption style={styles.error}>{error}</Caption> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.sm },
  column: { gap: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  option: {
    minHeight: MIN_TOUCH_SIZE,
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.tile,
    borderWidth: 1.5,
    borderColor: colors.cardBorder,
    backgroundColor: colors.card,
    gap: 2,
  },
  optionInRow: { flexGrow: 1, flexBasis: 120 },
  optionSelected: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
  optionPressed: { backgroundColor: colors.paper },
  label: { fontFamily: fonts.bold, fontSize: 15, color: colors.ink },
  labelSelected: { color: colors.accent },
  hintSelected: { color: colors.accent },
  error: { color: colors.danger },
});
