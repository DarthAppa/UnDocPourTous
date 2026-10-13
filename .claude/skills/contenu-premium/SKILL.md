---
name: contenu-premium
description: Publier ou modifier un contenu payant (Premium) ou réservé (PTS) d'UnDocPourTous sans jamais le mettre dans le dépôt public. À utiliser quand l'utilisateur veut ajouter un guide, un outil ou une page réservée aux abonnés.
---

# Publier un contenu réservé

Le dépôt est PUBLIC : un contenu payant écrit dans une page HTML serait lisible par tout le monde (et resterait dans l'historique git pour toujours). Il vit dans la table Supabase `contenus`, lisible seulement si `a_acces(niveau)` est vrai.

1. Écrire le contenu (HTML simple : titres, paragraphes, listes, tableaux, images de `assets/img/`) dans `contenus-prives/<slug>.html` (dossier ignoré par git ; vérifier avec `git check-ignore contenus-prives/<slug>.html`). Pas de `<script>`, `<style>`, `<form>`, `style=` : ils sont retirés à l'affichage.
2. Publier : `npm run publier:contenu -- <slug> contenus-prives/<slug>.html "<Titre>" premium` (ou `pts`). Il faut `SUPABASE_SERVICE_ROLE_KEY` dans `.env`. Le slug : minuscules, chiffres, tirets.
3. Page publique (le gabarit, sans contenu) : copier `albion-builder-tryhard.html` (zone `#premium-zone` avec `data-slug="<slug>"`, lue par `premium-page.js`), titre « Sujet — UnDocPourTous », carte d'accès depuis la page du jeu (`.card-link`).
4. Tester : non connecté → carte « Réservé aux abonnés » ; connecté sans abonnement → lien vers le paiement ; abonné → contenu. `npm run verif`.
5. Outil interactif (JS) réservé : le code d'interface peut être public, mais les DONNÉES ou calculs à valeur doivent venir d'une Edge Function ou d'une table protégée, jamais d'un fichier du dépôt.
