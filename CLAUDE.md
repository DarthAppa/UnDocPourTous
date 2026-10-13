# UnDocPourTous — site statique

Site de guides et d'outils gratuits pour joueurs (Albion Online, Path of Exile, World of Warcraft).
Hébergé sur GitHub Pages, branche `main`, domaine dans `CNAME`.

## Fichiers
- `index.html`, `albion.html`, `albion-gratuit.html`, `albion-paiement.html` : pages (en-tête/pied de page répétés dans chaque page)
- `tailwind-config.js` : config Tailwind partagée (couleurs, polices), chargée après le CDN
- `style.css` : tout ce que Tailwind ne fait pas bien (décors, animations, composants `.btn-primary`, `.game-card`, `.tool-card`…)
- `script.js` : interactions (dropdowns, menu mobile, parallaxe, apparition au scroll)
- `tools/screenshot.mjs` : captures desktop + mobile pour vérifier le rendu
- Pack ta Small (fan game, logo et typo officiels autorisés) : `pts.html` (page du jeu, gabarit du site) ; `pts-encyclopedie.html` et `pts-builder.html` sont GÉNÉRÉES par `npm run import:pts` depuis `../1_PTS/Encyclopedie` (Partie1, Partie2) : ne pas les modifier à la main, modifier la source ou `tools/import-pts.mjs` puis relancer
- Verrou PTS (« si connecté avec Discord ET membre du serveur PTS → outils débloqués, sinon les cartes mènent au Discord PTS ») : `pts-config.js` (réglages Supabase + id du serveur), `pts-auth.js` (connexion, état, garde des pages outils), `pts-page.js` (cartes de `pts.html`), `connexion-pts.html` + `pts-connexion.js` (page de connexion). Tester : `npm run test:pts`. `npm run shot` passe par un serveur local (`tools/serveur.mjs`) pour que les modules JS marchent

## Commandes
- Vérifier le rendu : `npm run shot` / `node tools/screenshot.mjs page.html` (captures dans `shots/`, affiche les erreurs console et le débordement horizontal)
- Première installation : `npm install` puis `npx playwright install chromium`
- Outils installés sur le PC (Windows) : Node 24 / npm 11, Git 2.56, Python 3.12 (`python`, `py -3.12`) + Pillow (`py -3.12 -m pip install ...`), Python 3.13 en plus (`py -3.13`), GitHub CLI `gh` 2.102, `clasp` 3.4 (Google Apps Script : `clasp push`, `clasp pull`), Docker 29 (Docker Desktop doit être lancé).
- Prévu : panels Google Apps Script (clasp), bot Discord Node.js (discord.js), abonnements Stripe, VPS avec Docker.
- IMPORTANT : jamais de token, clé API ou mot de passe dans le code ; tout va dans `.env` (ignoré par git) avec un `.env.example` sans valeurs.

## Règles
- IMPORTANT : un seul `<head>` contenant polices, Tailwind, `style.css` et `script.js` (en `defer`). Ne jamais dupliquer le contenu de la page.
- Couleurs : uniquement les tokens définis dans `tailwind-config.js` (`darkBg`, `cardBg`, `cardBorder`, `brandOrange`, `brandOrangeHover`, `textLight`, `mintFree`, `holo`) et leurs équivalents `--var` dans `style.css`. Un nouveau token s'ajoute aux deux endroits.
- Pas d'image qui n'existe pas dans le dépôt. Les images vont dans `assets/img/`. Sans image : visuel en CSS/SVG.
- Pas de logos officiels des jeux (droits) : noms en texte stylisé uniquement.
- IMPORTANT : nom officiel du site « UnDocPourTous » (un seul mot, U, D, P, T majuscules, S final), jamais « UnDocPourTout ». Seule variante tolérée : « Un Doc Pour Tous » en toutes lettres. Dans le code généré, le nom est défini une seule fois (constante, ex. `site.nom` dans les données) et réutilisé partout.
- Chaque page : `<title>` au format « Sujet — UnDocPourTous » et `og:site_name="UnDocPourTous"`.
- Cartes = un seul lien sur toute leur surface (`.card-link`), sans bouton dedans ; indice en texte (`.card-hint`) ; cartes « Bientôt » (`.card-soon`) non cliquables.
- Textes du site en français.
- Mobile d'abord : tester à 390px et 1280px, aucune barre de défilement horizontale.
- Le contenu doit rester visible sans JS (les classes `.reveal` ne cachent qu'avec `.js` sur `<html>`).
- Après toute modification visuelle : lancer `npm run shot`, regarder les captures, corriger avant de dire que c'est fini.

## Git
- Commits courts en français, ex. `feat: carte Lost Ark`, `fix: débordement mobile du hero`.
- Ne pas committer `node_modules/` ni `shots/`.
