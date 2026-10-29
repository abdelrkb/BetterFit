# BetterFit — plan de construction

Chaque étape se termine par quelque chose que le porteur du projet peut **tester lui-même**. Ne passe pas à l'étape suivante sans sa validation (voir `CLAUDE.md`).

| # | Étape | Ce qu'il peut tester à la fin |
|---|---|---|
| 0 | **Fondations** : monorepo, app Expo (web + téléphone via Expo Go ou un build de développement), API Fastify, Postgres en local avec Docker, commandes `pnpm dev`, `db:*` et `test` | Ouvrir l'app dans le navigateur et sur son téléphone, voir « BetterFit » et la réponse de l'API |
| 1 | **Design et mascotte** : tokens, polices, composants de base (bouton, carte, champ, onglets) et portage de la mascotte dans `packages/mascot` | Un écran de démo avec toutes les poses et les composants, sur téléphone et sur le web |
| 2 | **Comptes** : inscription, connexion, mot de passe oublié, Google (et Apple sur iOS), onboarding avec la mascotte, profil, consentement | Créer un compte, se déconnecter, se reconnecter, modifier son profil |
| 3 | **Exercices** : import de free-exercise-db, traductions françaises, poses (règles + corrections), recherche et filtres, exercices perso | Chercher « squat », filtrer par « dos », créer un exercice perso |
| 4 | **Programmes muscu** : éditeur (infos, planning, séances, exercices réordonnables), modèles, usage autonome | Créer un programme 3 séances et le voir dans « Entraînement » |
| 5 | **Séance guidée et suivi** : séance du jour, séries préremplies, minuteur, hors ligne, fin de séance, historique, graphiques | Faire une vraie séance en salle, en mode avion, puis voir la synchro et la progression |
| 6 | **Coaching** : Espace coach, invitations (e-mail, code, dans l'app), acceptation et refus, assignation par copie, fiche client | Avec deux comptes : inviter, accepter, assigner un programme, voir la séance du client |
| 7 | **Programmes nutrition** : calculs (repris de `reference/`), repas en saisie libre, courses, recettes avec photo, page déficit | Recréer le programme exemple de Julie et retrouver les mêmes chiffres que le prototype |
| 8 | **Base aliments** : import Ciqual, recherche sans accents, aliments perso, repas du coach calculés automatiquement | Construire un déjeuner avec « riz basmati 160 g » et voir les macros se calculer |
| 9 | **Journal et poids** : journal du jour, scan code-barres (Open Food Facts), récents et favoris, saisie rapide, anneau de calories, poids avec moyenne sur 7 jours | Scanner un produit du placard, le loguer, saisir son poids plusieurs jours |
| 10 | **PDF** : gabarits nutrition et musculation repris du prototype, générés par le serveur, partage depuis le téléphone | Exporter le programme d'un client et l'ouvrir sur le téléphone |
| 11 | **Mise en ligne** : Docker Compose sur le VPS, HTTPS, build web, sauvegardes, puis builds EAS (TestFlight, test interne Android) | Utiliser l'app sur sa vraie adresse web, installer la version de test sur son téléphone |

Après la V1 : voir la section 6 du cahier des charges.
