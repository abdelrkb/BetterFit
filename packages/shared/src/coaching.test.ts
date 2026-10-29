import { describe, expect, it } from 'vitest';
import { invitationCodeSchema, weightTrend } from './coaching.js';

describe('invitationCodeSchema', () => {
  it('met en majuscules et enlève les espaces', () => {
    expect(invitationCodeSchema.parse(' a2b3c4 ')).toBe('A2B3C4');
  });

  it('refuse un caractère prêtant à confusion', () => {
    // O et 0, I et 1 sont exclus de l'alphabet : personne ne doit hésiter en
    // recopiant un code lu à voix haute.
    expect(() => invitationCodeSchema.parse('A2B3C0')).toThrow();
    expect(() => invitationCodeSchema.parse('A2B3CI')).toThrow();
  });

  it('refuse un code trop court', () => {
    expect(() => invitationCodeSchema.parse('A2B3')).toThrow();
  });
});

describe('weightTrend', () => {
  it('lisse sur sept jours', () => {
    const entries = [
      { date: '2026-10-01', weightKg: 80 },
      { date: '2026-10-02', weightKg: 82 },
      { date: '2026-10-03', weightKg: 78 },
    ];

    const trend = weightTrend(entries);

    expect(trend[0]?.trendKg).toBe(80);
    expect(trend[1]?.trendKg).toBe(81);
    expect(trend[2]?.trendKg).toBe(80);
  });

  it('ne regarde que les sept derniers points', () => {
    const entries = Array.from({ length: 10 }, (_, i) => ({
      date: `2026-10-${String(i + 1).padStart(2, '0')}`,
      weightKg: i < 3 ? 100 : 80,
    }));

    // Au dixième point, les trois mesures à 100 kg sont sorties de la fenêtre.
    expect(weightTrend(entries)[9]?.trendKg).toBe(80);
  });

  it('remet les mesures en ordre de date', () => {
    const trend = weightTrend([
      { date: '2026-10-03', weightKg: 78 },
      { date: '2026-10-01', weightKg: 80 },
    ]);

    expect(trend[0]?.date).toBe('2026-10-01');
  });
});
