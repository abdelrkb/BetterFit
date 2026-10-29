import { dayTotals, targetsFromSettings, type NutritionProgram } from '@betterfit/shared';
import { describe, expect, it } from 'vitest';
import { renderNutritionPdf } from './nutrition.js';
import { esc } from './styles.js';

const settings: NutritionProgram['settings'] = {
  sex: 'female',
  age: 30,
  weightKg: 65,
  heightCm: 168,
  activityLevel: 'moderate',
  deficitKcal: 400,
  proteinGPerKg: 2,
  fatGPerKg: 0.9,
  fiberG: 30,
  waterLiters: null,
  goalTitle: 'Perte de gras',
  goalText: '',
  preferred: [],
  limited: [],
  coachNote: '',
  shoppingDays: 7,
  budgetCents: null,
};

function program(overrides: Partial<NutritionProgram> = {}): NutritionProgram {
  const meals = overrides.meals ?? [
    {
      id: 'm1',
      name: 'Déjeuner',
      time: '12h30',
      kcalOverride: null,
      items: [
        {
          id: 'i1',
          foodId: null,
          label: 'Riz basmati',
          quantity: '160 g',
          quantityG: 160,
          alternative: 'Pâtes',
          kcal: 187,
          proteinG: 4.4,
          carbsG: 39,
          fatG: 1,
        },
      ],
    },
  ];

  return {
    id: 'p',
    ownerId: 'o',
    title: 'Sèche de printemps',
    isTemplate: false,
    startDate: null,
    endDate: null,
    assignedToUserId: null,
    settings,
    targets: targetsFromSettings(settings),
    meals,
    shopping: [],
    recipeIds: [],
    dayTotals: dayTotals(meals),
    updatedAt: '2026-10-29T10:00:00.000Z',
    ...overrides,
  };
}

const branding = { coachName: 'Coach Abdel', contact: 'abdel@exemple.fr', accent: '#6B3FD9' };

describe('renderNutritionPdf', () => {
  it('rend les chiffres du prototype', () => {
    const html = renderNutritionPdf(program(), { branding });

    // Arrondis à la dizaine, comme le prototype. Le séparateur de milliers
    // est l'espace fine insécable (U+202F), celle qu'impose la typographie
    // française — et pas une espace ordinaire.
    expect(html).toContain('2\u202f150 kcal');
    expect(html).toContain('1\u202f750 kcal');
    expect(html).toContain('130 g');
  });

  it('compose une page par rubrique demandée', () => {
    const all = renderNutritionPdf(program(), { branding });
    const one = renderNutritionPdf(program(), { branding, pages: ['profile'] });

    expect(all.match(/<section class="pg">/g)).toHaveLength(4);
    expect(one.match(/<section class="pg">/g)).toHaveLength(1);
    // La numérotation suit le nombre de pages réellement incluses.
    expect(one).toContain('1 / 1');
  });

  it('affiche le total de la journée et son écart à la cible', () => {
    const html = renderNutritionPdf(program(), { branding, pages: ['day'] });

    expect(html).toContain('187 kcal');
    // 187 − 1 753 = −1 566.
    expect(html).toContain('−1\u202f566 kcal');
  });

  it('porte le nom du coach et son contact en pied de page', () => {
    const html = renderNutritionPdf(program(), { branding });

    expect(html).toContain('Coach Abdel');
    expect(html).toContain('abdel@exemple.fr');
  });

  it('refuse une couleur d’accent inventée', () => {
    // Une couleur arbitraire viendrait d'une donnée stockée : elle ne doit
    // pas pouvoir s'injecter dans la feuille de style.
    const html = renderNutritionPdf(program(), {
      branding: { ...branding, accent: 'red; } body { display:none } .x {' },
    });

    expect(html).not.toContain('display:none');
    expect(html).toContain('--accent: #6B3FD9');
  });

  it('échappe le texte saisi', () => {
    const html = renderNutritionPdf(
      program({ title: '<script>alert(1)</script>' }),
      { branding },
    );

    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('sort un document même sans repas ni courses', () => {
    const html = renderNutritionPdf(program({ meals: [], shopping: [] }), { branding });

    expect(html).toContain('Aucun repas');
    expect(html).toContain('Aucune liste de courses');
  });

  it('alerte sur un déficit trop grand', () => {
    const tooMuch = { ...settings, deficitKcal: 900 };

    const html = renderNutritionPdf(
      program({ settings: tooMuch, targets: targetsFromSettings(tooMuch) }),
      { branding, pages: ['deficit'] },
    );

    expect(html).toContain('trop important');
  });
});

describe('esc', () => {
  it('échappe tout ce qui peut casser le HTML', () => {
    expect(esc('<b>"a" & \'b\'</b>')).toBe('&lt;b&gt;&quot;a&quot; &amp; &#39;b&#39;&lt;/b&gt;');
  });

  it('rend une chaîne vide pour rien', () => {
    expect(esc(null)).toBe('');
    expect(esc(undefined)).toBe('');
  });
});
