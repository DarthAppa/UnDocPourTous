# UnDocPourTous — site statique

Site de guides et d'outils gratuits pour joueurs (Albion Online, Path of Exile, World of Warcraft).
Hébergé sur GitHub Pages, branche `main`, domaine dans `CNAME`.

## Fichiers

- Pages (en-tête/pied de page répétés dans chaque page) : `index.html`, `albion*.html`, `pts.html`, `connexion-pts.html`, `profil.html` (Mon profil, connectés seulement), `albion-builder-tryhard.html` (gabarit Premium, contenu chargé depuis la base)
- `tailwind.config.cjs` : config Tailwind (couleurs, polices), compilée par `npm run build:css` vers `assets/css/tailwind.css` (fichier commité, chargé APRÈS `style.css`). Relancer après tout changement de classes ou de couleurs
- `style.css` : tout ce que Tailwind ne fait pas bien (décors, animations, composants `.btn-primary`, `.game-card`, `.tool-card`…)
- `script.js` : interactions (dropdowns, menu mobile, parallaxe, apparition au scroll)
- `tools/screenshot.mjs` : captures desktop + mobile pour vérifier le rendu
- Pack ta Small (fan game, logo et typo officiels autorisés) : `pts.html` (page du jeu, gabarit du site) ; `pts-encyclopedie.html` et `pts-builder.html` sont GÉNÉRÉES par `npm run import:pts` depuis `../1_PTS/Encyclopedie` (Partie1 sans le chapitre GOAT & Légendes ; Partie3 réduite au Builder Ma collection, qui lit la collection du joueur dans Supabase via `pts-ma-collection.js`) : ne pas les modifier à la main, modifier la source ou `tools/import-pts.mjs` puis relancer
- Comptes et accès : `pts-config.js` (URL Supabase + clé anon, id du serveur PTS), `pts-auth.js` (module d'auth de TOUT le site : connexion Discord, état, garde, inactivité, `monAcces()`, `chargerContenu()`, profil, export/suppression), `entete.js` (« Connexion » → « Mon profil » + anti-clickjacking), `pts-page.js`, `profil.js`, `premium-page.js` (affichage + nettoyage du contenu Premium), `paiement.js`, `connexion-pts.html` + `pts-connexion.js`. Client Supabase vendu : `assets/vendor/supabase.mjs` (`npm run vendor:supabase`, jamais de CDN)
- Serveur : `supabase/` (migrations SQL + RLS, Edge Functions `verifier-guilde`, `creer-paiement`, `portail-abonnement`, `stripe-webhook`, `supprimer-compte`, mode d'emploi `supabase/LISEZMOI.md`). Droits : `abonnements` (écrit par le webhook Stripe), `membres_pts` (écrit par `verifier-guilde`), `contenus` (payants, lisibles seulement si `a_acces()`)
- Tests : `npm run test:pts`, `test:profil`, `test:premium` (Playwright + faux Supabase `tools/faux-supabase.mjs`), `test:fonctions` (logique des Edge Functions), `test:rls` (règles de la base, besoin d'un Postgres : `DATABASE_URL`, tourne en CI). `npm run shot` passe par un serveur local (`tools/serveur.mjs`)

## Commandes

- Vérifier le rendu : `npm run shot` / `node tools/screenshot.mjs page.html` (captures dans `shots/`, affiche les erreurs console et le débordement horizontal)
- Tout vérifier : `npm run verif` (voir plus bas)
- Première installation : `npm install` puis `npx playwright install chromium`
- Outils installés sur le PC (Windows) : Node 24 / npm 11, Git 2.56, Python 3.12 (`python`, `py -3.12`) + Pillow (`py -3.12 -m pip install ...`), Python 3.13 en plus (`py -3.13`), GitHub CLI `gh` 2.102, `clasp` 3.4 (Google Apps Script : `clasp push`, `clasp pull`), Docker 29 (Docker Desktop doit être lancé).
- Prévu : panels Google Apps Script (clasp), bot Discord Node.js (discord.js), VPS avec Docker. Abonnements Stripe : code prêt (`supabase/`), à configurer (voir `supabase/LISEZMOI.md`).
- IMPORTANT : jamais de token, clé API ou mot de passe dans le code ; tout va dans `.env` (ignoré par git) avec un `.env.example` sans valeurs.

## Règles

- IMPORTANT : un seul `<head>` contenant la CSP, polices, `style.css`, `assets/css/tailwind.css`, `script.js` (en `defer`) et `entete.js` (module). Ne jamais dupliquer le contenu de la page.
- Couleurs : uniquement les tokens définis dans `tailwind.config.cjs` et leurs équivalents `--var` dans `style.css`. Un nouveau token s'ajoute aux deux endroits.
- Pas d'image qui n'existe pas dans le dépôt. Les images vont dans `assets/img/`. Sans image : visuel en CSS/SVG.
- Pas de logos officiels des jeux (droits) : noms en texte stylisé uniquement.
- IMPORTANT : nom officiel du site « UnDocPourTous » (un seul mot, U, D, P, T majuscules, S final), jamais « UnDocPourTout ». Seule variante tolérée : « Un Doc Pour Tous » en toutes lettres. Dans le code généré, le nom est défini une seule fois (constante, ex. `site.nom` dans les données) et réutilisé partout.
- Chaque page : `<title>` au format « Sujet — UnDocPourTous » et `og:site_name="UnDocPourTous"`.
- Cartes = un seul lien sur toute leur surface (`.card-link`), sans bouton dedans ; indice en texte (`.card-hint`) ; cartes « Bientôt » (`.card-soon`) non cliquables.
- Textes du site en français.
- Mobile d'abord : tester à 390px et 1280px, aucune barre de défilement horizontale.
- Le contenu doit rester visible sans JS (les classes `.reveal` ne cachent qu'avec `.js` sur `<html>`).
- Après toute modification visuelle : lancer `npm run shot`, regarder les captures, corriger avant de dire que c'est fini.

## Sécurité (skill `securite`, à lire avant tout code sensible)

- IMPORTANT : le dépôt est PUBLIC. Aucun secret (seule la clé `anon` Supabase est permise côté navigateur) et AUCUN contenu payant dans le dépôt : il va dans la table `contenus` via `npm run publier:contenu` depuis `contenus-prives/` (ignoré) — skill `contenu-premium`.
- Aucun droit décidé par le navigateur : premium = table `abonnements` (webhook Stripe), membre PTS = `membres_pts` (Edge Function). Pas de `innerHTML` avec une donnée externe.
- CSP en `<meta>` sur chaque page (`npm run csp`, à relancer après tout script inline) : pas de script inline écrit à la main, pas de `onclick=`/`javascript:`, aucun script ou CDN tiers.
- Toute table/policy/fonction SQL : migration dans `supabase/migrations/` + cas dans `tools/test-rls.mjs` (skill `supabase-rls`). Paiements : skill `paiements-stripe`. Audit complet : skill `audit-securite`.

## Git

- Commits courts en français, ex. `feat: carte Lost Ark`, `fix: débordement mobile du hero`.
- Ne pas committer `node_modules/` ni `shots/`.
- Jamais de push direct sur `main` : branche `feat/…`, `fix/…` ou `chore/…` puis pull request (skill `pull-request`, ou `/publier`).

## Vérification du code (obligatoire avant toute PR)

- IMPORTANT : `npm run verif` doit être vert avant de dire qu'une tâche est finie, avant un push et avant une PR (skill `verif-code`). `npm run verif:rapide` = sans captures, pour itérer.
- Contenu : Prettier, ESLint, Stylelint, html-validate, `tools/regles.mjs` (règles de ce fichier : titres, `og:site_name`, tokens, cartes, liens/images, secrets, pas de CDN Tailwind), CSS Tailwind à jour, classes présentes, CSP à jour, tests (Edge Functions, verrou PTS, profil, Premium ; RLS si `DATABASE_URL`), `npm audit`, captures 390/1280px de chaque page. GitHub ajoute CodeQL et Dependabot.
- Triple verrou : hook git `pre-push` (installé par `npm install`), hook Claude `.claude/hooks/avant-pr.mjs` avant `gh pr create`, GitHub Actions `.github/workflows/verif.yml` sur chaque PR.
- Corriger la cause, jamais la règle : pas de `eslint-disable`, pas de `--no-verify`, pas d'ignore élargi sans accord.
- `npm run format` corrige le formatage ; `npm run lint:fix` une partie du JS/CSS.
- Skills : `verif-code`, `revue-code` (relecture), `corriger-bug`, `securite`, `audit-securite`, `supabase-rls`, `paiements-stripe`, `contenu-premium`, `pull-request`, `publier`, plus `verif-visuelle`, `audit-front`, `front-conventions`.
