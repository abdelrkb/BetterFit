import { StyleSheet, View } from 'react-native';
import { colors, radii, spacing } from './theme';
import { Body } from './Text';

export type BannerProps = {
  message: string;
  tone?: 'error' | 'info' | 'success';
};

/** Message en haut d'un formulaire : erreur du serveur, confirmation. */
export function Banner({ message, tone = 'error' }: BannerProps) {
  return (
    <View accessibilityRole="alert" style={[styles.banner, styles[tone]]}>
      <Body style={styles[`${tone}Text`]}>{message}</Body>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    borderRadius: radii.tile,
    padding: spacing.md,
    borderWidth: 1,
  },
  error: { backgroundColor: '#FBEDEC', borderColor: '#E9C9C6' },
  errorText: { color: colors.danger },
  info: { backgroundColor: colors.accentSoft, borderColor: colors.cardBorder },
  infoText: { color: colors.accent },
  success: { backgroundColor: '#E8F5EE', borderColor: '#C2E2D1' },
  successText: { color: colors.success },
});
