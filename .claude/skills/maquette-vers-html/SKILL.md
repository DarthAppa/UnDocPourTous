---
name: maquette-vers-html
description: Transforme une maquette (image collée ou fichier) en page ou section HTML/Tailwind fidèle. À utiliser quand l'utilisateur fournit une maquette, une capture ou une image de design à reproduire.
---

# Maquette → HTML

Suivre aussi le skill `front-conventions`.

## 1. Analyser avant de coder

Décrire la maquette en liste courte :

- sections de haut en bas (header, hero, cartes, etc.) et leur disposition (colonnes, alignement) ;
- couleurs dominantes → les rapprocher des tokens existants, en proposer de nouveaux seulement si nécessaire ;
- typographies (titres, texte), tailles relatives, arrondis, ombres, lueurs ;
- éléments visuels : lesquels existent en image dans `assets/img/`, lesquels seront faits en CSS/SVG ;
- textes : les placeholders (« Headline », « Call-to-Action ») sont remplacés par de vrais textes en français.

## 2. Construire

- Modifier le fichier existant section par section, sans recopier la page entière ni la dupliquer.
- Mise en page Tailwind ; décors et effets dans `style.css` ; animations légères dans `script.js`.
- Mobile pris en compte dès le départ (empilement des colonnes, décors réduits ou masqués).

## 3. Vérifier et corriger

- Lancer le skill `verif-visuelle`.
- Comparer `shots/desktop.png` à la maquette : lister les écarts, corriger, recommencer (2 à 3 passes en général).

## 4. Rendre compte

- Ce qui est fidèle, ce qui diffère volontairement (logos de jeux non reproduits, images remplacées par du CSS) et pourquoi.
