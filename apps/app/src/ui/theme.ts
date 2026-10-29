import {
  CONTENT_MAX_WIDTH,
  MIN_TOUCH_SIZE,
  WIDE_SCREEN_BREAKPOINT,
  chartGrid,
  chartSeries,
  colors,
  fontFamilies,
  radii,
  spacing,
} from '@betterfit/shared';
import { useWindowDimensions } from 'react-native';

export {
  CONTENT_MAX_WIDTH,
  MIN_TOUCH_SIZE,
  WIDE_SCREEN_BREAKPOINT,
  chartGrid,
  chartSeries,
  colors,
  radii,
  spacing,
};

/**
 * Noms des polices tels que `expo-font` les enregistre. Les titres sont en
 * Unbounded, tout le reste en Manrope (`docs/DESIGN.md`).
 */
export const fonts = {
  display: 'Unbounded_800ExtraBold',
  displaySemi: 'Unbounded_700Bold',
  regular: 'Manrope_400Regular',
  medium: 'Manrope_500Medium',
  semibold: 'Manrope_600SemiBold',
  bold: 'Manrope_700Bold',
  extrabold: 'Manrope_800ExtraBold',
} as const;

export { fontFamilies };

/**
 * Hauteur de la barre d'onglets flottante.
 *
 * Elle est posée hors du flux, donc c'est `Screen` qui réserve la place en
 * bas de chaque écran : sans ça, la dernière carte passerait dessous.
 */
export const TAB_BAR_HEIGHT = 68;

/** Vrai sur un grand écran web : on peut passer en plusieurs colonnes. */
export function useWideScreen(): boolean {
  const { width } = useWindowDimensions();

  return width >= WIDE_SCREEN_BREAKPOINT;
}
