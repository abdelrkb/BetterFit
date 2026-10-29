# Avancement

_Mis à jour par Claude Code après chaque étape validée._

## Incident du 29 octobre 2026 — perte de l'historique Git

Le projet est sur le Bureau, donc synchronisé par iCloud. Le disque étant plein à 93 %,
macOS a **déchargé** vers le nuage une partie des fichiers, puis n'a plus jamais réussi à
les redescendre : toute lecture renvoyait zéro octet. 36 fichiers sources et une partie des
objets Git sont devenus illisibles, et `git push` échouait avec `pack-objects died of
signal 10` (une erreur de bus : Git lit ses archives en mémoire projetée).

**Ce qui a été fait.** Les 36 fichiers ont été réécrits à l'identique — la fidélité est
prouvée par les tests, en particulier les 39 tests de la mascotte qui comparent chaque
coordonnée des 17 poses au prototype d'origine. `node_modules` a été réinstallé, les
migrations régénérées en une seule migration propre, et la base de développement recréée.

**Ce qui a été perdu.** L'historique des commits des étapes 0 à 6. **Aucune ligne de code.**
L'ancien dépôt est conservé dans `.git-ancien-illisible/` (ignoré par Git) au cas où iCloud
rendrait un jour ses fichiers. `docs/DESIGN.md` a été reconstitué et mérite une relecture
du porteur du projet.

**Pour que ça ne se reproduise pas.** Le projet a maintenant un dépôt distant sur GitHub :
pousser après chaque étape est désormais la sauvegarde. Deux mesures restent conseillées :
sortir le projet du Bureau (vers `~/Projets/BetterFit`) et libérer de l'espace disque.

## Fait
- **Étape 6 — Coaching** (en attente de validation) : Espace coach activable sur un compte
  existant, invitations par **code**, par **e-mail** et **dans l'app**, acceptation et refus,
  assignation d'un programme **par copie**, fiche client (séances réalisées, programmes
  assignés, courbe de poids avec tendance sur sept jours), et fin de coaching des deux côtés.
