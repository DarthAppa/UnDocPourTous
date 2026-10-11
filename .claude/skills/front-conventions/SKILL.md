---
name: front-conventions
description: Conventions HTML, CSS, JS et Tailwind du site UnDocPourTout. À utiliser dès qu'on écrit ou modifie index.html, style.css, script.js ou une nouvelle page.
---

# Conventions front UnDocPourTout

## HTML
- Squelette unique : `<!DOCTYPE html>`, `<html lang="fr" class="no-js">`, un seul `<head>`, un seul `<body>`.
- Ordre du `<head>` : meta charset/viewport → `<title>` + meta description → polices Google (preconnect + link) → Tailwind CDN → `tailwind.config` → `style.css` → `script.js` avec `defer`.
- Balises sémantiques : `header`, `nav`, `main`, `section` (avec `id`), `article` pour les cartes, `footer`. Un seul `h1` par page, puis `h2`/`h3` dans l'ordre.
- Images : `assets/img/`, toujours `alt`, `width`/`height`, `loading="lazy"` hors hero. Format `.webp` de préférence.
- Éléments décoratifs : `aria-hidden="true"`. Boutons d'action = `<button>`, navigation = `<a href>`.

## Tailwind (CDN v3)
- La config vit dans `<script>tailwind.config = {...}</script>` juste après le script CDN. Ne pas la dupliquer.
- Tokens : `darkBg #0B0F17`, `cardBg #151A25`, `cardBorder #232A3B`, `brandOrange #FF7A1A`, `brandOrangeHover #FF8F3D`, `textLight #F2EEE6`, `mintFree #2EC4A6`, `holo #5EE7FF`. Polices : `font-sans` (Inter), `font-cinzel` (Cinzel).
- N'utiliser une classe personnalisée (`bg-xxx`) que si le token existe dans la config. Sinon l'ajouter à la config ET en variable CSS dans `:root` de `style.css`.
- Tailwind pour la mise en page (grille, flex, espacements, responsive `sm: md: lg:`). `style.css` pour ce qui est long ou répété : dégradés complexes, animations, pseudo-éléments, composants (`.btn-primary`, `.btn-outline`, `.game-card`, `.tool-card`).
- Si une liste de classes se répète 3 fois ou plus, créer une classe composant dans `style.css`.
- Mobile d'abord : style de base = mobile, puis `md:` / `lg:`.
- Le CDN est pratique mais non recommandé en production. Pour passer au build : `npx tailwindcss@3 -i src/input.css -o style.build.css --minify` avec un `tailwind.config.js` reprenant les mêmes tokens.

## CSS
- Variables dans `:root` (mêmes valeurs que les tokens Tailwind).
- Sections commentées : `/* ===== HERO ===== */`.
- Animations : toujours respecter `@media (prefers-reduced-motion: reduce)`.
- Jamais de largeur fixe qui dépasse 390px sans `max-width: 100%` ou media query. Les décors positionnés en `absolute` sont dans un parent `overflow: hidden`.
- Contraste texte/fond ≥ 4.5:1 (le gris `text-gray-400` sur `darkBg` passe, `text-gray-500` uniquement pour du texte secondaire court).

## JS
- Vanilla JS, pas de framework. Tout dans `DOMContentLoaded`.
- Première ligne : `document.documentElement.classList.replace('no-js', 'js');`
- Tester l'existence d'un élément avant de l'utiliser (`el?.addEventListener`).
- Le contenu doit être lisible sans JS : le JS ne fait qu'ajouter (animations, données de démo, menus).
- Désactiver les `setInterval` décoratifs si `prefers-reduced-motion`.
- Pas de `localStorage` pour des données importantes ; seulement des préférences (thème, onglet choisi), dans un `try/catch`.

## Contenu
- Textes en français, tutoiement.
- Pas de logo officiel de jeu : nom du jeu en texte stylisé (`.wordmark`).
- Mention en pied de page : « Site de fan non affilié aux éditeurs des jeux mentionnés. »
