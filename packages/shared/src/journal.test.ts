import { describe, expect, it } from 'vitest';
import { journalTotals, shiftDate, today, totalsBySlot, type MealSlot } from './journal.js';

function entry(kcal: number | null, slot: MealSlot = 'lunch', macros = {}) {
  return { kcal, proteinG: null, carbsG: null, fatG: null, slot, ...macros };
}

describe('journalTotals', () => {
  it('additionne les lignes', () => {
    const totals = journalTotals([
      { kcal: 208, proteinG: 4.3, carbsG: 44.8, fatG: 0.5 },
      { kcal: 165, proteinG: 31, carbsG: 0, fatG: 3.6 },
    ]);

    expect(totals.kcal).toBe(373);
    expect(totals.proteinG).toBeCloseTo(35.3, 1);
  });

  it('compte zéro pour une ligne sans valeurs', () => {
    // Une saisie rapide sans calories ne doit pas casser le total.
    const totals = journalTotals([entry(300), entry(null)]);

    expect(totals.kcal).toBe(300);
  });

  it('rend zéro pour une journée vide', () => {
    expect(journalTotals([])).toEqual({ kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 });
  });
});

describe('totalsBySlot', () => {
  it('sépare les quatre moments', () => {
    const totals = totalsBySlot([
      entry(400, 'breakfast'),
      entry(700, 'lunch'),
      entry(150, 'snack'),
      entry(100, 'snack'),
    ]);

    expect(totals.breakfast.kcal).toBe(400);
    expect(totals.lunch.kcal).toBe(700);
    expect(totals.dinner.kcal).toBe(0);
    expect(totals.snack.kcal).toBe(250);
  });

  it('donne les quatre moments même pour une journée vide', () => {
    const totals = totalsBySlot([]);

    expect(Object.keys(totals)).toHaveLength(4);
    expect(totals.dinner.kcal).toBe(0);
  });
});

describe('today', () => {
  it('rend la date locale, pas la date UTC', () => {
    // Le 1er janvier à 1 h du matin à Paris, il est encore le 31 décembre à
    // Londres : compter en UTC daterait le petit-déjeuner de la veille.
    const localMidnight = new Date(2026, 0, 1, 1, 0, 0);

    expect(today(localMidnight)).toBe('2026-01-01');
  });
});

describe('shiftDate', () => {
  it('avance et recule d’un jour', () => {
    expect(shiftDate('2026-10-29', 1)).toBe('2026-10-30');
    expect(shiftDate('2026-10-29', -1)).toBe('2026-10-28');
  });

  it('passe les fins de mois et les années', () => {
    expect(shiftDate('2026-10-31', 1)).toBe('2026-11-01');
    expect(shiftDate('2026-12-31', 1)).toBe('2027-01-01');
    expect(shiftDate('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('passe le 29 février d’une année bissextile', () => {
    expect(shiftDate('2028-02-28', 1)).toBe('2028-02-29');
  });
});
