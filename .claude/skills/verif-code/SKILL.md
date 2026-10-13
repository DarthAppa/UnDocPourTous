---
name: verif-code
description: Vérifie tout le code avant commit, push ou pull request (Prettier, ESLint, Stylelint, html-validate, règles maison, tests PTS, captures 390/1280px) et corrige ce qui échoue. À utiliser après chaque modification de code et avant de dire qu'une tâche est finie.
---

# Vérifier le code

Une seule commande fait tout : `npm run verif` (ou `npm run verif:rapide` sans les captures, pour itérer vite).
Elle est aussi lancée automatiquement par le hook git `pre-push`, par le hook Claude avant `gh pr create`, et par GitHub Actions sur chaque PR. Si elle est rouge, rien ne part.

## Étapes et comment corriger

| Étape         | Outil                                | Correction                                                                                                                                                                                       |
| ------------- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Formatage     | Prettier (`.prettierrc.json`)        | `npm run format` puis relire le diff                                                                                                                                                             |
| JavaScript    | ESLint (`eslint.config.js`)          | `npm run lint:fix`, puis corriger à la main : variable inconnue, inutilisée, `==`                                                                                                                |
| CSS           | Stylelint (`.stylelintrc.json`)      | `npx stylelint "**/*.css" --fix`, puis à la main (propriété ou valeur invalide, doublon)                                                                                                         |
| HTML          | html-validate (`.htmlvalidate.json`) | balise mal fermée, `id` en double, `<button>` sans `type`, attribut invalide                                                                                                                     |
| Règles maison | `tools/regles.mjs`                   | voir CLAUDE.md : titre « Sujet — UnDocPourTous », `og:site_name`, un seul `<head>`/`<h1>`, `lang="fr"`, couleurs = tokens, cartes `.card-link` sans bouton, liens/images existants, aucun secret |
| Tests PTS     | `npm run test:pts`                   | lire le test qui échoue avant de toucher au code                                                                                                                                                 |
| Rendu         | `tools/screenshot.mjs`               | voir la skill `verif-visuelle` (débordement, erreurs console, ressource introuvable)                                                                                                             |

## Règles

1. Corriger la cause, jamais la règle : ne pas désactiver une règle ESLint/Stylelint/html-validate, ne pas ajouter de `// eslint-disable`, ne pas élargir un ignore, sauf si l'utilisateur le demande explicitement (et l'expliquer).
2. Ne jamais toucher à `pts-encyclopedie.html` / `pts-builder.html` : corriger `tools/import-pts.mjs` ou la source, puis `npm run import:pts`.
3. Ne jamais contourner : pas de `--no-verify`, pas de `SKIP_SIMPLE_GIT_HOOKS`.
4. Relancer `npm run verif` jusqu'à « Tout est vert », puis regarder vraiment les captures de `shots/`.
5. Dans le compte rendu : le bilan de la commande (✓/✗ par étape) et ce qui a été corrigé.
