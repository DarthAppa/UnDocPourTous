---
name: paiements-stripe
description: Règles et étapes pour tout ce qui touche aux paiements Stripe d'UnDocPourTous (abonnement Premium, Checkout, portail client, webhook, résiliation). À utiliser avant de modifier creer-paiement, portail-abonnement, stripe-webhook, supprimer-compte, la page de paiement ou les offres.
---

# Paiements Stripe

## Flux

1. `albion-paiement.html` → `paiement.js` → Edge Function `creer-paiement` (JWT) → URL Checkout (préfixe `https://checkout.stripe.com/` vérifié avant redirection).
2. Stripe → webhook `stripe-webhook` (signature `STRIPE_WEBHOOK_SECRET`) → table `abonnements` (service_role) → accès via `a_acces('premium')` / `mon_acces()`.
3. `profil.html` → `portail-abonnement` (gérer, résilier, carte) ; `supprimer-compte` résilie tous les abonnements puis supprime le compte.

## Règles

- Le client n'envoie JAMAIS de prix, de montant, d'URL de retour ni d'identifiant utilisateur : tout vient du JWT et des secrets (`STRIPE_PRICE_PREMIUM`, `SITE_URL`).
- Webhook : corps brut (`req.text()`), `constructEventAsync`, relire l'objet chez Stripe plutôt que croire l'événement, upsert idempotent, 200 pour les événements inconnus, 500 pour qu'il réessaie en cas d'erreur base. Seul le prix Premium donne l'offre premium.
- Statuts : active→actif, trialing→essai, past_due/unpaid/incomplete→impaye, canceled→annule, le reste→expire (pas d'accès dans le doute).
- Une nouvelle offre = nouveau prix Stripe + secret + valeur autorisée dans le `check` de `abonnements.offre` (migration) + `a_acces` + tests.
- Mode test d'abord (`sk_test_`, cartes 4242…), puis bascule en live avec de NOUVEAUX secrets.
- Légal (France) : CGV, mentions légales, rétractation pour contenu numérique (case de renonciation), facture « TVA non applicable, art. 293 B du CGI ». Voir la note projet `contexte-monetisation-anyfight.md`.

## Tester

`npm run test:fonctions` (logique pure : statuts, prix, double abonnement) ; `npm run test:premium` (bouton de paiement) ; en vrai : `stripe listen --forward-to https://wibfiqtuqfddijjlfscs.supabase.co/functions/v1/stripe-webhook` et `stripe trigger checkout.session.completed` en mode test.
