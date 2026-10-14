# UnDocPourTous — site statique (Astro)

Site de guides et d'outils gratuits pour joueurs (Albion Online, Path of Exile, World of Warcraft).
Hébergé sur GitHub Pages (construit et publié par GitHub Actions à chaque fusion dans `main`), domaine dans `public/CNAME`.

## Fichiers

Site construit avec **Astro** (Node.js, sortie 100 % statique) et publié par GitHub Actions (`.github/workflows/pages.yml`) sur GitHub Pages à chaque fusion dans `main`. Domaine dans `public/CNAME`.

```
src/
  pages/        une page = un fichier .astro → publiée en <nom>.html (index, albion*, pts, connexion-pts, profil…)
  layouts/      Base.astro : LE <head> (polices, CSS, scripts), l'en-tête et le pied de page de toutes les pages
  components/   EnTete.astro, PiedDePage.astro (et les futurs composants : cartes, boutons…)
  styles/       tailwind.css (source Tailwind)
  site.js       nom du site (SITE.nom), URL, polices : définis une seule fois
public/         copié tel quel dans le site
  assets/js/    scripts du navigateur (modules ES, vanilla)
  assets/css/   style.css (fait main) ; tailwind.css est GÉNÉRÉ (non suivi par git)
  assets/img/, assets/icons/, assets/vendor/supabase.mjs (client Supabase servi par le site)
  pts-encyclopedie.html, pts-builder.html   pages Pack ta Small GÉNÉRÉES par npm run import:pts
  CNAME, .well-known/security.txt
supabase/       migrations SQL + RLS, Edge Functions, mode d'emploi LISEZMOI.md
tools/          build CSS, CSP, règles maison, captures, tests (Playwright + faux Supabase), import PTS
dist/           site construit (npm run build) : jamais modifié à la main, jamais commité
```

