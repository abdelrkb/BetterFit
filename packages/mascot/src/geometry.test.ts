/**
 * Test de fidélité : le portage doit dessiner exactement la même mascotte que
 * le prototype d'origine. On exécute `reference/mascot.js` tel quel et on
 * compare, pose par pose, toutes les coordonnées produites.
 */

import { readFileSync } from 'node:fs';
import { createContext, runInContext } from 'node:vm';
import { describe, expect, it } from 'vitest';
import { POSE_NAMES, POSES, type PoseName } from './poses.js';
import { mascotToSvgString } from './svg.js';
import { buildMascot, MASCOT_GROUND_Y } from './geometry.js';

type ReferenceModule = {
  mascotSVG: (pose: string, size: number, label?: string) => string;
  POSES: Record<string, { label: string }>;
};

function loadReference(): ReferenceModule {
  const source = readFileSync(new URL('../../../reference/mascot.js', import.meta.url), 'utf8');
  const context = createContext({ Math, String, Object });
  runInContext(`${source}\nthis.__exports = { mascotSVG, POSES };`, context);

  return (context as { __exports: ReferenceModule }).__exports;
}

const reference = loadReference();

/** Les couleurs sont en hexadécimal : on les retire avant de lire les nombres. */
function numbersOf(svg: string): number[] {
  return (svg.replace(/#[0-9A-Fa-f]{6}/g, '').match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
}

describe('fidélité au prototype', () => {
  it('connaît exactement les mêmes poses', () => {
    expect(POSE_NAMES.sort()).toEqual(Object.keys(reference.POSES).sort());
  });

  it.each(POSE_NAMES)('dessine la pose « %s » aux mêmes coordonnées', (pose) => {
    const ours = numbersOf(mascotToSvgString(pose, 100));
    const theirs = numbersOf(reference.mascotSVG(pose, 100));

    expect(ours).toHaveLength(theirs.length);

    for (const [index, value] of ours.entries()) {
      // Tolérance : le prototype arrondit à l'affichage, nous au calcul.
      expect(Math.abs(value - theirs[index]!), `nombre ${index} de la pose ${pose}`).toBeLessThan(
        0.06,
      );
    }
  });

  it('reprend les mêmes libellés français', () => {
    for (const pose of POSE_NAMES) {
      expect(POSES[pose].label).toBe(reference.POSES[pose]!.label);
    }
  });
});

describe('buildMascot', () => {
  it.each(POSE_NAMES)('garde la pose « %s » dans le cadre', (pose) => {
    const { shapes } = buildMascot(pose);
    const flat = JSON.stringify(shapes);

    expect(flat.length).toBeGreaterThan(0);
    // La hanche reste au-dessus du sol pour toutes les poses debout ou au sol.
    expect(POSES[pose].hip[1]).toBeLessThan(MASCOT_GROUND_Y);
  });

  it('ne dessine jamais d’yeux : la tête n’a que l’oreille, le crâne et le museau', () => {
    for (const pose of POSE_NAMES) {
      const head = buildMascot(pose).shapes.find(
        (shape) => shape.kind === 'group' && shape.translate !== undefined,
      );

      expect(head?.kind).toBe('group');
      if (head?.kind !== 'group') continue;

      const circles = head.children.filter((shape) => shape.kind === 'circle');
      // Oreille (externe + interne) et crâne : trois cercles, pas un de plus.
      expect(circles).toHaveLength(3);
    }
  });
});

describe('mascotToSvgString', () => {
  it('marque l’image comme décorative sans libellé', () => {
    expect(mascotToSvgString('stand', 96)).toContain('aria-hidden="true"');
  });

  it('expose le libellé aux lecteurs d’écran quand il est fourni', () => {
    const svg = mascotToSvgString('squat' satisfies PoseName, 96, 'Squat');

    expect(svg).toContain('role="img"');
    expect(svg).toContain('aria-label="Squat"');
  });
});
