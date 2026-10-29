import { defineConfig } from 'vitest/config';

/**
 * Les tests d'intégration tapent dans une **base dédiée** (`betterfit_test`),
 * jamais dans celle de développement : ils la vident entre chaque test.
 * `pnpm db:up` suffit à la rendre disponible.
 */
export default defineConfig({
  test: {
    include: ['test/**/*.test.ts', 'src/**/*.test.ts'],
    globalSetup: ['./test/global-setup.ts'],
    setupFiles: ['./test/setup.ts'],
    // Une seule base partagée : les fichiers s'exécutent l'un après l'autre.
    fileParallelism: false,
    /**
     * argon2 est volontairement lent (paramètres OWASP) : un test qui crée
     * deux ou trois comptes dépasse facilement les 5 s par défaut. Ce n'est
     * pas une lenteur à corriger, c'est le coût qui protège les mots de passe.
     */
    testTimeout: 30_000,
    hookTimeout: 30_000,
    env: {
      NODE_ENV: 'test',
      DATABASE_URL:
        process.env.TEST_DATABASE_URL ??
        'postgres://betterfit:betterfit@localhost:5434/betterfit_test',
      JWT_SECRET: 'secret-de-test-suffisamment-long-pour-passer-la-validation',
    },
  },
});
