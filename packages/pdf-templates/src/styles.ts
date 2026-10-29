import { colors } from '@betterfit/shared';

/**
 * La feuille de style des documents imprimés.
 *
 * Reprise de `reference/prototype-studio.html`, qui fait foi pour la mise en
 * page. **Palette fixe** : un PDF ne connaît ni thème clair ni thème sombre,
 * et doit sortir identique sur toutes les imprimantes.
 *
 * Les pages font 794 × 1123 px, soit une A4 à 96 points par pouce.
 */

export const PAGE_WIDTH = 794;
export const PAGE_HEIGHT = 1123;

/** La couleur d'accent que le coach peut changer pour ses documents. */
export function pdfStyles(accent: string): string {
  return `
:root { --accent: ${accent}; }

* { box-sizing: border-box; }

body {
  margin: 0;
  font-family: 'Manrope', system-ui, -apple-system, sans-serif;
  color: ${colors.ink};
  font-size: 13px;
  line-height: 1.45;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}

h1, h2, h3, .disp {
  margin: 0;
  font-family: 'Unbounded', 'Arial Black', sans-serif;
  font-weight: 700;
}

.pg {
  width: ${PAGE_WIDTH}px;
  height: ${PAGE_HEIGHT}px;
  background: ${colors.paper};
  display: flex;
  flex-direction: column;
  overflow: hidden;
  position: relative;
  /* Chaque page occupe exactement une feuille. */
  page-break-after: always;
  break-after: page;
}

.pg:last-child { page-break-after: auto; break-after: auto; }

.pg-top { padding: 40px 56px 22px; display: flex; flex-direction: column; gap: 16px; }
.pg-bar { display: flex; justify-content: space-between; align-items: center; }
.pg-logo {
  font-family: 'Unbounded', 'Arial Black', sans-serif;
  font-weight: 800;
  font-size: 16px;
  letter-spacing: -0.4px;
  color: ${colors.night};
}
.pg-who { font-size: 12px; font-weight: 600; color: ${colors.muted}; }
.pg-eyebrow {
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 3px;
  text-transform: uppercase;
  color: var(--accent);
}
.pg-title { font-size: 34px; letter-spacing: -0.8px; line-height: 1.1; }
.pg-main { flex: 1 0 auto; padding: 0 56px; display: flex; flex-direction: column; gap: 18px; }
.pg-foot {
  padding: 16px 56px 26px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 11px;
  color: ${colors.muted};
}
.pg-foot b { color: var(--accent); }

.pg-card { background: ${colors.card}; border: 1px solid ${colors.cardBorder}; border-radius: 18px; padding: 18px 20px; }
.pg-soft { background: ${colors.accentSoft}; border-radius: 14px; padding: 14px 16px; }
.pg-dark { background: ${colors.night}; color: ${colors.onDark}; border-radius: 18px; padding: 18px 20px; }
.pg-lab { font-size: 11px; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase; color: var(--accent); }

.pg-chip {
  background: ${colors.night};
  color: ${colors.onDark};
  border-radius: 14px;
  padding: 12px 18px;
  display: flex;
  gap: 18px;
  font-size: 12px;
  font-weight: 600;
}
.pg-chip div { display: flex; flex-direction: column; gap: 2px; }
.pg-chip span:first-child { color: #B9A8E6; }
.pg-chip span:last-child { font-size: 15px; }

.grid { display: grid; gap: 12px; grid-template-columns: repeat(2, minmax(0, 1fr)); }
.grid.g3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
.grid.g4 { grid-template-columns: repeat(4, minmax(0, 1fr)); }

.num { font-family: 'Unbounded', 'Arial Black', sans-serif; font-weight: 700; font-variant-numeric: tabular-nums; }

table { width: 100%; border-collapse: collapse; font-size: 12px; }
th {
  text-align: left;
  font-size: 10px;
  letter-spacing: 1.2px;
  text-transform: uppercase;
  color: ${colors.muted};
  padding: 0 0 6px;
  font-weight: 700;
}
td { padding: 7px 0; border-top: 1px solid ${colors.cardBorder}; vertical-align: top; }
td.right, th.right { text-align: right; }

.muted { color: ${colors.muted}; }
.small { font-size: 11px; }
.cover { justify-content: center; align-items: center; text-align: center; gap: 24px; }

/*
  Les cercles violets qui débordent du bandeau sombre : c'est la signature
  visuelle de BetterFit, et elle doit survivre à l'impression.
*/
.pg-blob { position: absolute; border-radius: 50%; background: var(--accent); opacity: 0.55; }
`;
}

/** Échappe du texte pour l'insérer dans du HTML sans risque. */
export function esc(value: string | number | null | undefined): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