- Nouvelle page : `src/pages/<nom>.astro` avec `<Base titre="Sujet" description="…" scripts={['assets/js/x.js']}>` (props `noindex`, `cinzel` si besoin) ; le titre reçoit « — UnDocPourTous » automatiquement. Ne jamais recopier le `<head>`, l'en-tête ou le pied de page.
- `tailwind.config.cjs` : couleurs, polices. Compilé par `npm run build:css` (lancé par `dev` et `build`) vers `public/assets/css/tailwind.css`, chargé APRÈS `style.css`.
- `public/assets/css/style.css` : tout ce que Tailwind ne fait pas bien (décors, animations, composants `.btn-primary`, `.game-card`, `.tool-card`…). Les `url()` y sont relatives au fichier CSS (`../icons/…`).
- `public/assets/js/script.js` : interactions (dropdowns, menu mobile, parallaxe, apparition au scroll)
- Pack ta Small (fan game, logo et typo officiels autorisés) : `src/pages/pts.astro` (page du jeu) ; `public/pts-encyclopedie.html` et `public/pts-builder.html` sont GÉNÉRÉS par `npm run import:pts` depuis `../1_PTS/Encyclopedie` (dépôt privé DarthAppa/pts-outils ; Partie1 sans le chapitre GOAT & Légendes ; Partie3 réduite au Builder Ma collection, qui lit la collection du joueur dans Supabase via `pts-ma-collection.js`) : ne pas les modifier à la main, modifier la source ou `tools/import-pts.mjs` puis relancer
- Comptes et accès (tous dans `public/assets/js/`) : `pts-config.js` (URL Supabase + clé anon, id du serveur PTS), `pts-auth.js` (module d'auth de TOUT le site : connexion Discord, état, garde, inactivité, `monAcces()`, `chargerContenu()`, profil, export/suppression), `entete.js` (« Connexion » → « Mon profil » + anti-clickjacking), `pts-page.js`, `profil.js`, `premium-page.js` (affichage + nettoyage du contenu Premium), `paiement.js`, `pts-connexion.js`. Client Supabase vendu : `public/assets/vendor/supabase.mjs` (`npm run vendor:supabase`, jamais de CDN)
- Serveur : `supabase/` (migrations SQL + RLS, Edge Functions `verifier-guilde`, `creer-paiement`, `portail-abonnement`, `stripe-webhook`, `supprimer-compte`, mode d'emploi `supabase/LISEZMOI.md`). Droits : `abonnements` (écrit par le webhook Stripe), `membres_pts` (écrit par `verifier-guilde`), `contenus` (payants, lisibles seulement si `a_acces()`)
- Tests : `npm run test:pts`, `test:profil`, `test:premium`, `test:outils` (Playwright + faux Supabase `tools/faux-supabase.mjs`, sur `dist/` : lancer `npm run build` avant), `test:fonctions` (logique des Edge Functions), `test:rls` (règles de la base, besoin d'un Postgres : `DATABASE_URL`, tourne en CI). `npm run shot` passe par un serveur local (`tools/serveur.mjs`, sert `dist/`)

## Commandes

- Travailler sur les pages : `npm run dev` (site en direct sur http://localhost:4321 avec rechargement automatique)
- Construire le site : `npm run build` (Tailwind → Astro → CSP sur `dist/`) ; le servir : `npm run serve`
- Vérifier le rendu : `npm run shot` / `node tools/screenshot.mjs page.html` (sur `dist/`, captures dans `shots/`, affiche les erreurs console et le débordement horizontal)
- Tout vérifier : `npm run verif` (voir plus bas)
- Première installation : `npm install` puis `npx playwright install chromium`
- Mise en ligne : automatique à chaque fusion dans `main` (workflow « Mise en ligne », `.github/workflows/pages.yml`). Réglage GitHub : Settings › Pages › Source = « GitHub Actions ».
- Outils installés sur le PC (Windows) : Node 24 / npm 11, Git 2.56, Python 3.12 (`python`, `py -3.12`) + Pillow (`py -3.12 -m pip install ...`), Python 3.13 en plus (`py -3.13`), GitHub CLI `gh` 2.102, `clasp` 3.4 (Google Apps Script : `clasp push`, `clasp pull`), Docker 29 (Docker Desktop doit être lancé).
- Prévu : panels Google Apps Script (clasp), bot Discord Node.js (discord.js), VPS avec Docker. Abonnements Stripe : code prêt (`supabase/`), à configurer (voir `supabase/LISEZMOI.md`).
- IMPORTANT : jamais de token, clé API ou mot de passe dans le code ; tout va dans `.env` (ignoré par git) avec un `.env.example` sans valeurs.

## Règles

- IMPORTANT : un seul `<head>`, celui de `src/layouts/Base.astro` (polices, `assets/css/style.css`, `assets/css/tailwind.css`, `assets/js/script.js` en `defer`, `assets/js/entete.js` en module). La CSP y est ajoutée après le build par `tools/csp.mjs`. Ne jamais dupliquer le contenu de la page.
- Couleurs : uniquement les tokens définis dans `tailwind.config.cjs` et leurs équivalents `--var` dans `public/assets/css/style.css`. Un nouveau token s'ajoute aux deux endroits.
- Pas d'image qui n'existe pas dans le dépôt. Les images vont dans `public/assets/img/` (chemin `assets/img/…` dans les pages). Sans image : visuel en CSS/SVG.
- Pas de logos officiels des jeux (droits) : noms en texte stylisé uniquement.
- IMPORTANT : nom officiel du site « UnDocPourTous » (un seul mot, U, D, P, T majuscules, S final), jamais « UnDocPourTout ». Seule variante tolérée : « Un Doc Pour Tous » en toutes lettres. Dans le code, le nom est défini une seule fois (`SITE.nom` dans `src/site.js`) et réutilisé partout.
- Chaque page : `<title>` au format « Sujet — UnDocPourTous » et `og:site_name="UnDocPourTous"` (fait par `Base.astro` : passer seulement `titre="Sujet"`).
- Cartes = un seul lien sur toute leur surface (`.card-link`), sans bouton dedans ; indice en texte (`.card-hint`) ; cartes « Bientôt » (`.card-soon`) non cliquables.
- Textes du site en français.
- Mobile d'abord : tester à 390px et 1280px, aucune barre de défilement horizontale.
- Le contenu doit rester visible sans JS (les classes `.reveal` ne cachent qu'avec `.js` sur `<html>`).
- Après toute modification visuelle : lancer `npm run shot`, regarder les captures, corriger avant de dire que c'est fini.

## Sécurité (skill `securite`, à lire avant tout code sensible)

- IMPORTANT : le dépôt est PUBLIC. Aucun secret (seule la clé `anon` Supabase est permise côté navigateur) et AUCUN contenu payant dans le dépôt : il va dans la table `contenus` via `npm run publier:contenu` depuis `contenus-prives/` (ignoré) — skill `contenu-premium`.
- Aucun droit décidé par le navigateur : premium = table `abonnements` (webhook Stripe), membre PTS = `membres_pts` (Edge Function). Pas de `innerHTML` avec une donnée externe.
- CSP en `<meta>` sur chaque page, calculée par `tools/csp.mjs` à la fin de `npm run build` (sur `dist/`) : pas de script inline écrit à la main, pas de `onclick=`/`javascript:`, aucun script ou CDN tiers.
- Toute table/policy/fonction SQL : migration dans `supabase/migrations/` + cas dans `tools/test-rls.mjs` (skill `supabase-rls`). Paiements : skill `paiements-stripe`. Audit complet : skill `audit-securite`.

## Git

- Commits courts en français, ex. `feat: carte Lost Ark`, `fix: débordement mobile du hero`.
- Ne pas committer `node_modules/`, `shots/`, `dist/`, `.astro/` ni `public/assets/css/tailwind.css` (tous ignorés).
- Jamais de push direct sur `main` : branche `feat/…`, `fix/…` ou `chore/…` puis pull request (skill `pull-request`, ou `/publier`).

## Vérification du code (obligatoire avant toute PR)

- IMPORTANT : `npm run verif` doit être vert avant de dire qu'une tâche est finie, avant un push et avant une PR (skill `verif-code`). `npm run verif:rapide` = sans captures, pour itérer.
- Contenu : Prettier (sauf `.astro`, mis en forme à la main : le plugin Astro ajoute des espaces visibles), ESLint, Stylelint, construction du site (`npm run build`), html-validate et `tools/regles.mjs` sur `dist/` (règles de ce fichier : titres, `og:site_name`, tokens, cartes, liens/images, secrets, pas de CDN Tailwind), classes Tailwind présentes, CSP à jour, tests (Edge Functions, verrou PTS, profil, Premium ; RLS si `DATABASE_URL`), `npm audit`, captures 390/1280px de chaque page. GitHub ajoute CodeQL et Dependabot.
- Triple verrou : hook git `pre-push` (installé par `npm install`), hook Claude `.claude/hooks/avant-pr.mjs` avant `gh pr create`, GitHub Actions `.github/workflows/verif.yml` sur chaque PR.
- Corriger la cause, jamais la règle : pas de `eslint-disable`, pas de `--no-verify`, pas d'ignore élargi sans accord.
- `npm run format` corrige le formatage ; `npm run lint:fix` une partie du JS/CSS.
- Skills : `verif-code`, `revue-code` (relecture), `corriger-bug`, `securite`, `audit-securite`, `supabase-rls`, `paiements-stripe`, `contenu-premium`, `pull-request`, `publier`, plus `verif-visuelle`, `audit-front`, `front-conventions`.
