# BetterFit — cahier des charges (V1)

## 1. Vision

Une application unique, web et mobile, pour **créer, partager et suivre des programmes de musculation et de nutrition**. Elle remplace les PDF bricolés : le coach construit le programme une fois, le client l'a dans sa poche, s'entraîne avec, note ses charges et son alimentation, et le coach voit la progression.

Identité : violet, typographie ronde et affirmée, et une **mascotte singe violet sans yeux** qui fait tous les exercices (voir `DESIGN.md`).

## 2. Rôles

Il n'y a **qu'un seul type de compte**. Les rôles dépendent du contexte :

| Rôle | Qui | Ce qu'il fait |
|---|---|---|
| Autonome | Tout utilisateur | Crée ses propres programmes, suit ses séances, son poids et son alimentation. |
| Client | Un utilisateur qui a accepté l'invitation d'un coach | Reçoit des programmes assignés, les utilise, et son coach voit ses données de suivi. |
| Coach | Un utilisateur qui active l'« Espace coach » | Bibliothèque de modèles, liste de clients, invitations, assignation, export PDF à son nom. |

Un même compte peut être coach et client (d'un autre coach) en même temps. Un client peut avoir **un seul coach actif** en V1.

## 3. Périmètre de la V1

### 3.1 Comptes
- Inscription et connexion par **e-mail + mot de passe** et **Google** (et **Apple sur iOS**, obligatoire dès qu'on propose Google sur iOS).
- Mot de passe oublié par e-mail.
- Onboarding avec la mascotte : prénom, sexe, date de naissance, taille, poids, niveau d'activité, objectif. Ces données préremplissent les calculs.
- Consentement explicite au traitement des données de santé. Export des données (JSON) et suppression du compte.

### 3.2 Relation coach ↔ client
- Le coach invite de trois façons :
  1. **Par e-mail** : un lien d'inscription ou de connexion qui crée la relation ;
  2. **Par code** : un code court valable 7 jours, que le client saisit dans l'app ;
  3. **Dans l'app** : le coach recherche un utilisateur existant par son e-mail exact et lui envoie une **proposition de coaching**, que l'utilisateur accepte ou refuse depuis son écran d'accueil.
- Le client peut mettre fin au coaching. Le coach perd alors l'accès à ses données de suivi, mais les programmes déjà reçus restent au client.
- Le coach a une fiche par client : programmes assignés, séances réalisées, courbe de poids, adhérence au plan alimentaire (jours remplis dans le journal).
- *Plus tard (hors V1)* : messagerie, bilans hebdomadaires, notifications.

### 3.3 Exercices
- Une bibliothèque d'exercices importée de **free-exercise-db** (873 exercices), traduite en français. Chaque exercice a : nom, muscles principaux et secondaires, matériel, niveau, catégorie, consignes pas à pas, **pose de la mascotte**, et les images d'origine en option.
- Recherche, avec filtres par muscle, matériel et niveau.
- Exercices personnalisés, créés par un coach ou un autonome : nom, muscles, consignes, pose de mascotte choisie dans la liste.

### 3.4 Programmes de musculation
Les données reprennent le prototype (`reference/prototype-studio.html`, mode Musculation).
- Infos du programme : objectif, niveau, lieu, durée par séance, durée du cycle (en semaines), mot du coach.
- **Planning** : du lundi au dimanche, chaque jour reçoit une séance ou « Repos ».
- Séances A, B, C… : nom, muscles ciblés, durée, échauffement, retour au calme, et une liste ordonnée d'exercices.
- Un exercice de séance comporte : un exercice de la bibliothèque, le nombre de séries, les répétitions (texte libre, par exemple « 8–10 », « 10 / jambe », « 40 s »), la charge conseillée, le repos, le tempo et les consignes.
- Le coach peut enregistrer un programme comme **modèle**. **Assigner** un programme à un client crée une **copie** liée au client : le coach peut ensuite la modifier pour ce client sans toucher au modèle.
- **Export PDF** avec la même mise en page que le prototype : couverture et planning, une page par séance, suivi des charges, « Les bases ».

### 3.5 Mode séance guidée (client et autonome)
- « Séance du jour », proposée d'après le planning. On peut aussi lancer n'importe quelle séance.
- Un écran par exercice : la mascotte dans sa pose, les consignes, et les séries à cocher. Pour chaque série, on saisit le **poids** et les **répétitions**, préremplis avec les valeurs de la dernière fois. Les répétitions en réserve (RIR) sont facultatives.
- **Minuteur de repos** automatique après chaque série validée, avec vibration et son, et écran maintenu allumé.
- Écran de fin : durée, volume total, **records battus** (avec la mascotte qui célèbre), et une note libre.
- Fonctionne **hors ligne**, avec synchronisation au retour du réseau.
- Historique des séances et **graphiques de progression** par exercice (charge maximale, meilleur 1RM estimé avec la formule d'Epley, volume).

### 3.6 Programmes de nutrition
Le prototype fait foi, en mode Nutrition.
- Profil : sexe, âge, poids, taille, niveau d'activité, nombre de séances. **Calculs automatiques** : métabolisme de base (formule Mifflin-St Jeor), maintien (métabolisme de base × coefficient d'activité), calories cibles (maintien moins le déficit, ou plus le surplus), protéines et lipides en g/kg, glucides avec les calories restantes, pourcentages, hydratation conseillée (35 ml/kg par défaut), rythme estimé (≈ 7 700 kcal par kg). Alerte si le déficit dépasse 25 % du maintien.
- Objectif, aliments à privilégier et à limiter, mot du coach.
- **Journée type** : repas avec leur heure, et pour chaque repas des lignes aliment, quantité et alternative. Deux modes de saisie, au choix ligne par ligne :
  - **aliment de la base** + quantité en grammes : calories et macros calculées automatiquement ;
  - **saisie libre** (texte et calories à la main), comme dans le prototype.
  Les totaux par repas et par jour sont comparés à la cible.
- **Liste de courses** par rayons, avec quantités et budget. Le client peut cocher les articles dans l'app.
- **Recettes** : photo, temps de préparation et de cuisson, portions, ingrédients (base ou texte libre), étapes et astuce. Macros par portion calculées si les ingrédients viennent de la base.
- La page pédagogique **« Le déficit calorique »**, personnalisée avec les chiffres du client.
- Export PDF identique au prototype, avec les pages à inclure au choix.

### 3.7 Journal alimentaire (à la Yazio)
- Une journée découpée en repas : petit-déjeuner, déjeuner, dîner, collations.
- Trois façons d'ajouter un aliment :
  1. **recherche** dans notre base : Ciqual, produits déjà scannés, aliments et recettes perso ;
  2. **scan du code-barres**, via l'API Open Food Facts appelée depuis l'appareil puis mise en cache chez nous ;
  3. **saisie rapide** : un nom et des calories, macros facultatives.
- Quantité en grammes ou en portions. Ajout rapide des aliments récents et favoris. Copie d'un repas d'un jour vers un autre.
- Anneau de calories et barres de macros comparés à la cible du programme nutrition actif, ou à la cible calculée depuis le profil.
- Création d'aliments personnels et de recettes perso, qui deviennent ensuite recherchables.

### 3.8 Suivi du poids
- Saisie rapide du poids depuis l'accueil, un poids par jour.
- Courbe avec **moyenne glissante sur 7 jours**, ce que le prototype appelle « regarder la tendance ».
- Visible par le coach si une relation de coaching est active.

## 4. Écrans principaux

**Navigation par onglets** (client et autonome) :
1. **Aujourd'hui** : séance du jour, calories et macros du jour, saisie du poids, proposition de coaching en attente.
2. **Entraînement** : mes programmes, lancer une séance, historique, progression.
3. **Nutrition** : mon plan, journal, scan, liste de courses, recettes.
4. **Profil** : données personnelles, objectifs, mon coach, paramètres, accès à l'Espace coach.

**Espace coach**, une bascule depuis le profil, qui donne une navigation dédiée :
- **Clients** : liste avec un indicateur d'activité récente, inviter, fiche client.
- **Bibliothèque** : modèles de programmes (musculation et nutrition), exercices perso, recettes, aliments perso.
- **Éditeurs** de programmes, avec aperçu et export PDF. Sur grand écran web : formulaire à gauche, aperçu à droite, comme dans le prototype.
- **Réglages coach** : nom affiché, contact, couleur d'accent pour les PDF, logo éventuel.

## 5. Modèle de données (indicatif)

- `users` (email, password_hash nullable, name, locale), `auth_identities` (provider google/apple, provider_user_id), `refresh_tokens`
- `profiles` (sex, birth_date, height_cm, activity_level, goal), `coach_settings` (display_name, contact, accent_color)
- `coaching_relations` (coach_id, client_id, status : pending | active | ended), `invitations` (coach_id, email | target_user_id, code, token, status, expires_at)
- `programs` (owner_id, kind : training | nutrition, title, is_template, source_program_id, assigned_to_user_id, start_date, end_date)
- Musculation : `training_details`, `sessions`, `session_exercises`, `weekly_schedule`
- `exercises` (source : free-exercise-db | custom, owner_id, name_fr, name_en, primary_muscles[], secondary_muscles[], equipment, level, category, instructions_fr[], images[], mascot_pose)
- `workout_logs`, `set_logs` (weight_kg, reps, rir, done)
- Nutrition : `nutrition_details` (paramètres de calcul), `meals`, `meal_items` (food_id nullable, free_text, quantity_g, kcal_override…), `shopping_categories`, `shopping_items`, `recipes`, `recipe_ingredients`, `recipe_steps`, `program_recipes`
- `foods` (source : ciqual | off | custom, ciqual_code, barcode, name_fr, brand, valeurs pour 100 g : kcal, protein, carbs, fat, fiber, sugars, salt ; serving_g, owner_id), avec un index trigram sur le nom sans accents
- `food_logs` (date, meal_slot, food_id ou saisie rapide, quantity_g, valeurs nutritionnelles **figées** au moment de la saisie)
- `weight_entries` (date, weight_kg)

## 6. Hors V1 (feuille de route)

Messagerie coach ↔ client, bilans hebdomadaires avec photos, notifications push, paiements et abonnements (le modèle économique reste à décider), mascotte animée pendant la séance, mensurations, mode sombre des écrans (les PDF restent clairs), application en anglais.

## 7. Questions encore ouvertes

- **Modèle économique** : outil interne, paiement des clients, ou abonnement pour les coachs ? Cela change les étapes de paiement et de stores.
- **Publication** : stores (comptes développeur Apple à 99 $/an et Google à 25 $) ou web installable seulement au début ?
- **Nom de domaine** et **fournisseur d'e-mails** pour les invitations.
- **Certification HDS** de l'hébergement : à faire vérifier par un professionnel, vu la nature des données.
