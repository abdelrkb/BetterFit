# Référence (lecture seule)

- `prototype-studio.html` : le prototype BetterFit Studio qui fonctionne (nutrition + musculation, calculs, aperçu des pages, export PDF). Ouvre-le dans un navigateur. La sauvegarde et l'export ne fonctionnent que dans l'environnement d'origine, mais l'aperçu et les calculs marchent partout.
- `mascot.js` : le squelette SVG paramétrique de la mascotte et ses 17 poses, avec la détection de pose à partir du nom de l'exercice.

Ces fichiers servent de modèle pour les calculs (`compute()`), les gabarits PDF (`page*()`) et la mascotte (`mascotSVG()`, `POSES`, `POSE_RULES`). Ne les modifie pas : porte leur logique dans `packages/`.
