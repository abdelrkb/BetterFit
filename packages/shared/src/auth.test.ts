import { describe, expect, it } from 'vitest';
import { emailSchema, loginSchema, registerSchema, PASSWORD_MIN_LENGTH } from './auth.js';
import { booleanQueryParam } from './constants.js';

describe('emailSchema', () => {
  it('met en minuscules et enlève les espaces', () => {
    expect(emailSchema.parse('  Julie@Exemple.FR ')).toBe('julie@exemple.fr');
  });

  it('refuse une adresse sans arobase', () => {
    expect(() => emailSchema.parse('julie.exemple.fr')).toThrow();
  });
});

describe('registerSchema', () => {
  const valid = {
    email: 'julie@exemple.fr',
    password: 'a'.repeat(PASSWORD_MIN_LENGTH),
    name: 'Julie',
    healthDataConsent: true as const,
  };

  it('accepte une inscription complète', () => {
    expect(registerSchema.parse(valid).name).toBe('Julie');
  });

  it('refuse un mot de passe trop court', () => {
    expect(() => registerSchema.parse({ ...valid, password: 'court' })).toThrow();
  });

  it('refuse une inscription sans consentement', () => {
    expect(() => registerSchema.parse({ ...valid, healthDataConsent: false })).toThrow();
  });
});

describe('loginSchema', () => {
  it('n’impose pas la longueur minimale à la connexion', () => {
    // Un compte ancien peut avoir un mot de passe plus court : on le laisse
    // se connecter, c'est l'inscription qui fixe la règle.
    expect(loginSchema.parse({ email: 'julie@exemple.fr', password: 'abc' }).password).toBe('abc');
  });
});

describe('booleanQueryParam', () => {
  const schema = booleanQueryParam();

  it('lit « true » et « false » comme des booléens', () => {
    expect(schema.parse('true')).toBe(true);
    // Le piège : `Boolean("false")` vaut `true`.
    expect(schema.parse('false')).toBe(false);
  });

  it('accepte aussi 1 et 0, et un vrai booléen', () => {
    expect(schema.parse('1')).toBe(true);
    expect(schema.parse('0')).toBe(false);
    expect(schema.parse(true)).toBe(true);
  });

  it('refuse n’importe quelle autre chaîne', () => {
    expect(() => schema.parse('oui')).toThrow();
  });
});
