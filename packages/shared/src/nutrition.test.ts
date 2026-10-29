import { describe, expect, it } from 'vitest';
import {
  basalMetabolicRate,
  computeNutritionTargets,
  kcalFromMacros,
  macrosForQuantity,
  sumMacros,
  type NutritionInput,
} from './nutrition.js';

/** Le cas de référence : Julie, tel que le prototype le calcule. */
const julie: NutritionInput = {
  sex: 'female',
  age: 34,
  weightKg: 68.4,
  heightCm: 168,
  activityLevel: 'moderate',
  deficitKcal: 400,
  proteinGPerKg: 1.8,
  fatGPerKg: 0.9,
  waterLiters: null,
};

describe('basalMetabolicRate', () => {
  it('applique Mifflin-St Jeor pour une femme', () => {
    // 10×68,4 + 6,25×168 − 5×34 − 161 = 684 + 1050 − 170 − 161
    expect(basalMetabolicRate(julie)).toBeCloseTo(1403, 0);
  });

  it('ajoute 5 au lieu de retirer 161 pour un homme', () => {
    const difference = basalMetabolicRate({ ...julie, sex: 'male' }) - basalMetabolicRate(julie);

    expect(difference).toBe(166);
  });
});

describe('computeNutritionTargets', () => {
  const targets = computeNutritionTargets(julie);

  it('multiplie le métabolisme de base par le coefficient d’activité', () => {
    // « Actif » vaut 1,55 : 1403 × 1,55 ≈ 2175
    expect(targets.maintenanceKcal).toBeCloseTo(2175, 0);
  });

  it('retire le déficit pour obtenir la cible', () => {
    expect(targets.targetKcal).toBe(targets.maintenanceKcal - 400);
  });

  it('calcule protéines et lipides par kilo, les glucides avec le reste', () => {
    expect(targets.proteinG).toBeCloseTo(123, 0);
    expect(targets.fatG).toBeCloseTo(62, 0);

    // Les trois macros redonnent la cible calorique, à l'arrondi près : on
    // affiche des grammes entiers, ce qui fait dériver le total de quelques
    // kilocalories. Mieux vaut « 123 g » que « 122,7 g » sur un plan.
    const reconstituted = targets.proteinG * 4 + targets.fatG * 9 + targets.carbsG * 4;
    expect(Math.abs(reconstituted - targets.targetKcal)).toBeLessThan(10);
  });

  it('estime le rythme à 7 700 kcal par kilo', () => {
    // 400 × 7 / 7700 ≈ 0,36 kg par semaine
    expect(targets.kgPerWeek).toBeCloseTo(0.36, 2);
  });

  it('conseille 35 ml d’eau par kilo', () => {
    expect(targets.waterLiters).toBeCloseTo(2.4, 1);
  });

  it('n’alerte pas sur un déficit raisonnable', () => {
    expect(targets.deficitTooLarge).toBe(false);
  });

  it('alerte au-delà de 25 % du maintien', () => {
    const aggressive = computeNutritionTargets({ ...julie, deficitKcal: 900 });

    expect(aggressive.deficitPct).toBeGreaterThan(25);
    expect(aggressive.deficitTooLarge).toBe(true);
  });

  it('gère un surplus : déficit négatif, prise de poids', () => {
    const surplus = computeNutritionTargets({ ...julie, deficitKcal: -300 });

    expect(surplus.targetKcal).toBeGreaterThan(surplus.maintenanceKcal);
    expect(surplus.kgPerWeek).toBeLessThan(0);
    expect(surplus.deficitTooLarge).toBe(false);
  });

  it('ne descend jamais sous zéro gramme de glucides', () => {
    const extreme = computeNutritionTargets({
      ...julie,
      deficitKcal: 1200,
      proteinGPerKg: 3,
      fatGPerKg: 2,
    });

    expect(extreme.carbsG).toBe(0);
  });
});

describe('macrosForQuantity', () => {
  it('met à l’échelle depuis les valeurs pour 100 g', () => {
    const rice = { kcal: 350, proteinG: 7.5, carbsG: 78, fatG: 0.6 };

    expect(macrosForQuantity(rice, 160)).toEqual({
      kcal: 560,
      proteinG: 12,
      carbsG: 124.8,
      fatG: 1,
    });
  });
});

describe('sumMacros', () => {
  it('additionne plusieurs lignes', () => {
    const total = sumMacros([
      { kcal: 560, proteinG: 12, carbsG: 124.8, fatG: 1 },
      { kcal: 165, proteinG: 31, carbsG: 0, fatG: 3.6 },
    ]);

    expect(total.kcal).toBe(725);
    expect(total.proteinG).toBeCloseTo(43, 1);
  });

  it('tolère des lignes incomplètes', () => {
    expect(sumMacros([{ kcal: 100 }, {}]).kcal).toBe(100);
  });
});

describe('kcalFromMacros', () => {
  it('reconstitue les calories quand elles manquent', () => {
    expect(kcalFromMacros({ proteinG: 10, carbsG: 20, fatG: 5 })).toBe(165);
  });
});
