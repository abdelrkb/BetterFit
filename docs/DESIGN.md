# BetterFit — direction artistique

La référence visuelle est `reference/prototype-studio.html` : ouvre-le dans un navigateur, crée un client et regarde les deux modes. L'app reprend son langage visuel.

> **Note.** Ce fichier a été reconstitué le 29 octobre 2026 après la perte de l'original (voir la note d'exploitation dans `docs/PROGRESS.md`). Les couleurs, la typographie et les règles de la mascotte sont celles effectivement utilisées dans le code — elles font donc foi. Si tu avais ajouté des passages qui manquent ici, remets-les.

## Couleurs

| Token | Valeur | Usage |
|---|---|---|
| `night` | `#1E0D45` | Bandeaux sombres, chips, fonds de couverture |
| `accent` | `#6B3FD9` | Couleur principale. Le coach peut la changer pour ses PDF : `#8B5CF6`, `#A21CAF`, `#4C1D95` |
| `accentSoft` | `#EDE6FA` | Cartes douces, fonds de mascotte |
| `lilac` | `#C4ADFF` | Accents sur fond sombre, troisième barre de macros |
| `violetMid` | `#8F6BEA` | Deuxième barre de macros, contours de cases |
| `ink` | `#1C0F3A` | Texte principal |
| `inkSoft` | `#3B3054` | Texte courant secondaire |
| `muted` | `#6E6290` | Libellés, légendes (contraste vérifié sur `paper`) |
| `paper` | `#F7F4FC` | Fond des pages |
| `card` | `#FFFFFF` + bordure `#E6DDF7` | Cartes |

États : `success` `#1B7F4B`, `warning` `#9A5B00`, `danger` `#B4413A`. Textes sur fond sombre : `onDark` `#FFFFFF`, `onDarkSoft` `#D9CEF5`.

L'app est conçue d'abord en clair. Un thème sombre viendra plus tard. Les PDF restent toujours clairs.

### Couleurs des graphiques

Les séries de graphique ont leur propre palette, dans cet ordre et **jamais recyclée** : `#6B3FD9`, `#C2410C`, `#0891B2`, `#9A5B00`. Grille et axes en `#E6DDF7`, volontairement discrets.

Ces couleurs ont été vérifiées : écart perceptuel suffisant en protanopie, deutéranopie et tritanopie, et contraste d'au moins 3:1 sur une carte blanche. **Ne pas les remplacer sans refaire la vérification.** Et la couleur ne porte jamais seule l'information : chaque courbe est aussi nommée dans une légende, étiquetée à son dernier point, et doublée d'un tableau de chiffres.

## Typographie

- **Unbounded** (700, 800) pour les titres, les grands chiffres et le logo « BETTER**FIT** » (la partie « FIT » est en couleur d'accent).
- **Manrope** (400 à 800) pour tout le reste.
- Les deux viennent de Google Fonts, via `@expo-google-fonts/unbounded` et `@expo-google-fonts/manrope`.
- Les sur-titres sont en majuscules, 11–12 px, espacement 1,5–3 px, en couleur d'accent ou `muted`.
- Les chiffres alignés utilisent `fontVariant: ['tabular-nums']`.
- Les décimales s'écrivent avec une **virgule** : « 79,5 kg », jamais « 79.5 ».

## Formes

- Rayons : 18 px pour les cartes, 14 px pour les tuiles et les pastilles, 22 px pour les grandes cartes héro.
- Les cercles décoratifs en couleur d'accent, à 55 % d'opacité, débordent des bandeaux sombres : c'est la signature visuelle.
- Pas de dégradés, pas d'emoji, pas d'ombres lourdes.
- Zones tactiles d'au moins 44 px, contrastes d'au moins 4,5:1.

## Ton

On **tutoie** l'utilisateur. Phrases courtes, concrètes et bienveillantes, comme un coach qui parle à son client (« Regarde la tendance », « La technique avant la charge »).

## La mascotte

Un **singe violet, sans yeux**. Il a un museau clair, une oreille ronde, une petite mèche sur la tête, une longue queue enroulée et un léger sourire. **Ne jamais lui ajouter d'yeux**, ni de point ou de tache qui pourrait en tenir lieu — un test automatique le vérifie.

### Implémentation
`reference/mascot.js` contient la version d'origine ; `packages/mascot` la porte en `react-native-svg`. Un squelette SVG paramétrique en vue de profil, dans un `viewBox` de 0 0 100 100 avec le sol à y ≈ 93.

- Chaque **pose** décrit : la position de la hanche, l'angle du buste, les angles bras et avant-bras (bras proche et bras éloigné), les angles cuisse et tibia (jambe proche et jambe éloignée), et éventuellement l'angle des pieds et un accessoire.
- Convention des angles : 0° = vers le bas, 90° = vers l'avant, 180° = vers le haut, −90° = vers l'arrière.
- Couleurs : corps `#7B4FE6`, membres éloignés `#5A35B8`, museau et ventre `#D4C3FF`, intérieur de l'oreille `#B79CF5`, matériel `#2A1758`.
- Accessoires : barre (disque vu de profil), haltère, deux haltères, barre de traction, banc, siège de machine, disque sur les hanches.
- 17 poses : `stand`, `flex`, `squat`, `hinge`, `bench`, `pushup`, `plank`, `press`, `row`, `pullup`, `lunge`, `curl`, `triceps`, `bridge`, `raise`, `seated`, `cardio`.

Le composant s'utilise ainsi : `<Mascot pose="squat" size={96} />`. Le même calcul produit aussi la chaîne SVG des gabarits PDF, sans recopie.

Un test de fidélité rejoue `reference/mascot.js` et compare **chaque coordonnée des 17 poses**. C'est ce qui garantit que le portage ne dérive jamais.

### Les exercices utilisent les photos de la base, pas la mascotte
**Décidé le 27 octobre 2026 par le porteur du projet.** Les 873 exercices de free-exercise-db viennent avec **deux photos chacun** (position de départ et position d'arrivée), en licence Unlicense (domaine public). Ce sont ces photos qui illustrent la bibliothèque d'exercices et la séance guidée : elles montrent le mouvement réel mieux qu'une pose figée, et il n'y a pas 873 poses à dessiner.

Il n'y a donc **pas** de nouvelles poses à créer. Le champ `mascot_pose` reste utile pour les **exercices personnalisés**, que le coach crée sans photo : il choisit alors une pose dans la liste des 17.

### Où la mascotte apparaît
- onboarding : elle présente l'app ;
- écrans vides : « Pas encore de séance », avec la pose `stand` ;
- célébrations : record battu ou série de séances, avec la pose `flex` ;
- erreurs réseau ;
- écran de fin de séance ;
- couverture des PDF de musculation et page « Les bases » ;
- exercices personnalisés sans photo.

### Variante claire
Sur un fond sombre ou violet (bouton d'accent, carte héro, couverture de PDF), le corps violet de la mascotte se confondrait avec le fond. Le composant accepte donc `tone="onDark"`, qui l'éclaircit. Sur fond clair, on garde la variante par défaut.

### Écran de démonstration
`apps/app/app/(main)/demo.tsx` montre les 17 poses en grille, les deux variantes et tous les composants de base.
