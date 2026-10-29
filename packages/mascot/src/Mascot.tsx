import { View } from 'react-native';
import { Circle, Ellipse, G, Line, Path, Rect, Svg } from 'react-native-svg';
import {
  buildMascot,
  groupTransform,
  MASCOT_VIEWBOX_SIZE,
  type MascotTone,
  type Shape,
} from './geometry.js';
import { POSES, type PoseName } from './poses.js';

function ShapeView({ shape }: { shape: Shape }) {
  switch (shape.kind) {
    case 'line':
      return (
        <Line
          x1={shape.x1}
          y1={shape.y1}
          x2={shape.x2}
          y2={shape.y2}
          stroke={shape.color}
          strokeWidth={shape.width}
          strokeLinecap="round"
        />
      );
    case 'circle':
      return <Circle cx={shape.cx} cy={shape.cy} r={shape.r} fill={shape.fill} />;
    case 'ellipse':
      return (
        <Ellipse
          cx={shape.cx}
          cy={shape.cy}
          rx={shape.rx}
          ry={shape.ry}
          fill={shape.fill}
          opacity={shape.opacity}
        />
      );
    case 'rect':
      return (
        <Rect
          x={shape.x}
          y={shape.y}
          width={shape.width}
          height={shape.height}
          rx={shape.rx}
          fill={shape.fill}
        />
      );
    case 'path':
      return (
        <Path
          d={shape.d}
          fill="none"
          stroke={shape.stroke}
          strokeWidth={shape.width}
          strokeLinecap="round"
        />
      );
    case 'group':
      return (
        <G transform={groupTransform(shape)}>
          {shape.children.map((child, index) => (
            <ShapeView key={index} shape={child} />
          ))}
        </G>
      );
  }
}

export type MascotProps = {
  pose: PoseName;
  /** Côté du carré, en points. La mascotte est vectorielle : aucune perte. */
  size?: number;
  /**
   * Texte lu par les lecteurs d'écran. Sans lui, la mascotte est traitée comme
   * décorative — ce qui est le bon choix quand le texte à côté dit déjà la même
   * chose.
   */
  accessibilityLabel?: string;
  /**
   * `onDark` éclaircit la mascotte pour les fonds sombres ou violets, où le
   * corps se confondrait avec le fond.
   */
  tone?: MascotTone;
};

/** La mascotte BetterFit : un singe violet, sans yeux, en vue de profil. */
export function Mascot({ pose, size = 96, accessibilityLabel, tone = 'default' }: MascotProps) {
  const { shapes } = buildMascot(pose, tone);

  return (
    // La taille est fixée sur un conteneur : sans lui, la mascotte est écrasée
    // quand elle est posée dans une ligne flexible (un bouton, par exemple).
    <View style={{ width: size, height: size }}>
      <Svg
        width={size}
        height={size}
        viewBox={`0 0 ${MASCOT_VIEWBOX_SIZE} ${MASCOT_VIEWBOX_SIZE}`}
        // Sans libellé, la mascotte est décorative : on la cache aux lecteurs
        // d'écran. `aria-hidden` est compris sur le web comme sur mobile.
        accessibilityRole={accessibilityLabel ? 'image' : undefined}
        accessibilityLabel={accessibilityLabel}
        aria-hidden={accessibilityLabel === undefined}
      >
        {shapes.map((shape, index) => (
          <ShapeView key={index} shape={shape} />
        ))}
      </Svg>
    </View>
  );
}

/** Libellé français d'une pose, pour les écrans et les lecteurs d'écran. */
export function poseLabel(pose: PoseName): string {
  return POSES[pose].label;
}
