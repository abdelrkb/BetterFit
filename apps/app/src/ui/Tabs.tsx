import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { MIN_TOUCH_SIZE, colors, fonts, radii, spacing } from './theme';

export type TabItem<T extends string> = {
  value: T;
  label: string;
};

export type TabsProps<T extends string> = {
  items: readonly TabItem<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Rend les onglets défilables : utile quand ils sont nombreux sur téléphone. */
  scrollable?: boolean;
};

/** Onglets en pastilles, comme dans le prototype. */
export function Tabs<T extends string>({
  items,
  value,
  onChange,
  scrollable = false,
}: TabsProps<T>) {
  const row = (
    <View style={styles.row}>
      {items.map((item) => {
        const selected = item.value === value;

        return (
          <Pressable
            key={item.value}
            accessibilityRole="tab"
            accessibilityLabel={item.label}
            accessibilityState={{ selected }}
            onPress={() => onChange(item.value)}
            style={({ pressed }) => [
              styles.tab,
              selected && styles.tabSelected,
              pressed && !selected && styles.tabPressed,
            ]}
          >
            <Text style={[styles.label, selected && styles.labelSelected]} numberOfLines={1}>
              {item.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );

  if (!scrollable) {
    return (
      <View accessibilityRole="tablist" style={styles.container}>
        {row}
      </View>
    );
  }

  return (
    <ScrollView
      accessibilityRole="tablist"
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.container}
    >
      {row}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.accentSoft,
    borderRadius: radii.pill,
    padding: spacing.xs,
  },
  row: { flexDirection: 'row', gap: spacing.xs },
  tab: {
    flex: 1,
    minHeight: MIN_TOUCH_SIZE - spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabSelected: { backgroundColor: colors.accent },
  tabPressed: { backgroundColor: '#DFD3F6' },
  label: { fontFamily: fonts.bold, fontSize: 13, color: colors.accent },
  labelSelected: { color: colors.onDark },
});
