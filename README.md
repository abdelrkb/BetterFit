# BetterFit

Application de coaching sportif et nutritionnel : **web, iOS et Android à partir d'un seul code**.

- Produit : `docs/CAHIER_DES_CHARGES.md`
- Identité visuelle et mascotte : `docs/DESIGN.md`
- Ordre de construction : `docs/PLAN.md`
- Avancement : `docs/PROGRESS.md`

## Démarrer (première fois)

Il faut **Node 22+**, **pnpm** et **Docker Desktop** lancé.

```bash
pnpm install          # installe tout
cp .env.example .env  # crée le fichier de configuration local
pnpm db:up            # démarre PostgreSQL (Docker)
pnpm db:migrate       # crée les tables
pnpm db:seed          # insère les données de démonstration
pnpm exercises:import # importe les 873 exercices et leurs photos (~100 Mo, une fois)
pnpm dev              # lance le serveur + l'application
```

Le compte de démonstration créé par `pnpm db:seed` :
**julie@exemple.fr** / **betterfit2026**.

Puis ouvre **http://localhost:8081** dans le navigateur. Pour le téléphone,
installe **Expo Go** et scanne le QR code affiché dans le terminal (le
téléphone doit être sur le même Wi-Fi que l'ordinateur).

## Commandes

| Commande                        | Ce qu'elle fait                                                               |
| ------------------------------- | ----------------------------------------------------------------------------- |
| `pnpm dev`                      | Serveur (port 3100) + application Expo (port 8081, QR code pour le téléphone) |
| `pnpm dev:api` / `pnpm dev:app` | L'un ou l'autre seulement                                                     |
| `pnpm db:up` / `pnpm db:down`   | Démarre / arrête PostgreSQL (port 5434)                                       |
| `pnpm db:generate`              | Crée un fichier de migration après un changement de schéma                    |
| `pnpm db:migrate`               | Applique les migrations                                                       |
| `pnpm db:seed`                  | Insère les données de démonstration                                           |
| `pnpm exercises:import`         | Importe la bibliothèque d'exercices et ses photos (rejouable)                 |
| `pnpm exercises:export-translations` | Sauvegarde dans `data/exercises/` les traductions écrites dans l'app     |
| `pnpm library:editor <e-mail>`  | Autorise un compte à corriger les traductions de la bibliothèque              |
| `pnpm test`                     | Tests (une base `betterfit_test` est créée toute seule)                                                                         |
| `pnpm lint` / `pnpm typecheck`  | Qualité du code                                                               |
| `pnpm format`                   | Met en forme le code                                                          |

Les ports 3100, 8081 et 5434 sont choisis pour ne pas gêner les autres projets
de la machine (3000, 5432 et 5433 y sont déjà pris).

## La bibliothèque d'exercices

`pnpm exercises:import` télécharge les 873 exercices de
[free-exercise-db](https://github.com/yuhonas/free-exercise-db) (licence
Unlicense, domaine public) et leurs 1 746 photos. Les photos vont dans
`apps/api/uploads/`, **hors du dépôt** : elles pèsent près de 100 Mo.
Relancer la commande ne retélécharge rien et n'écrase aucune traduction.

Les noms, muscles, matériel et niveaux sont traduits automatiquement. Les
**consignes restent en anglais** tant qu'elles n'ont pas été traduites : dans
l'app, un compte autorisé (`pnpm library:editor ton@email.fr`) voit un bouton
« Traduire cet exercice ». Lance ensuite
`pnpm exercises:export-translations` pour enregistrer ce travail dans le dépôt.

## E-mails en développement

Aucun serveur d'envoi n'est configuré pour l'instant. Les messages (lien de
réinitialisation du mot de passe) **s'affichent dans le terminal** où tourne
`pnpm dev` : le lien y est lisible, il suffit de le copier dans le navigateur.
Pour envoyer de vrais e-mails, renseigne `SMTP_HOST` et les lignes voisines
dans `.env`.

## Organisation

```
apps/app        application Expo (iOS, Android, web)
apps/api        serveur Fastify + Drizzle
packages/shared schémas zod, calculs et constantes partagés
infra           docker-compose du PostgreSQL de développement
scripts         scripts des commandes pnpm
reference       prototype HTML d'origine (lecture seule)
```
