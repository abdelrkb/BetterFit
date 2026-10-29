/**
 * Rendu des formes en chaîne SVG.
 *
 * Sert aux gabarits PDF (étape 10), qui sont du HTML généré côté serveur, et
 * aux tests de fidélité par rapport au prototype d'origine.
 */

import {
  buildMascot,
  groupTransform,
  MASCOT_VIEWBOX_SIZE,
  type MascotTone,
  type Shape,
} from './geometry.js';
import type { PoseName } from './poses.js';

/** Même formatage que le prototype, pour que les deux rendus soient comparables. */
function f(value: number): string {
  return value.toFixed(1);
}

function shapeToSvg(shape: Shape): string {
  switch (shape.kind) {
    case 'line':
      return (
        `<line x1="${f(shape.x1)}" y1="${f(shape.y1)}" x2="${f(shape.x2)}" y2="${f(shape.y2)}"` +
        ` stroke="${shape.color}" stroke-width="${shape.width}" stroke-linecap="round"/>`
      );
    case 'circle': {
      // `cx`/`cy` valent 0 par défaut en SVG : on les omet alors, comme le
      // prototype, pour que les deux rendus restent comparables au caractère près.
      const center =
        shape.cx === 0 && shape.cy === 0 ? '' : ` cx="${f(shape.cx)}" cy="${f(shape.cy)}"`;

      return `<circle${center} r="${shape.r}" fill="${shape.fill}"/>`;
    }
    case 'ellipse':
      return (
        `<ellipse cx="${f(shape.cx)}" cy="${f(shape.cy)}" rx="${shape.rx}" ry="${shape.ry}"` +
        ` fill="${shape.fill}"${shape.opacity === undefined ? '' : ` opacity="${shape.opacity}"`}/>`
      );
    case 'rect':
      return (
        `<rect x="${f(shape.x)}" y="${f(shape.y)}" width="${f(shape.width)}" height="${f(shape.height)}"` +
        `${shape.rx === undefined ? '' : ` rx="${shape.rx}"`} fill="${shape.fill}"/>`
      );
    case 'path':
      return (
        `<path d="${shape.d}" fill="none" stroke="${shape.stroke}"` +
        ` stroke-width="${shape.width}" stroke-linecap="round"/>`
      );
    case 'group':
      return `<g transform="${groupTransform(shape)}">${shape.children.map(shapeToSvg).join('')}</g>`;
  }
}

/**
 * Dessine la mascotte en SVG. `label` rend l'image accessible aux lecteurs
 * d'écran ; sans lui, l'image est marquée comme décorative.
 */
export function mascotToSvgString(
  pose: PoseName,
  size: number,
  label?: string,
  tone: MascotTone = 'default',
): string {
  const { shapes } = buildMascot(pose, tone);
  const accessibility = label ? `role="img" aria-label="${label}"` : 'aria-hidden="true"';

  return (
    `<svg width="${size}" height="${size}"` +
    ` viewBox="0 0 ${MASCOT_VIEWBOX_SIZE} ${MASCOT_VIEWBOX_SIZE}" ${accessibility}>` +
    `${shapes.map(shapeToSvg).join('')}</svg>`
  );
}
