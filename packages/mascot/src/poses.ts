/**
 * Les poses de la mascotte, reprises telles quelles de
 * `reference/prototype-studio.html` (`reference/mascot.js`).
 *
 * Convention des angles, en degrés : 0 = vers le bas, 90 = vers l'avant,
 * 180 = vers le haut, -90 = vers l'arrière.
 */

/** Un couple d'angles : [épaule, coude] pour un bras, [hanche, genou] pour une jambe. */
export type JointAngles = readonly [number, number];

/** Accessoire tenu ou posé, dessiné avec la pose. */
export type MascotProp = 'none' | 'barbell' | 'dumbbell' | 'dumbbells' | 'bar' | 'hipbar';

export type Pose = {
  /** Libellé français, affiché dans l'écran de démonstration. */
  readonly label: string;
  /** Position de la hanche dans le `viewBox` 0 0 100 100 (le sol est à y ≈ 93). */
  readonly hip: readonly [number, number];
  /** Angle du buste. */
  readonly torso: number;
  /** [bras proche, bras éloigné]. */
  readonly arms: readonly [JointAngles, JointAngles];
  /** [jambe proche, jambe éloignée]. */
  readonly legs: readonly [JointAngles, JointAngles];
  /** Angle des pieds. Par défaut 90° (à plat vers l'avant). */
  readonly feet?: readonly [number, number];
  readonly prop: MascotProp;
  /** Banc : [x, y, largeur]. */
  readonly bench?: readonly [number, number, number];
  /** Siège de machine : [x, y, largeur]. */
  readonly seat?: readonly [number, number, number];
  /** Vrai quand la queue gênerait le dessin (allongé sur un banc). */
  readonly notail?: boolean;
};

export const POSES = {
  stand: {
    label: 'Debout',
    hip: [50, 60],
    torso: 180,
    arms: [
      [10, 6],
      [-6, -4],
    ],
    legs: [
      [3, -2],
      [-3, 2],
    ],
    prop: 'none',
  },
  flex: {
    label: 'Biceps (fierté)',
    hip: [50, 60],
    torso: 180,
    arms: [
      [95, 172],
      [78, 165],
    ],
    legs: [
      [6, -2],
      [-6, 2],
    ],
    prop: 'none',
  },
  squat: {
    label: 'Squat',
    hip: [44, 75],
    torso: 145,
    arms: [
      [-50, 165],
      [-45, 160],
    ],
    legs: [
      [80, -30],
      [75, -28],
    ],
    prop: 'barbell',
  },
  hinge: {
    label: 'Soulevé de terre',
    hip: [38, 62],
    torso: 115,
    arms: [
      [0, 0],
      [3, 1],
    ],
    legs: [
      [30, -10],
      [26, -8],
    ],
    prop: 'barbell',
  },
  bench: {
    label: 'Développé couché',
    hip: [66, 66],
    torso: -90,
    arms: [
      [180, 180],
      [176, 178],
    ],
    legs: [
      [60, 0],
      [54, 4],
    ],
    prop: 'barbell',
    bench: [20, 72, 52],
    notail: true,
  },
  pushup: {
    label: 'Pompes',
    hip: [46, 77],
    torso: 117.7,
    arms: [
      [0, 0],
      [3, 0],
    ],
    legs: [
      [-62.3, -62.3],
      [-60, -60],
    ],
    feet: [-100, -100],
    prop: 'none',
  },
  plank: {
    label: 'Gainage',
    hip: [44, 84],
    torso: 104,
    arms: [
      [0, 90],
      [2, 92],
    ],
    legs: [
      [-76, -76],
      [-74, -74],
    ],
    feet: [-100, -100],
    prop: 'none',
  },
  press: {
    label: 'Développé militaire',
    hip: [50, 61],
    torso: 180,
    arms: [
      [172, 178],
      [166, 176],
    ],
    legs: [
      [4, -2],
      [-4, 2],
    ],
    prop: 'dumbbells',
  },
  row: {
    label: 'Rowing',
    hip: [38, 63],
    torso: 125,
    arms: [
      [-35, 25],
      [-28, 18],
    ],
    legs: [
      [22, -12],
      [18, -10],
    ],
    prop: 'dumbbell',
  },
  pullup: {
    label: 'Traction',
    hip: [50, 52],
    torso: 180,
    arms: [
      [25, 175],
      [15, 170],
    ],
    legs: [
      [12, -40],
      [6, -35],
    ],
    prop: 'bar',
  },
  lunge: {
    label: 'Fente',
    hip: [46, 74.6],
    torso: 180,
    arms: [
      [3, 0],
      [-3, 0],
    ],
    legs: [
      [85, 0],
      [-20, -90],
    ],
    feet: [90, -90],
    prop: 'dumbbells',
  },
  curl: {
    label: 'Curl biceps',
    hip: [50, 60],
    torso: 180,
    arms: [
      [8, 160],
      [2, 30],
    ],
    legs: [
      [3, -2],
      [-3, 2],
    ],
    prop: 'dumbbells',
  },
  triceps: {
    label: 'Extension triceps',
    hip: [50, 61],
    torso: 180,
    arms: [
      [168, -12],
      [160, -18],
    ],
    legs: [
      [4, -2],
      [-4, 2],
    ],
    prop: 'dumbbell',
  },
  bridge: {
    label: 'Hip thrust',
    hip: [58, 67.5],
    torso: -95,
    arms: [
      [15, 40],
      [10, 35],
    ],
    legs: [
      [59, 0],
      [54, 3],
    ],
    prop: 'hipbar',
    bench: [10, 72, 30],
    notail: true,
  },
  raise: {
    label: 'Élévations',
    hip: [50, 61],
    torso: 180,
    arms: [
      [95, 95],
      [82, 86],
    ],
    legs: [
      [3, -2],
      [-3, 2],
    ],
    prop: 'dumbbells',
  },
  seated: {
    label: 'Machine assise',
    hip: [42, 62],
    torso: 172,
    arms: [
      [8, 40],
      [4, 35],
    ],
    legs: [
      [90, 75],
      [88, 70],
    ],
    prop: 'none',
    seat: [24, 65, 30],
  },
  cardio: {
    label: 'Cardio / course',
    hip: [50, 57],
    torso: 168,
    arms: [
      [-40, 60],
      [45, 150],
    ],
    legs: [
      [50, -20],
      [-30, -80],
    ],
    prop: 'none',
  },
} as const satisfies Record<string, Pose>;

export type PoseName = keyof typeof POSES;

export const POSE_NAMES = Object.keys(POSES) as PoseName[];

export function isPoseName(value: string): value is PoseName {
  return value in POSES;
}
