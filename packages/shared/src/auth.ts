import { z } from 'zod';
import { profileSchema } from './profile.js';

/** Contrats d'authentification, partagés par l'app et l'API. */

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3)
  .max(254)
  .pipe(z.email('Adresse e-mail invalide'));

export const PASSWORD_MIN_LENGTH = 10;

/**
 * Longueur minimale plutôt que règles de composition : c'est ce que
 * recommandent l'ANSSI et le NIST, et c'est plus facile à retenir pour
 * l'utilisateur. La limite haute évite les attaques par mot de passe géant.
 */
export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Au moins ${PASSWORD_MIN_LENGTH} caractères.`)
  .max(200);

export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  name: z.string().trim().min(1).max(80),
  /**
   * Consentement explicite au traitement des données de santé (poids, journal
   * alimentaire, mensurations). Obligatoire : sans lui, pas de compte.
   */
  healthDataConsent: z.literal(true),
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Mot de passe requis'),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const forgotPasswordSchema = z.object({ email: emailSchema });
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z.object({
  token: z.string().min(16).max(200),
  password: passwordSchema,
});
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: passwordSchema,
});
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

/** L'utilisateur tel que l'app le connaît. Jamais de mot de passe ici. */
export const userSchema = z.object({
  id: z.uuid(),
  email: emailSchema,
  name: z.string(),
  locale: z.string(),
  /** `true` quand l'onboarding a été rempli : sinon l'app y renvoie. */
  hasProfile: z.boolean(),
  /** Date du consentement aux données de santé, au format ISO 8601. */
  healthDataConsentAt: z.string().nullable(),
  /** Droit de corriger les traductions de la bibliothèque partagée. */
  canEditLibrary: z.boolean(),
  createdAt: z.string(),
});
export type User = z.infer<typeof userSchema>;

export const updateUserSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  locale: z.enum(['fr', 'en']).optional(),
});
export type UpdateUserInput = z.infer<typeof updateUserSchema>;

/**
 * Réponse d'une connexion réussie.
 *
 * Le jeton d'accès est court (15 min) et voyage dans l'en-tête `Authorization`.
 * Le jeton de rafraîchissement n'est renvoyé **que sur mobile** : sur le web il
 * part dans un cookie `httpOnly`, hors de portée du JavaScript de la page.
 */
export const sessionSchema = z.object({
  user: userSchema,
  accessToken: z.string(),
  /** Durée de vie du jeton d'accès, en secondes. */
  expiresIn: z.number().int().positive(),
  refreshToken: z.string().nullable(),
});
export type Session = z.infer<typeof sessionSchema>;

/** Le corps du jeton d'accès. */
export const accessTokenClaimsSchema = z.object({
  sub: z.uuid(),
  /** Identifiant de la session, pour pouvoir la révoquer. */
  sid: z.uuid(),
});
export type AccessTokenClaims = z.infer<typeof accessTokenClaimsSchema>;

/** `GET /me` : l'utilisateur et son profil, si l'onboarding est fait. */
export const meSchema = z.object({
  user: userSchema,
  profile: profileSchema.nullable(),
  /** Dernier poids saisi, en kilogrammes. */
  latestWeightKg: z.number().nullable(),
});
export type Me = z.infer<typeof meSchema>;

/** Suppression du compte : on redemande le mot de passe (geste irréversible). */
export const deleteAccountSchema = z.object({
  password: z.string().min(1),
});
export type DeleteAccountInput = z.infer<typeof deleteAccountSchema>;

/** Format d'erreur renvoyé par l'API. */
export const apiErrorSchema = z.object({
  /** Code stable, que l'app traduit. */
  code: z.string(),
  message: z.string(),
  /** Erreurs par champ, pour les formulaires. */
  fields: z.record(z.string(), z.string()).optional(),
});
export type ApiError = z.infer<typeof apiErrorSchema>;

/** Les codes d'erreur que l'app doit savoir traiter. */
export const AUTH_ERROR_CODES = {
  invalidCredentials: 'auth/invalid-credentials',
  emailTaken: 'auth/email-taken',
  invalidToken: 'auth/invalid-token',
  expiredToken: 'auth/expired-token',
  unauthenticated: 'auth/unauthenticated',
  tooManyAttempts: 'auth/too-many-attempts',
  noPassword: 'auth/no-password',
} as const;