- **Étape 5 — Séance guidée et suivi** (faite) : séance du jour tirée du
  planning, écran d'entraînement exercice par exercice avec séries préremplies d'après la
  dernière fois, minuteur de repos (vibration, bip, écran maintenu allumé), **fonctionnement
  hors ligne complet**, bilan de fin avec records battus, historique des séances et courbe de
  progression par exercice (charge maximale et 1RM estimé par la formule d'Epley).
- **Étape 4 — Programmes de musculation** (faite) : éditeur complet
  (infos, planning de la semaine, séances réordonnables, exercices avec séries, répétitions,
  charge, repos, tempo et consignes), modèles réutilisables, duplication, et écran de
  consultation du programme.
- **Étape 3 — Exercices** (faite) : import des 873 exercices de
  free-exercise-db avec leurs 1 746 photos, noms et filtres traduits en français,
  recherche tolérante aux fautes et aux accents, filtres par muscle, matériel et niveau,
  exercices personnels (création, modification, suppression) et écran de traduction des
  consignes pour un compte autorisé.
- **Étape 2 — Comptes** (validée) : inscription et connexion par e-mail
  et mot de passe, mot de passe oublié, questionnaire d'accueil en quatre pages, écran
  Profil, changement de mot de passe, export des données et suppression du compte (RGPD).
  La session survit à la fermeture de l'app. 105 tests automatiques, dont les accès refusés
  sur chaque route protégée.
- **Étape 1 — Design et mascotte** (validée) : jetons de couleur, formes
  et typographie dans `packages/shared`, polices Unbounded et Manrope chargées au démarrage,
  composants de base dans `apps/app/src/ui` (bouton, carte, carte héro, champ, onglets,
  étiquette, logo, textes), mascotte portée dans `packages/mascot` avec ses 17 poses et une
  variante claire pour les fonds sombres. Écran de démonstration à l'ouverture de l'app.
- **Étape 0 — Fondations** (validée) : monorepo pnpm + Turborepo, app Expo SDK 58 (web + iOS + Android) avec Expo Router, API Fastify + Drizzle, PostgreSQL en local via Docker, et les commandes `pnpm dev`, `db:*`, `test`, `lint`, `typecheck`, `format`. Un écran d'accueil affiche l'état du serveur et de la base.

## En cours
- Le porteur du projet a demandé le 27 octobre 2026 d'enchaîner les étapes sans
  validation intermédiaire, et de s'arrêter avant l'étape 11 (mise en ligne), qui
  demande son VPS, son nom de domaine et ses comptes de stores.
- Étapes 0, 1 et 2 validées le 27 octobre 2026.

## Décisions de l'étape 6
- **Devenir coach est une bascule, pas un compte à part.** L'existence d'une ligne dans
  `coach_settings` fait de quelqu'un un coach ; il continue à s'entraîner comme avant.
- **Un client n'a qu'un seul coach actif**, imposé **en base** par un index unique partiel
  sur `client_id` quand `status = 'active'`. Le faire seulement dans le code laisserait
  passer deux acceptations simultanées.
- **Assigner, c'est copier.** La copie garde `source_program_id` et pointe vers le client :
  le coach l'adapte sans toucher à son modèle. Vérifié par un test.
- **À la fin du coaching, les programmes reçus deviennent la propriété du client.** Le
  cahier des charges dit qu'ils lui restent ; les laisser au coach les exposerait à une
  suppression. Le coach, lui, perd l'accès au suivi immédiatement.
- **Un coach ne voit que ses clients actifs**, et une demande sur quelqu'un d'autre répond
  « introuvable » plutôt qu'« interdit » : la réponse ne doit pas révéler qu'un compte
  existe ou qu'il a déjà un coach.
- **Le code d'invitation évite les caractères qu'on confond** (ni O/0, ni I/1) : il est
  dicté à voix haute. Six caractères, valable sept jours.
- **Le jeton d'un lien d'invitation n'est jamais stocké en clair**, comme un mot de passe ;
  le code court, lui, doit rester lisible puisque c'est lui qu'on transmet.
- **Le délai des tests du serveur passe à 30 s** : argon2 est volontairement coûteux, et un
  test qui crée trois comptes dépassait les 5 s par défaut. C'est le prix de la sécurité des
  mots de passe, pas une lenteur à corriger.
- **Une requête mal formée répond 400, plus 500.** Les erreurs levées par Fastify lui-même
  (corps JSON vide ou illisible) tombaient dans le cas général et ressortaient en « erreur
  interne » : ça masque la vraie cause et déclenche des alertes pour rien.
- **Le lien d'invitation reçu par e-mail est mis de côté sur l'appareil**, puis consommé une
  fois la personne connectée. Au moment du clic, elle n'a souvent pas encore de compte :
  perdre l'invitation pendant l'inscription serait le cas le plus fréquent.

## Note d'exploitation — iCloud
Le projet est sur le Bureau, donc synchronisé par iCloud, qui **décharge** les fichiers vers
le nuage quand le disque se remplit (il l'est à 93 %). Un fichier déchargé se lit normalement
dans le Finder, mais **bloque indéfiniment** depuis l'environnement d'exécution de Claude
Code. Symptômes : `git` qui prétend que ce n'est pas un dépôt, un `package.json` qui paraît
vide, Metro qui ne démarre jamais.

Remède : rapatrier les fichiers hors du bac à sable, par exemple
`find <dossier> -type f -exec cat {} + > /dev/null`. Remède durable : sortir le projet du
Bureau, ou libérer de l'espace disque.

## Décisions prises
- Stack : Expo (web + iOS + Android), API Node/TypeScript/Fastify, PostgreSQL + Drizzle, hébergement sur le VPS du porteur du projet.
- Connexion : e-mail + mot de passe, Google, Apple sur iOS.
- Français par défaut, textes prêts pour l'anglais.
- Exercices : free-exercise-db traduit en français. Aliments : Ciqual + Open Food Facts + aliments perso.
- **Ports décalés** : API 3100, Expo 8081, Postgres 5434. Les ports 3000, 5432 et 5433 sont déjà pris par d'autres projets de la machine (`appfoot`, `jjb-club`).
- **ESLint 9** et non 10 : ESLint 10 casse `eslint-plugin-react`, utilisé par `eslint-config-expo`. À revoir quand le plugin sera compatible.
- **Image Docker `postgres:18-alpine`** : le volume se monte sur `/var/lib/postgresql` (et non `/var/lib/postgresql/data`), comme l'exige Postgres 18.
- **TanStack Query et i18next posés dès l'étape 0** plutôt qu'à l'étape 2 : l'écran d'accueil s'en sert déjà, ce qui évite de le réécrire. Aucun texte en dur, tout passe par `apps/app/locales/fr.json`.
- Table `health_checks` : table témoin de l'étape 0, uniquement là pour vérifier que les migrations s'appliquent. À retirer quand les vraies tables arrivent (étape 2).
- Prettier ne touche pas `docs/`, `CLAUDE.md` ni `README.md` : ces fichiers sont écrits à la main.

## Décisions de l'étape 5
- **La séance est fabriquée sur l'appareil, identifiant compris.** L'envoi est donc rejouable :
  le serveur écrase la séance de même identifiant au lieu d'en créer une seconde. C'est ce qui
  rend la file d'envoi hors ligne sûre.
- **La séance en cours et la file vivent dans le stockage local**, réécrites à chaque geste :
  fermer l'app au milieu d'une série ne perd rien.
- **Toute la séance tient dans un seul écran** (séries, bilan, résultat). Changer de route
  télécharge un morceau de code : impossible en mode avion, c'est-à-dire précisément quand on
  en a besoin. Vérifié sur la version de production, réseau coupé.
- **`@react-native-async-storage/async-storage` ne se charge pas sur le web** dans ce projet :
  remplacé par `src/lib/kv.ts` (téléphone) et `kv.web.ts` (`localStorage`). Un fichier par
  plateforme, choisi par Metro.
- **Le minuteur lit l'horloge**, il ne compte pas les battements : si le téléphone se met en
  veille, le temps affiché reste juste au retour.
- **Records calculés à partir des données reçues**, pas de la base, et avant l'écriture : sinon
  une séance renvoyée se comparerait à elle-même.
- **Un seul axe sur la courbe** : charge maximale et 1RM estimé sont tous deux en kilogrammes.
  Les deux couleurs (`#6B3FD9`, `#C2410C`) ont été vérifiées pour rester distinguables en
  protanopie, deutéranopie et tritanopie, et chaque courbe porte son nom et sa dernière valeur.
  Un tableau donne les mêmes chiffres.
- **Bug trouvé en testant dans un vrai navigateur** : `@fastify/cors` n'autorise par défaut que
  `GET`, `HEAD` et `POST`. **Toutes les modifications depuis le web étaient refusées** (profil,
  programme, séance). Corrigé, avec un test de préflight.

## Décisions de l'étape 4
- **Un programme s'enregistre d'un bloc.** L'éditeur manipule un document entier (infos,
  séances, exercices, planning) et l'API le remplace dans une transaction, plutôt que de
  gérer vingt routes de détail et autant d'états intermédiaires pour une liste qu'on
  réordonne. Tenable parce qu'un programme a un propriétaire unique.
- **Le planning range des indices de séance, pas des identifiants.** L'éditeur crée des
  séances qui n'ont pas encore d'identifiant : le planning doit pouvoir les désigner.
  Supprimer ou déplacer une séance décale les jours en conséquence.
- **Réordonner se fait avec des flèches, pas en glissant.** Le glisser-déposer demande du
  travail de gestes sur téléphone comme sur le web, et reste inutilisable au lecteur
  d'écran. Deux boutons de 44 px font le travail.
- **Le garde d'authentification est passé de `preHandler` à `onRequest`** : Fastify valide
  le corps de la requête avant `preHandler`, si bien qu'un appel non authentifié au corps
  malformé recevait un 400 détaillé au lieu d'un 401.
- **`z.coerce.boolean()` est banni des paramètres d'adresse.** `Boolean("false")` vaut
  `true` : la liste des programmes revenait vide. Remplacé par `booleanQueryParam()` dans
  `packages/shared`, avec un test de non-régression.
- **La duplication existe déjà** (`POST /programs/:id/duplicate`) : elle servira à
  l'assignation d'un programme à un client, qui est une copie (étape 6).

## Décisions de l'étape 3
- **Les consignes seront traduites à la main par le porteur du projet** (son choix) :
  l'app propose un écran de traduction, et `pnpm exercises:export-translations`
  sauvegarde le travail dans `data/exercises/instructions.fr.json`. Un réimport ne
  l'écrase jamais.
- **Les noms sont traduits par règles**, pas mot à mot : on reconnaît mouvement,
  matériel, position et prise, puis on réassemble à la française. 679 noms sur 876 sont
  traduits ; les 197 autres gardent l'anglais, parce qu'inventer une traduction
  approximative serait pire (« Turkish Get-Up » reste « Turkish Get-Up »).
- **Les photos sont téléchargées sur le serveur** (`apps/api/uploads/`, volume Docker en
  production) plutôt que pointées chez GitHub : on ne dépend pas d'un dépôt tiers pour
  afficher l'app, et c'est cohérent avec le reste des fichiers.
- **Recherche** : `ilike` pour les correspondances exactes, et `word_similarity` du module
  `pg_trgm` pour les fautes de frappe. `word_similarity` et non `similarity`, parce que
  cette dernière compare la saisie à la ligne entière et s'effondre dès que la ligne est
  longue (« tracion » donnait 0,12 contre 0,50).
- **Le filtre par muscle remonte d'abord les exercices dont c'est le muscle principal.**
  Sans ça, filtrer « Dos » renvoyait des arrachés, qui sollicitent les trapèzes en second.
- **Droit d'édition de la bibliothèque** : colonne `can_edit_library`, accordée par
  `pnpm library:editor <e-mail>`. Ces textes sont vus par tout le monde, ils ne peuvent
  pas être modifiables par n'importe quel compte.
- **`mascot_pose` ne sert plus qu'aux exercices personnels**, qui n'ont pas de photo.

## Décisions de l'étape 2
- **Le design est délégué à Claude** (demandé par le porteur du projet le 27 octobre 2026) :
  la priorité est l'architecture et le fonctionnel, l'habillage sera repris plus tard avec
  un outil dédié. Inscrit dans `CLAUDE.md`.
- **Google et Apple sont préparés mais pas activés.** La table `auth_identities` et la
  structure sont en place ; il manque un projet Google Cloud (gratuit) et un compte
  développeur Apple (99 $/an). À reprendre quand le porteur du projet les aura créés.
- **Aucun fournisseur d'e-mails choisi.** Tant que `SMTP_HOST` est vide, les messages
  s'affichent dans le terminal : le parcours « mot de passe oublié » reste testable en
  entier. Trois lignes de `.env` suffiront pour basculer.
- **Mot de passe : longueur minimale de 10 caractères, sans règle de composition**
  (recommandation ANSSI et NIST). Empreintes **argon2id** aux paramètres OWASP.
- **Jetons** : accès de 15 minutes signé en JWT, rafraîchissement de 60 jours **rotatif**,
  stocké seulement sous forme d'empreinte SHA-256. Un jeton rejoué révoque toute la session
  (on suppose un vol). Cookie `httpOnly` sur le web, trousseau du système sur mobile.
- **Freinage des tentatives** : 8 échecs par adresse e-mail dans une fenêtre de 15 minutes,
  puis blocage de 15 minutes. Compté en base, pour survivre à un redémarrage.
- **La connexion ne dit jamais si un compte existe** : même réponse et même temps de calcul
  pour une adresse inconnue que pour un mauvais mot de passe. Idem pour le mot de passe oublié.
- **Un aiguillage unique** dans `apps/app/app/_layout.tsx` décide où va l'utilisateur
  (connexion, questionnaire ou application). Exception : l'écran de réinitialisation reste
  accessible même connecté, puisqu'on y arrive par un lien reçu par e-mail.
- **Base de test séparée** (`betterfit_test`), créée automatiquement, vidée entre chaque test.
- La table témoin `health_checks` de l'étape 0 a été supprimée, comme prévu.
- **Le poids vit dans `weight_entries`, pas dans le profil** : le profil décrit ce qui ne
  bouge pas, le poids est une mesure datée. La table est créée dès maintenant parce que le
  questionnaire d'accueil demande déjà un premier poids ; l'écran de suivi vient à l'étape 9.

## Décisions de l'étape 1
- **Les exercices seront illustrés par les photos de free-exercise-db, pas par la mascotte**
  (décidé par le porteur du projet). Vérifié : 873 exercices sur 876 ont **2 photos** chacun
  (départ et arrivée), licence Unlicense (domaine public), dépôt d'environ 95 Mo.
  Conséquence : aucune pose supplémentaire à dessiner, et `POSE_RULES` n'a plus à être étendue.
  Le champ `mascot_pose` reste pour les exercices personnalisés sans photo. Voir `docs/DESIGN.md`.
- **La mascotte est portée telle quelle**, sans retouche : un test compare pose par pose le
  rendu du portage à celui de `reference/mascot.js` et vérifie qu'aucun œil n'est dessiné.
- **Variante `tone="onDark"`** ajoutée : sur un bouton violet ou une carte sombre, la mascotte
  violette devenait invisible.
- **Les jetons de design vivent dans `packages/shared`**, pas dans un `packages/ui` : ce sont
  de simples données, que les gabarits PDF (étape 10) liront aussi. Les composants React Native,
  eux, restent dans `apps/app/src/ui` puisque seule l'app les utilise.
- Les libellés des poses (« Squat », « Soulevé de terre ») sont stockés dans
  `packages/mascot`, pas dans `locales/fr.json`. À reprendre le jour où l'anglais arrivera.

## Points ouverts
- Modèle économique, publication sur les stores, nom de domaine, fournisseur d'e-mails, question HDS.
- **Fournisseur SMTP** à choisir : nécessaire pour envoyer vraiment les e-mails
  (mot de passe oublié, et les invitations de l'étape 6).
- **Identifiants Google** (projet Google Cloud, gratuit) et **compte développeur Apple**
  (99 $/an) à créer pour activer la connexion par Google et Apple.
- **Changement d'adresse e-mail** : pas encore possible depuis le profil. Demande une
  vérification de la nouvelle adresse ; à traiter quand le SMTP sera en place.
