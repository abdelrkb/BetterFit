# BetterFit — contexte pour Claude Code

BetterFit est une application de coaching sportif et nutritionnel, disponible en **web et en mobile (iOS / Android) à partir d'un seul code React**. Un même compte peut être :

- **utilisateur autonome** : il crée ses propres programmes de musculation et de nutrition, suit ses séances, son poids et ce qu'il mange ;
- **client** : un coach l'a invité, lui partage des programmes et peut suivre sa progression ;
- **coach** : il crée des programmes (et des modèles réutilisables), invite des clients, leur assigne des programmes et exporte des PDF à son image.

Le produit détaillé est dans `docs/CAHIER_DES_CHARGES.md`, l'identité visuelle et la mascotte dans `docs/DESIGN.md`, l'ordre de construction dans `docs/PLAN.md`. **Lis ces trois fichiers avant toute tâche.** Un prototype qui fonctionne déjà (générateur de programmes en HTML) est dans `reference/` : il fait foi pour les calculs, la mise en page des PDF et la mascotte.

## Comment travailler avec le porteur du projet

Le porteur du projet est coach, **pas développeur**. Il ne lit pas le code : il teste l'application et valide.

1. **Une étape à la fois**, dans l'ordre de `docs/PLAN.md`. Ne commence jamais l'étape suivante sans sa validation explicite.
2. Au début d'une étape : explique en 3 à 5 phrases simples, en français, ce que tu vas construire et ce qu'il pourra tester à la fin.
3. À la fin d'une étape : donne-lui une **procédure de test pas à pas** (quoi lancer, où cliquer, ce qu'il doit voir), en évitant le jargon. Si une commande est nécessaire, donne-la en entier, prête à copier.
4. Quand une décision **produit ou fonctionnelle** se présente (comportement d'un écran, règle métier, parcours), **pose-lui la question** avec 2 ou 3 options concrètes et une recommandation. Les décisions techniques, prends-les toi-même en suivant ce fichier.
4 bis. **Le design, en revanche, est délégué** (décidé le 27 octobre 2026) : couleurs, espacements, mise en page, composants et wording d'interface sont à toi, en suivant `docs/DESIGN.md`. Ne les lui soumets pas. Il repassera sur l'habillage plus tard avec un outil dédié : la priorité est l'architecture et le fonctionnel. Ne sur-investis pas dans le fignolage visuel, mais garde les écrans structurés, accessibles et testables.
5. Après validation : commit (`feat: …` / `fix: …`, messages en anglais), puis mets à jour `docs/PROGRESS.md` (fait, en cours, décisions prises, points ouverts).
6. Ne jamais ajouter un service payant, un compte tiers ou une dépendance lourde sans le lui demander d'abord.
7. Les secrets (clés, mots de passe, `JWT_SECRET`…) vont dans `.env`, jamais dans le dépôt. Maintiens `.env.example` à jour.

## Stack (décidée — ne pas changer sans accord)

| Couche | Choix |
|---|---|
| Monorepo | pnpm workspaces + Turborepo, TypeScript strict partout |
| App (web + iOS + Android) | **Expo** (dernière version stable du SDK au démarrage), **Expo Router**, React Native Web pour le web |
| Données côté app | TanStack Query (serveur), Zustand (état local, séance en cours, file de synchro hors ligne) |
| Formulaires | react-hook-form + zod (schémas partagés) |
| Dessin / mascotte / graphiques | react-native-svg (+ react-native-reanimated pour les animations simples) |
| Scan code-barres | expo-camera (`CameraView`, détection des codes-barres). Sur le web : saisie manuelle du code EAN si la caméra n'est pas disponible |
| i18n | i18next + expo-localization. **Français par défaut**, aucun texte en dur : toutes les chaînes dans `locales/fr.json`, prêtes pour `en.json` |
| API | **Node + TypeScript, Fastify**, validation zod, ORM **Drizzle** |
| Base de données | **PostgreSQL** (extensions `pg_trgm` et `unaccent` pour la recherche d'aliments et d'exercices) |
| Auth | Maison : e-mail + mot de passe (argon2id), **Google**, et **Sign in with Apple sur iOS** (voir « Points de vigilance »). Access token JWT court (15 min) + refresh token long, rotatif, stocké haché en base. Stockage : `expo-secure-store` sur mobile, cookie httpOnly sur le web |
| Fichiers (photos de recettes, avatars) | Stockés sur le VPS (volume Docker) derrière l'API, URLs signées |
| PDF | Générés **côté serveur** à partir de gabarits HTML (Playwright + Chromium headless), en reprenant la mise en page de `reference/prototype-studio.html` : texte sélectionnable, rendu identique sur tous les appareils |
| E-mails (invitations, mot de passe oublié) | SMTP configurable dans `.env` (fournisseur à choisir avec le porteur du projet) |
| Hébergement | **VPS du porteur du projet** : Docker Compose (api, postgres, caddy pour HTTPS + build web statique), sauvegardes `pg_dump` quotidiennes avec rotation |
| Builds mobiles | EAS Build / EAS Submit |
| Tests | Vitest (packages partagés + API), tests d'intégration API sur une base Postgres de test |

## Arborescence cible

```
betterfit/
├─ apps/
│  ├─ app/            # Expo : iOS, Android, Web (Expo Router, dossier app/)
│  └─ api/            # Fastify + Drizzle
├─ packages/
│  ├─ shared/         # schémas zod, types, calculs (nutrition, macros, progression), constantes
│  ├─ mascot/         # composant <Mascot pose="squat" /> en react-native-svg + table des poses
│  └─ pdf-templates/  # gabarits HTML des PDF (nutrition, musculation)
├─ data/
│  ├─ exercises/      # import free-exercise-db + traductions FR + pose de mascotte
│  └─ foods/          # script d'import Ciqual
├─ infra/             # docker-compose.yml, Caddyfile, scripts de sauvegarde
├─ docs/              # CAHIER_DES_CHARGES.md, DESIGN.md, PLAN.md, PROGRESS.md
└─ reference/         # prototype HTML + mascotte d'origine (lecture seule)
```

## Règles de code

- Code, noms de variables, de tables et de colonnes **en anglais**. Textes visibles par l'utilisateur **en français**, via i18n.
- Un seul endroit pour chaque règle métier : les calculs (métabolisme de base, maintien, macros, rythme de perte, totaux de repas, suggestion de charge) vivent dans `packages/shared` et sont testés. L'app et l'API les importent. Ne recopie jamais un calcul.
- Les schémas zod de `packages/shared` sont la source de vérité des formats échangés entre l'app et l'API.
- Toute route de l'API vérifie les droits : un client ne voit que ses données et les programmes qui lui sont assignés ; un coach ne voit que ses clients **actifs**. Écris un test d'accès refusé pour chaque nouvelle ressource.
- Les écrans doivent fonctionner sur téléphone (≈ 375 px) **et** sur grand écran web (mise en page en colonnes à partir de ≈ 900 px).
- Accessibilité : zones tactiles ≥ 44 px, contrastes ≥ 4,5:1, libellés `accessibilityLabel` sur les boutons-icônes.
- Le mode séance guidée doit **fonctionner hors ligne** : les séries saisies sont stockées localement et synchronisées au retour du réseau.
- Pas de `any`. Pas de logique métier dans les composants d'écran : hooks et fonctions de `shared`.

## Commandes (maintenir cette liste à jour)

```
pnpm install          # installe tout
cp .env.example .env  # configuration locale (une seule fois)
pnpm dev              # lance l'API (port 3100) + l'app Expo (port 8081, QR code pour le téléphone)
pnpm dev:api          # l'API seulement
pnpm dev:app          # l'app seulement
pnpm db:up            # démarre Postgres en local (Docker, port 5434)
pnpm db:down          # arrête Postgres
pnpm db:generate      # génère une migration après un changement de apps/api/src/db/schema.ts
pnpm db:migrate       # applique les migrations Drizzle
pnpm db:seed          # importe exercices + aliments Ciqual + données de démo
pnpm test             # tests
pnpm lint && pnpm typecheck
pnpm format           # Prettier
```

**Ports** : 3100 (API), 8081 (Expo), 5434 (Postgres). Les ports habituels (3000, 5432, 5433) sont déjà occupés par d'autres projets sur la machine du porteur du projet : ne les reprends pas.

**Versions épinglées à l'étape 0** : Expo SDK 58, React 19.3, React Native 0.88, Fastify 5, Drizzle ORM 0.45, zod 4, TypeScript 6, Vitest 5, **ESLint 9** (ESLint 10 casse `eslint-plugin-react`, utilisé par `eslint-config-expo`).

`packages/shared` est consommé en TypeScript source : ses imports internes portent l'extension `.js` (exigée par Node côté API), et `apps/app/metro.config.js` contient la résolution qui réécrit `.js` en `.ts` pour Metro. Ne retire pas ce bloc.

**Le projet vit dans `~/Projets/BetterFit`, hors iCloud. Ne le remets jamais sur le Bureau ni dans Documents.** Le 29 octobre 2026, le projet était sur le Bureau — donc synchronisé par iCloud — et macOS a déchargé des fichiers vers le nuage sans pouvoir les récupérer : 36 fichiers source et 62 objets Git sont devenus illisibles. Un fichier déchargé se lit sans problème dans le Finder mais **bloque indéfiniment** depuis ton environnement d'exécution. Symptômes : `git` affirme que ce n'est pas un dépôt, un `package.json` paraît vide, Metro ne démarre jamais, une commande reste figée sans message.

Pour les repérer : `ls -lOR <dossier> | grep -c dataless`. Pour les rapatrier, lance la commande **hors du bac à sable** : `find <dossier> -type f -exec cat {} + > /dev/null`. Ce n'est pas un problème de code : ne cherche pas la panne ailleurs.

## Points de vigilance (déjà identifiés)

- **Apple** : si l'app iOS propose la connexion Google, la règle 4.8 de l'App Store impose aussi une option de connexion équivalente qui respecte la vie privée. Sign in with Apple remplit cette condition : on l'ajoute sur iOS.
- **Open Food Facts** : environ 15 lectures de produit par minute et par IP, et 10 recherches par minute. La recherche Open Food Facts ne doit **pas** servir à la recherche au fil de la frappe. On fait l'appel de lecture par code-barres **depuis l'appareil** de l'utilisateur, avec un User-Agent `BetterFit/<version> (<email de contact>)`, puis on met le produit en cache dans notre table `foods`. La recherche texte se fait dans notre base (Ciqual + produits déjà mis en cache + aliments perso). Données sous licence ODbL : afficher l'attribution « Données Open Food Facts ».
- **Ciqual (ANSES)** : environ 3 500 aliments génériques (version 2025). Le script d'import doit être rejouable à chaque nouvelle version. Vérifie la licence au moment de l'import et affiche la source.
- **Exercices** : base de départ = free-exercise-db (873 exercices, licence Unlicense, avec muscles, matériel, consignes et images). Les textes sont en anglais : les traductions françaises sont générées une fois puis stockées dans `data/exercises/` et relues. Chaque exercice reçoit une pose de mascotte (voir `docs/DESIGN.md`).
- **Données personnelles** : le poids, le journal alimentaire et les mensurations sont des données sensibles. Il faut un consentement explicite à l'inscription, l'export et la suppression du compte (RGPD), des sauvegardes chiffrées et un minimum de logs. Signale au porteur du projet qu'il doit faire vérifier par un professionnel si l'hébergement de ces données doit être certifié HDS (hébergeur de données de santé).
