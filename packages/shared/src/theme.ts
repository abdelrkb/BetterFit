/**
 * Jetons de l'identité visuelle, repris de `docs/DESIGN.md`.
 *
 * Volontairement de simples données : l'app les transforme en styles React
 * Native, et les gabarits PDF (étape 10) en CSS. Un seul endroit pour les
 * changer.
 */

export const colors = {
  /** Bandeaux sombres, chips, fonds de couverture. */
  night: '#1E0D45',
  /** Couleur principale. Le coach peut la changer pour ses PDF. */
  accent: '#6B3FD9',
  /** Cartes douces, fonds de mascotte. */
  accentSoft: '#EDE6FA',
  /** Accents sur fond sombre, troisième barre de macros. */
  lilac: '#C4ADFF',
  /** Deuxième barre de macros, contours de cases. */
  violetMid: '#8F6BEA',
  /** Texte principal. */
  ink: '#1C0F3A',
  /** Texte courant secondaire. */
  inkSoft: '#3B3054',
  /** Libellés, légendes. */
  muted: '#6E6290',
  /** Fond des pages. */
  paper: '#F7F4FC',
  /** Fond des cartes. */
  card: '#FFFFFF',
  /** Bordure des cartes. */
  cardBorder: '#E6DDF7',
  /** Texte et icônes posés sur `night` ou `accent`. */
  onDark: '#FFFFFF',
  /** Texte secondaire posé sur `night`. */
  onDarkSoft: '#D9CEF5',
  /** États. Contrastes vérifiés sur `paper` et sur `card`. */
  success: '#1B7F4B',
  warning: '#9A5B00',
  danger: '#B4413A',
} as const;

/**
 * Couleurs des séries de graphique, dans cet ordre, jamais recyclées.
 *
 * Validées : écart perceptuel suffisant pour les trois daltonismes
 * (ΔE 30 en protanopie, 32 en vision normale) et contraste ≥ 3:1 sur une
 * carte blanche. Ne pas les remplacer sans refaire la vérification.
 */
export const chartSeries = ['#6B3FD9', '#C2410C', '#0891B2', '#9A5B00'] as const;

/** Grille et axes : volontairement discrets, ils ne sont pas la donnée. */
export const chartGrid = '#E6DDF7';

/** Couleurs d'accent proposées au coach pour ses PDF (voir `DESIGN.md`). */
export const accentChoices = ['#6B3FD9', '#8B5CF6', '#A21CAF', '#4C1D95'] as const;

/**
 * Les trois couleurs des macronutriments, dans cet ordre.
 *
 * Partagées entre l'app et les PDF : un client qui regarde son PDF puis son
 * téléphone doit retrouver les mêmes couleurs. Du plus soutenu au plus clair,
 * ce qui suit l'ordre d'importance protéines, glucides, lipides.
 */
export const MACRO_PDF_COLORS = {
  protein: '#6B3FD9',
  carbs: '#8F6BEA',
  fat: '#C4ADFF',
} as const;

export const radii = {
  /** Tuiles et pastilles. */
  tile: 14,
  /** Cartes. */
  card: 18,
  /** Grandes cartes héro. */
  hero: 22,
  /** Pastilles rondes. */
  pill: 999,
} as const;

/** Échelle d'espacement, en points, par pas de 4. */
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

export const fontFamilies = {
  /** Titres, grands chiffres et logo. */
  display: 'Unbounded',
  /** Tout le reste. */
  text: 'Manrope',
} as const;

/**
 * Taille minimale d'une zone tactile, en points (règle d'accessibilité de
 * `CLAUDE.md`).
 */
export const MIN_TOUCH_SIZE = 44;

/** Largeur à partir de laquelle on passe en mise en page sur plusieurs colonnes. */
export const WIDE_SCREEN_BREAKPOINT = 900;

/** Largeur maximale d'une colonne de lecture sur grand écran. */
export const CONTENT_MAX_WIDTH = 720;
