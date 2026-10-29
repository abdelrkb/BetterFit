import {
  MACRO_PDF_COLORS,
  formatPrice,
  mealTotals,
  roundToTen,
  shoppingTotalCents,
  type NutritionProgram,
} from '@betterfit/shared';
import { mascotToSvgString } from '@betterfit/mascot/svg';
import { document, page, safeAccent, type Branding } from './document.js';
import { esc } from './styles.js';

/**
 * Le PDF d'un programme de nutrition.
 *
 * Les cinq pages du prototype, au choix : profil et objectifs, journée type,
 * le déficit calorique, liste de courses, recette. On ne compose que les
 * pages demandées, et la numérotation suit.
 */

export type NutritionPdfPage = 'profile' | 'day' | 'deficit' | 'shopping';

export const NUTRITION_PDF_PAGES: readonly NutritionPdfPage[] = [
  'profile',
  'day',
  'deficit',
  'shopping',
];

export const NUTRITION_PAGE_LABELS_FR: Record<NutritionPdfPage, string> = {
  profile: 'Profil et objectifs',
  day: 'Journée type',
  deficit: 'Le déficit calorique',
  shopping: 'Liste de courses',
};

/** Nombre, à la française : virgule décimale et espace fine pour les milliers. */
function fr(value: number, digits = 0): string {
  return value.toLocaleString('fr-FR', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function profilePage(program: NutritionProgram): string {
  const { settings, targets } = program;

  const macros = [
    { label: 'Protéines', grams: targets.proteinG, pct: targets.proteinPct, color: MACRO_PDF_COLORS.protein },
    { label: 'Glucides', grams: targets.carbsG, pct: targets.carbsPct, color: MACRO_PDF_COLORS.carbs },
    { label: 'Lipides', grams: targets.fatG, pct: targets.fatPct, color: MACRO_PDF_COLORS.fat },
  ];

  return `
<div class="pg-chip">
  <div><span>Maintien</span><span class="num">${fr(roundToTen(targets.maintenanceKcal))} kcal</span></div>
  <div><span>Objectif</span><span class="num">${fr(roundToTen(targets.targetKcal))} kcal</span></div>
  <div><span>Rythme</span><span class="num">${fr(Math.abs(targets.kgPerWeek), 2)} kg / sem.</span></div>
  <div><span>Eau</span><span class="num">${fr(targets.waterLiters, 1)} L</span></div>
</div>

<div class="pg-card">
  <div class="pg-lab">Ta répartition</div>
  <div class="grid g3" style="margin-top:12px">
    ${macros
      .map(
        (macro) => `<div class="pg-soft">
      <!--
        La couleur identifie la macro par une barre, elle ne porte jamais le
        texte : le lilas des lipides sur fond violet pâle tombait très en
        dessous du contraste de 4,5:1.
      -->
      <div style="height:4px;width:36px;border-radius:2px;background:${macro.color}"></div>
      <div class="num" style="font-size:22px;margin-top:8px">${fr(macro.grams)} g</div>
      <div class="small muted">${esc(macro.label)} · ${macro.pct} %</div>
    </div>`,
      )
      .join('')}
  </div>
</div>

${
  settings.goalTitle || settings.goalText
    ? `<div class="pg-card">
  <div class="pg-lab">L'objectif</div>
  ${settings.goalTitle ? `<h2 style="font-size:20px;margin-top:6px">${esc(settings.goalTitle)}</h2>` : ''}
  ${settings.goalText ? `<p style="margin:8px 0 0">${esc(settings.goalText)}</p>` : ''}
</div>`
    : ''
}

${
  settings.preferred.length > 0 || settings.limited.length > 0
    ? `<div class="grid">
  ${list('À privilégier', settings.preferred)}
  ${list('À limiter', settings.limited)}
</div>`
    : ''
}

${
  settings.coachNote
    ? `<div class="pg-dark">
  <div class="pg-lab" style="color:#B9A8E6">Le mot du coach</div>
  <p style="margin:8px 0 0">${esc(settings.coachNote)}</p>
</div>`
    : ''
}`;
}

function list(title: string, items: string[]): string {
  if (items.length === 0) return '<div></div>';

  return `<div class="pg-card">
  <div class="pg-lab">${esc(title)}</div>
  <ul style="margin:8px 0 0;padding-left:18px">
    ${items.map((item) => `<li>${esc(item)}</li>`).join('')}
  </ul>
</div>`;
}

function dayPage(program: NutritionProgram): string {
  if (program.meals.length === 0) {
    return '<div class="pg-card"><p class="muted">Aucun repas dans ce programme.</p></div>';
  }

  const totals = program.dayTotals;
  const gap = totals.kcal - program.targets.targetKcal;

  // Le total comparé à la cible : c'est le premier chiffre qu'un coach
  // regarde pour savoir si la journée tient debout.
  const header = `<div class="pg-chip">
  <div><span>Total prévu</span><span class="num">${fr(totals.kcal)} kcal</span></div>
  <div><span>Objectif</span><span class="num">${fr(roundToTen(program.targets.targetKcal))} kcal</span></div>
  <div><span>Écart</span><span class="num">${gap >= 0 ? '+' : '−'}${fr(Math.abs(gap))} kcal</span></div>
  <div><span>P / G / L</span><span class="num">${fr(totals.proteinG)} · ${fr(totals.carbsG)} · ${fr(totals.fatG)} g</span></div>
</div>`;

  return header + program.meals
    .map((meal) => {
      const totals = mealTotals(meal);

      return `<div class="pg-card">
  <div style="display:flex;justify-content:space-between;align-items:baseline;gap:12px">
    <h2 style="font-size:17px">${esc(meal.name)}${meal.time ? ` <span class="muted small" style="font-family:'Manrope',sans-serif;font-weight:600">${esc(meal.time)}</span>` : ''}</h2>
    ${totals.kcal > 0 ? `<span class="num" style="color:var(--accent)">${fr(totals.kcal)} kcal</span>` : ''}
  </div>
  ${
    meal.items.length === 0
      ? '<p class="muted small" style="margin:8px 0 0">À compléter.</p>'
      : `<table style="margin-top:10px">
    <tr><th>Aliment</th><th>Quantité</th><th>Alternative</th><th class="right">kcal</th></tr>
    ${meal.items
      .map(
        (item) => `<tr>
      <td>${esc(item.label)}</td>
      <td class="muted">${esc(item.quantity)}</td>
      <td class="muted">${esc(item.alternative)}</td>
      <td class="right num">${item.kcal === null ? '—' : fr(item.kcal)}</td>
    </tr>`,
      )
      .join('')}
  </table>`
  }
</div>`;
    })
    .join('');
}

function deficitPage(program: NutritionProgram): string {
  const { targets } = program;

  const steps = [
    {
      value: roundToTen(targets.bmrKcal),
      label: 'Au repos',
      hint: 'Ce que ton corps brûle rien qu’à exister.',
    },
    {
      value: roundToTen(targets.maintenanceKcal),
      label: 'Ton maintien',
      hint: 'Avec ton activité : ce que tu dépenses vraiment.',
    },
    {
      value: roundToTen(targets.targetKcal),
      label: 'Ton objectif',
      hint: 'Ce que tu manges pour avancer.',
    },
  ];

  const rules = [
    [
      'Des protéines à chaque repas',
      `Vise environ ${fr(targets.proteinG)} g par jour : elles protègent tes muscles et calent plus longtemps.`,
    ],
    [
      'Lentement, mais sans reprendre',
      'Un déficit modéré tenu trois mois bat toujours un régime sévère tenu trois semaines.',
    ],
    [
      'Bois avant d’avoir soif',
      `Environ ${fr(targets.waterLiters, 1)} litres par jour. La soif se confond souvent avec la faim.`,
    ],
    [
      'Dors',
      'Une nuit courte augmente l’appétit le lendemain. Le sommeil fait partie du programme.',
    ],
  ];

  return `
<div class="grid g3">
  ${steps
    .map(
      (step) => `<div class="pg-card">
    <div class="num" style="font-size:26px">${fr(step.value)}</div>
    <div class="pg-lab" style="margin-top:4px">${esc(step.label)}</div>
    <p class="small muted" style="margin:6px 0 0">${esc(step.hint)}</p>
  </div>`,
    )
    .join('')}
</div>

${
  targets.deficitTooLarge
    ? `<div class="pg-soft" style="border-left:4px solid #9A5B00">
  <b>Ce déficit est trop important.</b> Au-delà d’un quart du maintien, on perd du muscle et on
  reprend presque toujours.
</div>`
    : ''
}

<div class="pg-card">
  <div class="pg-lab">Les quatre règles qui comptent</div>
  ${rules
    .map(
      ([title, body]) => `<div style="margin-top:12px">
    <h3 style="font-size:15px">${esc(title!)}</h3>
    <p style="margin:4px 0 0">${esc(body!)}</p>
  </div>`,
    )
    .join('')}
</div>

<div class="pg-soft" style="display:flex;gap:16px;align-items:center">
  <div style="flex:0 0 88px">${mascotToSvgString('stand', 88)}</div>
  <div>
    <h3 style="font-size:15px">La balance ment, la tendance dit vrai</h3>
    <p style="margin:4px 0 0">
      Ton poids bouge d’un kilo d’un jour à l’autre rien qu’avec l’eau.
      Ne regarde que la courbe sur sept jours.
    </p>
  </div>
</div>`;
}

function shoppingPage(program: NutritionProgram): string {
  if (program.shopping.length === 0) {
    return '<div class="pg-card"><p class="muted">Aucune liste de courses.</p></div>';
  }

  const total = shoppingTotalCents(program.shopping);

  return `
<div class="pg-chip">
  <div><span>Pour</span><span class="num">${program.settings.shoppingDays} jours</span></div>
  ${total > 0 ? `<div><span>Estimation</span><span class="num">${esc(formatPrice(total))}</span></div>` : ''}
  ${
    program.settings.budgetCents !== null
      ? `<div><span>Budget</span><span class="num">${esc(formatPrice(program.settings.budgetCents))}</span></div>`
      : ''
  }
</div>

<div class="grid">
  ${program.shopping
    .map((category) => {
      const items = category.items.filter((item) => item.label.trim().length > 0);
      if (items.length === 0) return '';

      return `<div class="pg-card">
    <div class="pg-lab">${esc(category.name)}</div>
    <table style="margin-top:8px">
      ${items
        .map(
          (item) => `<tr>
        <td>☐ ${esc(item.label)}</td>
        <td class="right muted">${esc(item.quantity)}</td>
        <td class="right num">${item.priceCents === null ? '' : esc(formatPrice(item.priceCents))}</td>
      </tr>`,
        )
        .join('')}
    </table>
  </div>`;
    })
    .join('')}
</div>`;
}

export type NutritionPdfOptions = {
  branding: Branding;
  /** Les pages à inclure, dans l'ordre. */
  pages?: readonly NutritionPdfPage[];
  /** Nom de la personne à qui le programme s'adresse. */
  clientName?: string;
};

export function renderNutritionPdf(
  program: NutritionProgram,
  options: NutritionPdfOptions,
): string {
  const accent = safeAccent(options.branding.accent);
  const branding = { ...options.branding, accent };
  const chosen = options.pages ?? NUTRITION_PDF_PAGES;

  const who = options.clientName ?? '';

  const bodies: { page: NutritionPdfPage; eyebrow: string; title: string; body: string }[] = [];

  for (const name of chosen) {
    if (name === 'profile') {
      bodies.push({
        page: name,
        eyebrow: 'Programme nutrition',
        title: program.title,
        body: profilePage(program),
      });
    }
    if (name === 'day') {
      bodies.push({
        page: name,
        eyebrow: 'Journée type',
        title: 'Ce que tu manges',
        body: dayPage(program),
      });
    }
    if (name === 'deficit') {
      bodies.push({
        page: name,
        eyebrow: 'Comprendre',
        title: 'Le déficit calorique',
        body: deficitPage(program),
      });
    }
    if (name === 'shopping') {
      bodies.push({
        page: name,
        eyebrow: 'Courses',
        title: 'Ta liste',
        body: shoppingPage(program),
      });
    }
  }

  const pages = bodies.map((entry, index) =>
    page({
      eyebrow: entry.eyebrow,
      title: entry.title,
      body: entry.body,
      branding,
      who,
      pageNumber: index + 1,
      pageCount: bodies.length,
    }),
  );

  return document({ title: program.title, accent, pages });
}
