/**
 * Le squelette de la mascotte : à partir d'une pose, on calcule la liste des
 * formes à dessiner.
 *
 * Cette fonction ne connaît ni React ni le SVG : elle rend des données. C'est
 * ce qui permet au même calcul de servir au composant de l'app
 * (`react-native-svg`) et, plus tard, aux gabarits PDF (chaîne SVG), sans
 * recopier la géométrie. Portée depuis `reference/mascot.js`.
 */

import { POSES, type Pose, type PoseName } from './poses.js';

/** Couleurs de la mascotte (`docs/DESIGN.md`). */
export const MASCOT_COLORS = {
  /** Corps et membres proches. */
  main: '#7B4FE6',
  /** Membres éloignés, mis en retrait. */
  far: '#5A35B8',
  /** Museau et ventre. */
  light: '#D4C3FF',
  /** Matériel (barres, bancs, disques). */
  ink: '#2A1758',
  /** Intérieur de l'oreille. */
  ear: '#B79CF5',
  /** Moyeu des disques. */
  hub: '#B9A8E6',
} as const;

/**
 * Palette pour les fonds sombres ou violets : sur un bouton d'accent ou une
 * carte héro, le corps violet se confondrait avec le fond.
 */
export const MASCOT_COLORS_ON_DARK = {
  main: '#D9CCFF',
  far: '#A98EEC',
  light: '#FFFFFF',
  ink: '#F0E9FF',
  ear: '#8F6BEA',
  hub: '#6B3FD9',
} as const;

export type MascotTone = 'default' | 'onDark';

/** Les six couleurs dont le dessin a besoin, quelle que soit la variante. */
export type MascotPalette = { readonly [K in keyof typeof MASCOT_COLORS]: string };

export function palette(tone: MascotTone): MascotPalette {
  return tone === 'onDark' ? MASCOT_COLORS_ON_DARK : MASCOT_COLORS;
}

/** Le dessin est toujours calculé dans ce repère, puis mis à l'échelle. */
export const MASCOT_VIEWBOX_SIZE = 100;

/** Hauteur du sol dans le repère. */
export const MASCOT_GROUND_Y = 93;

type Point = readonly [number, number];

export type Shape =
  | { kind: 'line'; x1: number; y1: number; x2: number; y2: number; width: number; color: string }
  | { kind: 'circle'; cx: number; cy: number; r: number; fill: string }
  | {
      kind: 'ellipse';
      cx: number;
      cy: number;
      rx: number;
      ry: number;
      fill: string;
      opacity?: number;
    }
  | { kind: 'rect'; x: number; y: number; width: number; height: number; rx?: number; fill: string }
  | { kind: 'path'; d: string; stroke: string; width: number }
  | {
      kind: 'group';
      /** Rotation en degrés, appliquée après la translation. */
      rotate: number;
      /** Centre de rotation, dans le repère du groupe. */
      origin: Point;
      /** Translation appliquée avant la rotation. */
      translate?: Point;
      children: Shape[];
    };

/**
 * Transformation SVG d'un groupe, sous forme de chaîne.
 *
 * `react-native-svg` accepte cette chaîne sur les deux plateformes, là où
 * `originX`/`originY` produisent un attribut invalide sur le web.
 */
export function groupTransform(shape: Extract<Shape, { kind: 'group' }>): string {
  const f = (value: number) => value.toFixed(1);

  return shape.translate
    ? `translate(${f(shape.translate[0])} ${f(shape.translate[1])}) rotate(${f(shape.rotate)})`
    : `rotate(${f(shape.rotate)} ${f(shape.origin[0])} ${f(shape.origin[1])})`;
}

/** Angle en degrés vers un vecteur unitaire : 0 = bas, 90 = avant, 180 = haut. */
function direction(angle: number): Point {
  const radians = (angle * Math.PI) / 180;
  return [Math.sin(radians), Math.cos(radians)];
}

/** Avance de `length` depuis `from`, dans la direction `angle`. */
function advance(from: Point, angle: number, length: number): Point {
  const [dx, dy] = direction(angle);
  return [from[0] + dx * length, from[1] + dy * length];
}

