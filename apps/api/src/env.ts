import { config } from 'dotenv';
import { z } from 'zod';

// Charge `.env` à la racine du dépôt, puis celui de l'API s'il existe.
config({ path: new URL('../../../.env', import.meta.url).pathname, quiet: true });
config({ path: new URL('../.env', import.meta.url).pathname, quiet: true });

const isProduction = process.env.NODE_ENV === 'production';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_HOST: z.string().default('0.0.0.0'),
  API_PORT: z.coerce.number().int().positive().default(3100),
  DATABASE_URL: z.string().default('postgres://betterfit:betterfit@localhost:5434/betterfit'),
  /** Origines autorisées à appeler l'API depuis un navigateur, séparées par des virgules. */
  CORS_ORIGINS: z.string().default('http://localhost:8081'),

  /**
   * Clé de signature des jetons d'accès. En production elle est obligatoire :
   * une valeur par défaut permettrait à n'importe qui de forger un jeton.
   */
  JWT_SECRET: isProduction
    ? z.string().min(32, 'JWT_SECRET doit faire au moins 32 caractères en production.')
    : z.string().min(32).default('clé-de-développement-à-remplacer-en-production-0123456789'),

  /** Adresse publique de l'app, pour fabriquer les liens des e-mails. */
  APP_URL: z.string().default('http://localhost:8081'),

  /** E-mails. Sans `SMTP_HOST`, les messages sont affichés dans la console. */
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  MAIL_FROM: z.string().default('BetterFit <ne-pas-repondre@betterfit.local>'),
});

export const env = envSchema.parse(process.env);

export const corsOrigins = env.CORS_ORIGINS.split(',')
  .map((origin) => origin.trim())
  .filter((origin) => origin.length > 0);

export const isProductionEnv = env.NODE_ENV === 'production';
