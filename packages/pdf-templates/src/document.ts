import { accentChoices } from '@betterfit/shared';
import { esc, pdfStyles } from './styles.js';

/**
 * Le squelette d'un document et ses pages.
 *
 * Chaque page est un bloc de taille fixe : en-tête, contenu, pied. Le
 * découpage est **explicite** plutôt que laissé au navigateur, pour que le
 * PDF sorte identique partout — c'est tout l'intérêt de le générer côté
 * serveur plutôt que dans l'app.
 */

export type Branding = {
  /** Nom affiché du coach, ou de la personne pour son propre programme. */
  coachName: string;
  /** Contact affiché en pied de page. */
  contact: string;
  /** Couleur d'accent. Doit faire partie de `accentChoices`. */
  accent: string;
};

export const DEFAULT_BRANDING: Branding = {
  coachName: 'BetterFit',
  contact: '',
  accent: accentChoices[0],
};

/** Une couleur d'accent acceptable, ou celle par défaut. */
export function safeAccent(accent: string | null | undefined): string {
  return accentChoices.includes(accent as (typeof accentChoices)[number])
    ? accent!
    : accentChoices[0];
}

export type PageOptions = {
  eyebrow: string;
  title: string;
  /** Contenu de l'en-tête, à droite du titre. */
  headerRight?: string;
  body: string;
  branding: Branding;
  /** Nom de la personne et semaine, en haut à droite. */
  who: string;
  pageNumber: number;
  pageCount: number;
};

export function page(options: PageOptions): string {
  const { eyebrow, title, headerRight = '', body, branding, who, pageNumber, pageCount } = options;

  return `<section class="pg">
  <div class="pg-top">
    <div class="pg-bar">
      <div class="pg-logo">BETTER<span style="color:var(--accent)">FIT</span></div>
      <div class="pg-who">${esc(who)}</div>
    </div>
    <div style="display:flex;justify-content:space-between;align-items:flex-end;gap:24px">
      <div style="display:flex;flex-direction:column;gap:6px">
        <div class="pg-eyebrow">${esc(eyebrow)}</div>
        <h1 class="pg-title">${esc(title)}</h1>
      </div>
      ${headerRight}
    </div>
  </div>
  <div class="pg-main">${body}</div>
  <div class="pg-foot">
    <span><b>${esc(branding.coachName)}</b>${branding.contact ? ` · ${esc(branding.contact)}` : ''}</span>
    <span>${pageNumber} / ${pageCount}</span>
  </div>
</section>`;
}

/**
 * Assemble les pages en un document complet.
 *
 * Les polices viennent de Google Fonts. Si le serveur n'a pas accès au
 * réseau, le document reste lisible : les familles de secours sont déclarées
 * dans la feuille de style, et la mise en page ne dépend pas de la police.
 */
export function document(options: {
  title: string;
  accent: string;
  pages: string[];
}): string {
  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<title>${esc(options.title)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&family=Unbounded:wght@700;800&display=swap" rel="stylesheet">
<style>${pdfStyles(options.accent)}</style>
</head>
<body>
${options.pages.join('\n')}
</body>
</html>`;
}
