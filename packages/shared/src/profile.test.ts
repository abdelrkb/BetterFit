import { describe, expect, it } from 'vitest';
import { ageFromBirthDate, onboardingSchema, profileSchema } from './profile.js';

describe('ageFromBirthDate', () => {
  const today = new Date(Date.UTC(2026, 9, 27));

  it('compte les années révolues', () => {
    expect(ageFromBirthDate('1990-10-27', today)).toBe(36);
  });

  it('ne compte pas l’anniversaire à venir', () => {
    expect(ageFromBirthDate('1990-10-28', today)).toBe(35);
  });

  it('rejette une date qui n’existe pas', () => {
    expect(ageFromBirthDate('2001-02-31', today)).toBeNull();
  });

  it('rejette un format inattendu', () => {
    expect(ageFromBirthDate('27/10/1990', today)).toBeNull();
  });
});

describe('profileSchema', () => {
  const valid = {
    sex: 'female',
    birthDate: '1992-04-15',
    heightCm: 168,
    activityLevel: 'moderate',
    goal: 'lose_fat',
    weeklySessions: 3,
  };

  it('accepte un profil complet', () => {
    expect(profileSchema.parse(valid).heightCm).toBe(168);
  });

  it('refuse une taille aberrante', () => {
    expect(() => profileSchema.parse({ ...valid, heightCm: 20 })).toThrow();
  });

  it('refuse un âge hors bornes', () => {
    expect(() => profileSchema.parse({ ...valid, birthDate: '2024-01-01' })).toThrow();
  });
});

describe('onboardingSchema', () => {
  it('exige le prénom et le premier poids', () => {
    expect(() =>
      onboardingSchema.parse({
        sex: 'male',
        birthDate: '1988-01-01',
        heightCm: 180,
        activityLevel: 'active',
        goal: 'gain_muscle',
        weeklySessions: 4,
      }),
    ).toThrow();
  });
});
