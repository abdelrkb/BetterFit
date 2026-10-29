import type { ColorValue } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

/**
 * Les quatre pictogrammes de la barre d'onglets, dessinés à la main plutôt
 * qu'empruntés à une bibliothèque d'icônes : quatre traits ne justifient pas
 * une dépendance de plus, et le trait reste celui de la mascotte.
 *
 * Tous sont tracés dans un carré de 24, au trait, sans remplissage.
 */
export type TabIconName = 'home' | 'training' | 'nutrition' | 'profile';

export type TabIconProps = {
  name: TabIconName;
  color: ColorValue;
  size?: number;
};

export function TabIcon({ name, color, size = 26 }: TabIconProps) {
  const stroke = {
    stroke: color,
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    fill: 'none',
  };

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {name === 'home' ? (
        <>
          {/* Un toit et une façade. */}
          <Path d="M3.5 10.5 12 3.5l8.5 7" {...stroke} />
          <Path d="M5.5 9.5v10h13v-10" {...stroke} />
          <Path d="M9.5 19.5v-5h5v5" {...stroke} />
        </>
      ) : null}

      {name === 'training' ? (
        <>
          {/* Un haltère : barre centrale, deux disques de chaque côté. */}
          <Path d="M8 12h8" {...stroke} />
          <Path d="M6.5 8.5v7M4 10v4M17.5 8.5v7M20 10v4" {...stroke} />
        </>
      ) : null}

      {name === 'nutrition' ? (
        <>
          {/* Une assiette, une fourchette, un couteau. */}
          <Circle cx={12} cy={12} r={5} {...stroke} />
          <Path d="M3.5 4v5a1.6 1.6 0 0 0 3.2 0V4M5.1 9.5V20" {...stroke} />
          <Path d="M19 4c1.2 1 1.6 2.6 1.3 4.4-.2 1.2-.9 1.8-1.3 1.8V20" {...stroke} />
        </>
      ) : null}

      {name === 'profile' ? (
        <>
          {/* Une tête et des épaules. */}
          <Circle cx={12} cy={8.5} r={3.8} {...stroke} />
          <Path d="M4.8 20c.6-3.6 3.6-5.6 7.2-5.6s6.6 2 7.2 5.6" {...stroke} />
        </>
      ) : null}
    </Svg>
  );
}
