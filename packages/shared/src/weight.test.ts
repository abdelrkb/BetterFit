import { describe, expect, it } from 'vitest';
import { weightTrend } from './coaching.js';
import { weeklyChangeKg } from './weight.js';

/** Une série de pesées quotidiennes, à partir du 1er octobre. */
function daily(weights: number[]): { date: string; weightKg: number }[] {
  return weights.map((weightKg, index) => ({
    date: new Date(Date.UTC(2026, 9, 1 + index)).toISOString().slice(0, 10),
    weightKg,
  }));
}

describe('weeklyChangeKg', () => {
  it('ne dit rien avec une seule pesée', () => {
    expect(weeklyChangeKg(weightTrend(daily([80])))).toBeNull();
  });

  it('ne dit rien tant qu’il n’y a pas une semaine de recul', () => {
    // Trois jours d'écart : la variation ne veut encore rien dire.
    expect(weeklyChangeKg(weightTrend(daily([80, 79, 78.5])))).toBeNull();
  });

  it('compare deux tendances, pas deux pesées', () => {
    // Le dernier jour, la balance affiche 2 kg de moins que la veille — de
    // l'eau. La tendance, elle, n'a presque pas bougé.
    const points = weightTrend(daily([80, 80, 80, 80, 80, 80, 80, 80, 78]));

    const change = weeklyChangeKg(points);
    expect(change).not.toBeNull();
    // Entre la tendance du jour 9 (≈ 79,8) et celle du jour 1 (80).
    expect(change!).toBeGreaterThan(-0.5);
    expect(change!).toBeLessThanOrEqual(0);
  });

  it('annonce une perte quand la tendance baisse vraiment', () => {
    const points = weightTrend(daily([82, 81.8, 81.6, 81.4, 81.2, 81, 80.8, 80.6, 80.4, 80.2, 80]));

    expect(weeklyChangeKg(points)!).toBeLessThan(-0.5);
  });

  it('annonce une prise quand la tendance monte', () => {
    const points = weightTrend(daily([70, 70.2, 70.4, 70.6, 70.8, 71, 71.2, 71.4, 71.6]));

    expect(weeklyChangeKg(points)!).toBeGreaterThan(0.5);
  });

  it('accepte des pesées espacées, du moment qu’il y a une semaine d’écart', () => {
    const points = weightTrend([
      { date: '2026-10-01', weightKg: 80 },
      { date: '2026-10-20', weightKg: 78 },
    ]);

    expect(weeklyChangeKg(points)).toBe(-2);
  });
});
