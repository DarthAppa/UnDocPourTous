---
name: securite
description: Vérifie la sécurité du site et des futurs services (Supabase, connexion Discord, Stripe, bot Discord, VPS Docker) — secrets, données utilisateurs, injections, dépendances. À utiliser avant de publier une fonctionnalité qui touche aux comptes, aux paiements ou à des données.
---

# Sécurité

1. **Secrets** : `npm run regles` (détecte clés Stripe, tokens GitHub/Discord/Google, `service_role`, clés privées). Tout secret va dans `.env` (ignoré) + nom de variable vide dans `.env.example`. Un secret déjà commité est compromis : le révoquer, pas seulement le supprimer.
2. **Dépendances** : `npm audit --omit=dev` ; mettre à jour ce qui est « high »/« critical ». Versions fixées pour les scripts CDN (jamais `@latest`).
3. **Supabase** : côté navigateur uniquement l'URL + clé `anon`. Chaque table a la RLS activée et des policies explicites ; tester qu'un visiteur non connecté ne lit rien de réservé.
4. **Connexion Discord / PTS** : l'appartenance au serveur se vérifie côté serveur (Edge Function / bot), pas seulement dans le navigateur. Redirections OAuth limitées au domaine du site.
5. **Injections** : pas d'`innerHTML` avec une donnée externe ; pas d'`eval`/`new Function`.
6. **Stripe (prévu)** : montant et produit décidés côté serveur ; webhooks vérifiés avec la signature (`whsec_…` dans `.env`).
7. **Docker/VPS (prévu)** : pas de secret dans l'image ni dans le `Dockerfile` ; `env_file`, utilisateur non-root, ports minimum.

Rapport : gravité, fichier:ligne, risque concret (« un visiteur pourrait… »), correction.
