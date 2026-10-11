---
name: ajout-jeu
description: Ajoute un nouveau jeu au site (carte d'accueil, entrée de menu, thème de couleur). Utilisation : /ajout-jeu Nom du jeu
disable-model-invocation: true
---

# Ajouter le jeu : $ARGUMENTS

Suivre `front-conventions`.

1. Lire la section `#jeux` de `index.html` et les thèmes `.theme-*` de `style.css` pour reprendre exactement le même modèle de carte.
2. Choisir une couleur d'ambiance qui ne ressemble pas aux thèmes existants (vert Albion, rouge-brun PoE, bleu WoW).
3. Ajouter dans `style.css` une classe `.theme-<slug>` (variables `--accent-border`, `--glow`, `--card-bg`) et, si utile, un petit décor SVG/CSS dans `.card-art`.
4. Ajouter la carte `<article class="game-card theme-<slug> reveal">` dans `#jeux` : wordmark texte (pas de logo officiel), titre, description de 1 à 2 phrases en français, bouton, emblème.
5. Ajouter le jeu dans le menu déroulant « Guides ».
6. Adapter la grille si besoin (4 cartes : `md:grid-cols-2 lg:grid-cols-4`).
7. Lancer `verif-visuelle`, puis proposer un commit `feat: ajout de $ARGUMENTS`.
