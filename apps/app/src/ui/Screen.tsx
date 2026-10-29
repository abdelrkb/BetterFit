import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CONTENT_MAX_WIDTH, TAB_BAR_HEIGHT, colors, spacing } from './theme';

/**
 * Cadre commun à tous les écrans : fond `paper`, marges, et une colonne
 * centrée limitée en largeur pour rester lisible sur grand écran web.
 */
export function Screen({ children }: { children: ReactNode }) {
  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.column}>{children}</View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.paper },
  // `width: '100%'` borne la colonne à la largeur visible. Sans ça, un enfant
  // trop large élargit tout le contenu et le texte sort de l'écran.
  scroll: {
    padding: spacing.xl,
    // De quoi passer sous la barre d'onglets flottante, qui ne réserve pas
    // sa place elle-même. Les écrans sans barre y gagnent juste un peu d'air.
    paddingBottom: TAB_BAR_HEIGHT + spacing.xxxl,
    width: '100%',
  },
  column: {
    width: '100%',
    maxWidth: CONTENT_MAX_WIDTH,
    alignSelf: 'center',
    gap: spacing.lg,
  },
});
