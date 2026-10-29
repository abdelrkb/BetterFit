import { describe, expect, it } from 'vitest';
import { readdir, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { REPO_ROOT } from '../src/paths.js';

/**
 * Toutes les routes de l'app doivent être atteignables.
 *
 * Le 29 octobre 2026, masquer des écrans de la barre d'onglets avec
 * `href: null` ne les a pas masqués : ça les a **supprimés**. Cinq écrans
 * — séance guidée, historique, exercices, espace coach, démo — renvoyaient
 * sur l'accueil, et les tests de l'époque n'avaient rien vu parce qu'ils
 * vérifiaient la présence des boutons, pas leur destination.
 *
 * Ce test ne remplace pas un parcours dans un navigateur ; il interdit
 * seulement de reproduire exactement cette cause.
 */

const APP_DIR = resolve(REPO_ROOT, 'apps/app/app');

async function filesUnder(dir: string): Promise<string[]> {
  const entries = await readdir(dir);
  const found: string[] = [];

  for (const entry of entries) {
    const path = resolve(dir, entry);

    if ((await stat(path)).isDirectory()) {
      found.push(...(await filesUnder(path)));
    } else if (entry.endsWith('.tsx')) {
      found.push(path);
    }
  }

  return found;
}

describe('structure des routes de l’app', () => {
  it('n’utilise jamais `href: null` pour masquer un écran', async () => {
    const files = await filesUnder(APP_DIR);
    const offenders: string[] = [];

    for (const file of files) {
      const { readFile } = await import('node:fs/promises');
      const content = await readFile(file, 'utf8');

      // On ignore les commentaires : ce fichier et les deux `_layout`
      // expliquent justement pourquoi `href: null` est à proscrire.
      const code = content
        .split('\n')
        .filter((line) => !/^\s*(\*|\/\/)/.test(line))
        .join('\n');

      if (/href:\s*null/.test(code)) {
        offenders.push(file.replace(`${REPO_ROOT}/`, ''));
      }
    }

    expect(
      offenders,
      'Un écran masqué par `href: null` devient inatteignable : place-le dans la pile ' +
        'à côté des onglets, pas dans le navigateur d’onglets.',
    ).toEqual([]);
  });

  it('garde les quatre onglets, et eux seuls, dans le navigateur d’onglets', async () => {
    const { readFile } = await import('node:fs/promises');
    const layout = await readFile(resolve(APP_DIR, '(main)/(tabs)/_layout.tsx'), 'utf8');

    const declared = [...layout.matchAll(/<Tabs\.Screen\s+name="([^"]+)"/g)].map(
      (match) => match[1],
    );

    expect(declared).toEqual(['index', 'training', 'nutrition', 'profile']);
  });

  it('garde les écrans hors onglets dans la pile parente', async () => {
    const entries = await readdir(resolve(APP_DIR, '(main)'));

    // Ces dossiers doivent rester **à côté** de `(tabs)`, pas dedans.
    for (const name of ['workout', 'exercises', 'coach', 'demo.tsx']) {
      expect(entries, `${name} doit rester hors du navigateur d’onglets`).toContain(name);
    }
  });
});
