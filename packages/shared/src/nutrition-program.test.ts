import { describe, expect, it } from 'vitest';
import {
  dayTotals,
  mealTotals,
  priceKey,
  roundToTen,
  shoppingPriceCoverage,
  shoppingTotalCents,
  targetsFromSettings,
  type Meal,
  type NutritionSettings,
} from './nutrition-program.js';

/** Le client exemple du prototype : femme, 30 ans, 65 kg, 168 cm, 1,55. */
const julie: NutritionSettings = {
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

function meal(overrides: Partial<Meal> = {}): Meal {
  return {
    name: 'Déjeuner',
    time: '12h30',
    kcalOverride: null,
    items: [],
    ...overrides,
  };
}

describe('targetsFromSettings', () => {
  it('retrouve les chiffres du prototype pour le client exemple', () => {
    const targets = targetsFromSettings(julie);

    // 10 × 65 + 6,25 × 168 − 5 × 30 − 161 = 1 389
    expect(targets.bmrKcal).toBe(1389);
    // 1 389 × 1,55 = 2 152,95 → 2 153
    expect(targets.maintenanceKcal).toBe(2153);
    // 2 152,95 − 400 = 1 752,95 → 1 753
    expect(targets.targetKcal).toBe(1753);
    // 2 g/kg × 65 = 130 ; 0,9 × 65 = 58,5, affiché 59 comme le prototype,
    // qui arrondit les grammes à l'entier.
    expect(targets.proteinG).toBe(130);
    expect(targets.fatG).toBe(59);
    // (1 752,95 − 130×4 − 58,5×9) / 4 = 176,6 → 177. Les glucides se
    // calculent sur les valeurs **non arrondies** : arrondir d'abord ferait
    // dériver le total de plusieurs kcal.
    expect(targets.carbsG).toBe(177);
    // 400 × 7 / 7 700 = 0,36 kg par semaine
    expect(targets.kgPerWeek).toBeCloseTo(0.36, 2);
    // 65 × 35 ml = 2,3 litres
    expect(targets.waterLiters).toBeCloseTo(2.3, 1);
    expect(targets.deficitTooLarge).toBe(false);
  });

  it('alerte quand le déficit dépasse un quart du maintien', () => {
    // 2 153 × 0,25 ≈ 538 : 700 est clairement au-dessus.
    expect(targetsFromSettings({ ...julie, deficitKcal: 700 }).deficitTooLarge).toBe(true);
  });

  it('accepte un surplus, pour une prise de masse', () => {
    const targets = targetsFromSettings({ ...julie, deficitKcal: -300 });

    expect(targets.targetKcal).toBeGreaterThan(targets.maintenanceKcal);
    expect(targets.kgPerWeek).toBeLessThan(0);
    expect(targets.deficitTooLarge).toBe(false);
  });
});

describe('mealTotals', () => {
  it('additionne les lignes', () => {
    const totals = mealTotals(
      meal({
        items: [
          { label: 'Riz', quantity: '160 g', kcal: 208, proteinG: 4.3, carbsG: 45, fatG: 0.5 },
          { label: 'Poulet', quantity: '150 g', kcal: 248, proteinG: 46, carbsG: 0, fatG: 5.4 },
        ].map(withDefaults),
      }),
    );

    expect(totals.kcal).toBe(456);
    expect(totals.proteinG).toBeCloseTo(50.3, 1);
    expect(totals.carbsG).toBe(45);
    expect(totals.fatG).toBeCloseTo(5.9, 1);
  });

  it('reconstitue les calories d’une ligne qui n’a que ses macros', () => {
    const totals = mealTotals(
      meal({
        items: [withDefaults({ label: 'Fromage blanc', proteinG: 20, carbsG: 8, fatG: 0 })],
      }),
    );

    // 20×4 + 8×4 = 112
    expect(totals.kcal).toBe(112);
  });

  it('laisse les calories saisies à la main l’emporter sur la somme', () => {
    const totals = mealTotals(
      meal({
        kcalOverride: 500,
        items: [withDefaults({ label: 'Riz', kcal: 208, proteinG: 4.3, carbsG: 45, fatG: 0.5 })],
      }),
    );

    expect(totals.kcal).toBe(500);
    // Les macros restent celles des lignes : on n'invente pas une
    // répartition à partir d'un total.
    expect(totals.proteinG).toBeCloseTo(4.3, 1);
  });

  it('ne compte rien pour une ligne en texte libre sans valeurs', () => {
    const totals = mealTotals(
      meal({ items: [withDefaults({ label: 'Légumes', quantity: 'à volonté' })] }),
    );

    expect(totals).toEqual({ kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 });
  });
});

describe('dayTotals', () => {
  it('additionne les repas', () => {
    const totals = dayTotals([
      meal({ kcalOverride: 500 }),
      meal({ kcalOverride: 700 }),
      meal({ items: [withDefaults({ label: 'Pomme', kcal: 95, carbsG: 25 })] }),
    ]);

    expect(totals.kcal).toBe(1295);
    expect(totals.carbsG).toBe(25);
  });

  it('rend zéro pour une journée vide', () => {
    expect(dayTotals([])).toEqual({ kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 });
  });
});

describe('liste de courses', () => {
  const categories = [
    {
      items: [
        { ...emptyShopping, label: 'Blanc de poulet', priceCents: 899 },
        { ...emptyShopping, label: 'Riz basmati', priceCents: 250 },
        { ...emptyShopping, label: 'Brocoli', priceCents: null },
        // Une ligne vide : elle ne compte pas dans la couverture.
        { ...emptyShopping, label: '' },
      ],
    },
  ];

  it('additionne le coût', () => {
    expect(shoppingTotalCents(categories)).toBe(1149);
  });

  it('dit combien d’articles ont un prix', () => {
    expect(shoppingPriceCoverage(categories)).toEqual({ priced: 2, named: 3 });
  });

  it('rend zéro pour une liste vide', () => {
    expect(shoppingTotalCents([])).toBe(0);
    expect(shoppingPriceCoverage([])).toEqual({ priced: 0, named: 0 });
  });
});

describe('priceKey', () => {
  it('ignore la casse, les accents et les espaces en trop', () => {
    expect(priceKey('  Blanc de   Poulet ')).toBe('blanc de poulet');
    expect(priceKey('Crème fraîche')).toBe(priceKey('CREME FRAICHE'));
  });
});

describe('roundToTen', () => {
  it('arrondit à la dizaine, comme le prototype', () => {
    expect(roundToTen(1753)).toBe(1750);
    expect(roundToTen(1755)).toBe(1760);
  });
});

const emptyShopping = {
  label: '',
  quantity: '',
  checked: false,
  priceCents: null as number | null,
  store: '',
};

/** Complète une ligne de repas avec les valeurs par défaut du schéma. */
function withDefaults(item: {
  label: string;
  quantity?: string;
  kcal?: number;
  proteinG?: number;
  carbsG?: number;
  fatG?: number;
}) {
  return {
    foodId: null,
    quantity: '',
    quantityG: null,
    alternative: '',
    kcal: null,
    proteinG: null,
    carbsG: null,
    fatG: null,
    ...item,
  };
}
