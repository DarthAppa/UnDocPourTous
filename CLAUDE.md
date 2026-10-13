# UnDocPourTous — site statique

Site de guides et d'outils gratuits pour joueurs (Albion Online, Path of Exile, World of Warcraft).
Hébergé sur GitHub Pages, branche `main`, domaine dans `CNAME`.

## Fichiers
- `index.html` : structure + config Tailwind (bloc `tailwind.config` dans le `<head>`)
- `style.css` : tout ce que Tailwind ne fait pas bien (décors, animations, composants `.btn-primary`, `.game-card`, `.tool-card`…)
- `script.js` : interactions (dropdowns, menu mobile, parallaxe, apparition au scroll)
- `tools/screenshot.mjs` : captures desktop + mobile pour vérifier le rendu

## Commandes
- Vérifier le rendu : `npm run shot` (captures dans `shots/`, affiche les erreurs console et le débordement horizontal)
- Première installation : `npm install` puis `npx playwright install chromium`
- Outils installés sur le PC (Windows) : Node 24 / npm 11, Git 2.56, Python 3.12 (`python`, `py -3.12`) + Pillow (`py -3.12 -m pip install ...`), Python 3.13 en plus (`py -3.13`), GitHub CLI `gh` 2.102, `clasp` 3.4 (Google Apps Script : `clasp push`, `clasp pull`), Docker 29 (Docker Desktop doit être lancé).
- Prévu : panels Google Apps Script (clasp), bot Discord Node.js (discord.js), abonnements Stripe, VPS avec Docker.
- IMPORTANT : jamais de token, clé API ou mot de passe dans le code ; tout va dans `.env` (ignoré par git) avec un `.env.example` sans valeurs.

## Règles
- IMPORTANT : un seul `<head>` contenant polices, Tailwind, `style.css` et `script.js` (en `defer`). Ne jamais dupliquer le contenu de la page.
- Couleurs : uniquement les tokens définis dans `tailwind.config` (`darkBg`, `cardBg`, `cardBorder`, `brandOrange`, `brandOrangeHover`, `textLight`, `mintFree`, `holo`) et leurs équivalents `--var` dans `style.css`. Un nouveau token s'ajoute aux deux endroits.
- Pas d'image qui n'existe pas dans le dépôt. Les images vont dans `assets/img/`. Sans image : visuel en CSS/SVG.
- Pas de logos officiels des jeux (droits) : noms en texte stylisé uniquement.
- Textes du site en français.
- Mobile d'abord : tester à 390px et 1280px, aucune barre de défilement horizontale.
- Le contenu doit rester visible sans JS (les classes `.reveal` ne cachent qu'avec `.js` sur `<html>`).
- Après toute modification visuelle : lancer `npm run shot`, regarder les captures, corriger avant de dire que c'est fini.

## Git
- Commits courts en français, ex. `feat: carte Lost Ark`, `fix: débordement mobile du hero`.
- Ne pas committer `node_modules/` ni `shots/`.