/** Arrondi d'affichage, pour que le SVG rendu soit stable et lisible. */
function round(value: number): number {
  return Math.round(value * 10) / 10;
}

function line(from: Point, to: Point, width: number, color: string): Shape {
  return {
    kind: 'line',
    x1: round(from[0]),
    y1: round(from[1]),
    x2: round(to[0]),
    y2: round(to[1]),
    width,
    color,
  };
}

/** Un disque de fonte vu de profil : la plaque et son moyeu. */
function plate(center: Point, radius: number, colors: MascotPalette): Shape[] {
  return [
    { kind: 'circle', cx: round(center[0]), cy: round(center[1]), r: radius, fill: colors.ink },
    {
      kind: 'circle',
      cx: round(center[0]),
      cy: round(center[1]),
      r: round(radius * 0.28),
      fill: colors.hub,
    },
  ];
}

type Limb = { shapes: Shape[]; hand: Point };

export type MascotDrawing = {
  readonly pose: Pose;
  readonly shapes: readonly Shape[];
};

/** Calcule toutes les formes d'une pose, dans l'ordre où il faut les dessiner. */
export function buildMascot(poseName: PoseName, tone: MascotTone = 'default'): MascotDrawing {
  const pose: Pose = POSES[poseName];
  const colors = palette(tone);

  const hip = pose.hip;
  const shoulder = advance(hip, pose.torso, 26);
  const headCenter = advance(shoulder, pose.torso, 11);
  // Le corps est calculé droit puis pivoté : `rotation` redresse le buste.
  const rotation = 180 - pose.torso;

  const arm = (index: 0 | 1, color: string): Limb => {
    const angles = pose.arms[index];
    const origin: Point = index === 1 ? [shoulder[0] - 1.5, shoulder[1] - 1] : shoulder;
    const elbow = advance(origin, angles[0], 14);
    const hand = advance(elbow, angles[1], 13);

    return {
      shapes: [
        line(origin, elbow, 6, color),
        line(elbow, hand, 5.5, color),
        { kind: 'circle', cx: round(hand[0]), cy: round(hand[1]), r: 3.4, fill: colors.far },
      ],
      hand,
    };
  };

  const leg = (index: 0 | 1, color: string): Shape[] => {
    const angles = pose.legs[index];
    const origin: Point = index === 1 ? [hip[0] - 1.5, hip[1]] : hip;
    const knee = advance(origin, angles[0], 16);
    const ankle = advance(knee, angles[1], 16);
    const toe = advance(ankle, pose.feet ? pose.feet[index] : 90, 6);

    return [
      line(origin, knee, 7, color),
      line(knee, ankle, 6.5, color),
      line(ankle, toe, 5, color),
    ];
  };

  const farArm = arm(1, colors.far);
  const nearArm = arm(0, colors.main);

  /** Matériel dessiné derrière la mascotte. */
  const back: Shape[] = [];
  /** Matériel dessiné devant elle. */
  const front: Shape[] = [];

  if (pose.bench) {
    const [x, y, width] = pose.bench;
    back.push(
      { kind: 'rect', x, y, width, height: 5, rx: 2, fill: colors.ink },
      {
        kind: 'rect',
        x: x + 4,
        y: y + 5,
        width: 3,
        height: MASCOT_GROUND_Y - y - 5,
        fill: colors.ink,
      },
      {
        kind: 'rect',
        x: x + width - 7,
        y: y + 5,
        width: 3,
        height: MASCOT_GROUND_Y - y - 5,
        fill: colors.ink,
      },
    );
  }

  if (pose.seat) {
    const [x, y, width] = pose.seat;
    back.push(
      { kind: 'rect', x, y: y + 2, width, height: 6, rx: 2, fill: colors.ink },
      {
        kind: 'rect',
        x: x + width / 2 - 2,
        y: y + 8,
        width: 4,
        height: MASCOT_GROUND_Y - y - 8,
        fill: colors.ink,
      },
      { kind: 'rect', x: x - 2, y: y - 26, width: 5, height: 32, rx: 2, fill: colors.ink },
    );
  }

  switch (pose.prop) {
    case 'bar': {
      // Barre de traction : la hauteur suit la main qui s'y accroche.
      const y = round(nearArm.hand[1]);
      back.push(
        { kind: 'rect', x: 14, y: y - 2, width: 72, height: 4, rx: 2, fill: colors.ink },
        { kind: 'rect', x: 14, y, width: 3, height: round(MASCOT_GROUND_Y - y), fill: colors.ink },
        { kind: 'rect', x: 83, y, width: 3, height: round(MASCOT_GROUND_Y - y), fill: colors.ink },
      );
      break;
    }
    case 'barbell':
      front.push(...plate(nearArm.hand, 9, colors));
      break;
    case 'dumbbell':
      front.push(...plate(nearArm.hand, 4.6, colors));
      break;
    case 'dumbbells':
      back.push(...plate(farArm.hand, 4.6, colors));
      front.push(...plate(nearArm.hand, 4.6, colors));
      break;
    case 'hipbar':
      front.push(...plate([hip[0] + 2, hip[1] - 11], 9, colors));
      break;
    case 'none':
      break;
  }

  const r = round;

  const tail: Shape = {
    kind: 'group',
    rotate: r(rotation),
    origin: [r(hip[0]), r(hip[1])],
    children: [
      {
        kind: 'path',
        d:
          `M${r(hip[0] - 3)} ${r(hip[1] - 2)} ` +
          `C${r(hip[0] - 16)} ${r(hip[1] + 6)} ${r(hip[0] - 26)} ${r(hip[1] - 4)} ${r(hip[0] - 21)} ${r(hip[1] - 14)} ` +
          `S${r(hip[0] - 11)} ${r(hip[1] - 17)} ${r(hip[0] - 13)} ${r(hip[1] - 11)}`,
        stroke: colors.far,
        width: 3.6,
      },
    ],
  };

  const body: Shape = {
    kind: 'group',
    rotate: r(rotation),
    origin: [r(hip[0]), r(hip[1])],
    children: [
      line(hip, [hip[0], hip[1] - 26], 15, colors.main),
      {
        kind: 'ellipse',
        cx: r(hip[0] + 2.6),
        cy: r(hip[1] - 12),
        rx: 4.6,
        ry: 9,
        fill: colors.light,
      },
    ],
  };

  // La tête est dessinée autour de l'origine, puis amenée à sa place.
  // Pas d'yeux : c'est la règle de `docs/DESIGN.md`.
  const head: Shape = {
    kind: 'group',
    translate: [r(headCenter[0]), r(headCenter[1])],
    rotate: r(rotation),
    origin: [0, 0],
    children: [
      { kind: 'circle', cx: -6.2, cy: -4.6, r: 4, fill: colors.main },
      { kind: 'circle', cx: -6.2, cy: -4.6, r: 2.2, fill: colors.ear },
      // La petite mèche sur le haut du crâne.
      {
        kind: 'path',
        d: 'M-2 -9.6 q1.6 -3 4 -1.6 q-0.4 -2.6 2.6 -2',
        stroke: colors.main,
        width: 1.8,
      },
      { kind: 'circle', cx: 0, cy: 0, r: 9.6, fill: colors.main },
      { kind: 'ellipse', cx: 4.8, cy: 2.2, rx: 5.8, ry: 4.8, fill: colors.light },
      // Le sourire.
      { kind: 'path', d: 'M5.4 4.4 q2.2 1.8 4.4 0', stroke: colors.ink, width: 1.1 },
    ],
  };

  const shadow: Shape = {
    kind: 'ellipse',
    cx: r(hip[0]),
    cy: 93.5,
    rx: 24,
    ry: 2.4,
    fill: colors.ink,
    opacity: 0.12,
  };

  const shapes: Shape[] = [
    shadow,
    ...back,
    ...(pose.notail ? [] : [tail]),
    ...leg(1, colors.far),
    ...farArm.shapes,
    body,
    ...leg(0, colors.main),
    head,
    ...nearArm.shapes,
    ...front,
  ];

  return { pose, shapes };
}
