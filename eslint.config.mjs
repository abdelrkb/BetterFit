import expoConfig from 'eslint-config-expo/flat.js';
import prettier from 'eslint-config-prettier';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.expo/**',
      '**/.turbo/**',
      'apps/api/drizzle/**',
      'reference/**',
    ],
  },
  ...tseslint.configs.recommended,
  {
    rules: {
      // Pas de `any` : règle de CLAUDE.md.
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  {
    // Règles React Native / Expo, limitées à l'app.
    files: ['apps/app/**/*.{ts,tsx}'],
    extends: [expoConfig],
    settings: {
      // Laisse l'alias `@/*` du tsconfig être résolu par le plugin import.
      'import/resolver': {
        typescript: { project: 'apps/app/tsconfig.json' },
      },
    },
    rules: {
      'import/no-named-as-default-member': 'off',
    },
  },
  {
    // Les fichiers de configuration Metro/Babel sont en CommonJS.
    files: ['**/*.js', '**/*.cjs'],
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
  prettier,
);
