---
name: front-conventions
description: Conventions HTML, CSS, JS, Astro et Tailwind du site UnDocPourTous. À utiliser dès qu'on écrit ou modifie une page (src/pages/*.astro), un composant, style.css, un script du site ou une nouvelle page.
---

# Conventions front UnDocPourTous

## Structure (Astro, site statique)

- Pages : `src/pages/<nom>.astro` → publiée en `<nom>.html` (mêmes adresses qu'avant). Chaque page utilise le gabarit `src/layouts/Base.astro` :
    ```astro
    ---
    import Base from '../layouts/Base.astro';
    ---

    <Base titre="Sujet" description="…" scripts={['assets/js/ma-page.js']}>
        <main>…</main>
    </Base>
    ```
    Props : `titre` (sans « — UnDocPourTous », ajouté par le gabarit), `description`, `scripts` (modules propres à la page), `noindex`, `cinzel` (police Pack ta Small).
- `<head>`, en-tête (`src/components/EnTete.astro`) et pied de page (`src/components/PiedDePage.astro`) existent UNE seule fois : ne jamais les recopier dans une page.
- Nom du site, URL, polices : `src/site.js` (`SITE.nom`), jamais écrits en dur ailleurs dans le code Astro.
- Fichiers servis tels quels : `public/` (`public/assets/js`, `public/assets/css/style.css`, `public/assets/img`, `public/assets/icons`). Chemins relatifs dans les pages : `assets/img/…`, `assets/js/…`.
- Généré, jamais modifié ni commité : `dist/` (site construit), `public/assets/css/tailwind.css`. Pages PTS `public/pts-*.html` : générées par `npm run import:pts`.
- Commandes : `npm run dev` (site en direct avec rechargement), `npm run build` (dist/ + CSP), `npm run serve` (sert dist/).

## HTML

- Balises sémantiques : `header`, `nav`, `main`, `section` (avec `id`), `article` pour les cartes, `footer`. Un seul `h1` par page, puis `h2`/`h3` dans l'ordre.
- Images : `public/assets/img/`, toujours `alt`, `width`/`height`, `loading="lazy"` hors hero. Format `.webp` de préférence.
- Éléments décoratifs : `aria-hidden="true"`. Boutons d'action = `<button>`, navigation = `<a href>`.
- Pas d'accolades `{ }` dans le texte d'une page Astro (elles ouvrent une expression) : écrire `{'{'}` si besoin.
- Pas de script inline ni de `onclick=` (CSP stricte) : un fichier dans `public/assets/js` chargé via la prop `scripts`.

## Tailwind (v3 compilé)

- Config : `tailwind.config.cjs`, source `src/styles/tailwind.css`, compilé par `npm run build:css` (lancé par `dev` et `build`).
- Tokens : uniquement ceux de `tailwind.config.cjs`. Un nouveau token s'ajoute à la config ET en variable CSS dans `:root` de `public/assets/css/style.css`.
- Tailwind pour la mise en page (grille, flex, espacements, responsive `sm: md: lg:`). `style.css` pour ce qui est long ou répété : dégradés complexes, animations, pseudo-éléments, composants (`.btn-primary`, `.btn-outline`, `.game-card`, `.tool-card`).
- Si un bloc se répète 3 fois ou plus : en faire un composant Astro dans `src/components/` (ou une classe dans `style.css` si ce n'est que du style).
- Mobile d'abord : style de base = mobile, puis `md:` / `lg:`.
- Classes écrites en entier (pas de `bg-${couleur}`) : Tailwind lit les fichiers, pas le résultat.

## CSS

- Variables dans `:root` (mêmes valeurs que les tokens Tailwind).
- Sections commentées : `/* ===== HERO ===== */`.
- Dans `style.css`, les `url()` sont relatives au fichier CSS : `url('../icons/x.svg')`.
- Animations : toujours respecter `@media (prefers-reduced-motion: reduce)`.
- Jamais de largeur fixe qui dépasse 390px sans `max-width: 100%` ou media query. Les décors positionnés en `absolute` sont dans un parent `overflow: hidden`.
- Contraste texte/fond ≥ 4.5:1.

## JS

- Vanilla JS (modules ES) dans `public/assets/js`, pas de framework pour l'instant. React possible plus tard en « îlot » Astro pour un outil interactif.
- `script.js` : `document.documentElement.classList.replace('no-js', 'js');` en première ligne.
- Tester l'existence d'un élément avant de l'utiliser (`el?.addEventListener`).
- Le contenu doit être lisible sans JS : le JS ne fait qu'ajouter (animations, données, menus).
- Désactiver les `setInterval` décoratifs si `prefers-reduced-motion`.
- Pas de `localStorage` pour des données importantes ; seulement des préférences, dans un `try/catch`.
- Pas de `innerHTML` avec une donnée externe.

## Contenu

- Textes en français, tutoiement.
- Pas de logo officiel de jeu : nom du jeu en texte stylisé.
- Mention en pied de page : « Non affilié aux éditeurs des jeux cités. »
