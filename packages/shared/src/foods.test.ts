import { describe, expect, it } from 'vitest';
import { buildFoodSearchText, gramsFromText, macrosForFood } from './foods.js';

const emptyNutrients = {
  kcal: null,
  proteinG: null,
  carbsG: null,
  sugarsG: null,
  fatG: null,
  saturatedFatG: null,
  fiberG: null,
  saltG: null,
};

describe('macrosForFood', () => {
  it('ramène les valeurs pour 100 g à la quantité demandée', () => {
    // Riz basmati cuit : 130 kcal pour 100 g.
    const riz = { ...emptyNutrients, kcal: 130, proteinG: 2.7, carbsG: 28, fatG: 0.3 };

    const totals = macrosForFood(riz, 160);

    expect(totals.kcal).toBe(208);
    expect(totals.proteinG).toBeCloseTo(4.3, 1);
    expect(totals.carbsG).toBeCloseTo(44.8, 1);
    expect(totals.fatG).toBeCloseTo(0.5, 1);
  });

  it('compte zéro pour un aliment sans valeurs', () => {
    expect(macrosForFood(emptyNutrients, 200)).toEqual({
      kcal: 0,
      proteinG: 0,
      carbsG: 0,
      fatG: 0,
    });
  });

  it('rend zéro pour une quantité nulle', () => {
    const riz = { ...emptyNutrients, kcal: 130, proteinG: 2.7, carbsG: 28, fatG: 0.3 };

    expect(macrosForFood(riz, 0).kcal).toBe(0);
  });
});

describe('gramsFromText', () => {
  it('comprend les grammes, avec ou sans espace', () => {
    expect(gramsFromText('160 g')).toBe(160);
    expect(gramsFromText('160g')).toBe(160);
    expect(gramsFromText('160')).toBe(160);
  });

  it('comprend les kilos et la virgule française', () => {
    expect(gramsFromText('1,5 kg')).toBe(1500);
  });

  it('comprend les volumes courants', () => {
    expect(gramsFromText('250 ml')).toBe(250);
    expect(gramsFromText('25 cl')).toBe(250);
    expect(gramsFromText('1 l')).toBe(1000);
  });

  it('ne devine pas ce qui n’est pas chiffrable', () => {
    // Mieux vaut ne rien compter que compter faux : personne ne sait ce que
    // pèse « à volonté », et un œuf ne pèse pas un gramme.
    expect(gramsFromText('à volonté')).toBeNull();
    expect(gramsFromText('2 œufs')).toBeNull();
    expect(gramsFromText('une poignée')).toBeNull();
    expect(gramsFromText('')).toBeNull();
    expect(gramsFromText('0 g')).toBeNull();
  });
});

describe('buildFoodSearchText', () => {
  it('enlève les accents et la casse', () => {
    expect(buildFoodSearchText({ name: 'Crème fraîche épaisse' })).toBe('creme fraiche epaisse');
  });

  it('inclut la marque et la catégorie', () => {
    const text = buildFoodSearchText({
      name: 'Skyr nature',
      brand: 'Danone',
      category: 'Produits laitiers',
    });

    expect(text).toContain('danone');
    expect(text).toContain('produits laitiers');
  });
});
