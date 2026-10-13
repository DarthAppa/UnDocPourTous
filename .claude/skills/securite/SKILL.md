---
name: securite
description: Règles de sécurité à appliquer à CHAQUE modification qui touche aux comptes, aux paiements, à Supabase, aux Edge Functions, aux contenus Premium ou au JavaScript du navigateur. À lire avant d'écrire ce code ; pour un audit complet, utiliser audit-securite.
---

# Sécurité — règles permanentes

Architecture : site statique PUBLIC (GitHub Pages, tout le dépôt est lisible par tous) + Supabase (Auth Discord, base protégée par RLS, Edge Functions) + Stripe. Le navigateur ne décide JAMAIS d'un droit : la base et les Edge Functions décident.

## Interdits absolus

1. Aucun secret dans le dépôt : clé `service_role`, clés Stripe (`sk_`, `rk_`, `whsec_`), token de bot Discord, mot de passe. Côté navigateur, seules l'URL Supabase et la clé `anon` sont permises (`pts-config.js`). Secrets des fonctions : `npx supabase secrets set`. Local : `.env` (ignoré). `npm run regles` détecte les fuites. Un secret commité est compromis : le RÉVOQUER (pas seulement l'effacer).
2. Aucun contenu payant dans le dépôt, une page HTML, un test, une capture ou un commit : il vit dans la table `contenus` (skill `contenu-premium`).
3. Aucun droit accordé côté navigateur : pas de « premium = true » en localStorage, pas de vérification Discord depuis le navigateur. Source de vérité : `abonnements` (webhook Stripe), `membres_pts` (fonction `verifier-guilde`), lues via RLS ou `mon_acces()`.
4. Pas de `innerHTML` / `insertAdjacentHTML` avec une donnée venant de Supabase, de l'URL ou de Discord → `textContent`. Exception : contenu Premium, TOUJOURS passé par `nettoyer()` de `premium-page.js`.
5. Pas de script inline, `onclick=`, `javascript:`, `eval`, `new Function`, ni de script/CDN tiers : la CSP (`npm run csp`) les bloque. Supabase est vendu dans `assets/vendor/supabase.mjs` (`npm run vendor:supabase`), Tailwind est compilé (`npm run build:css`).
6. Redirections : uniquement vers une page du site (`/^[a-z0-9-]+\.html$/`) ou un préfixe Stripe vérifié (`https://checkout.stripe.com/`, `https://billing.stripe.com/`).
7. Jamais `--no-verify`, jamais désactiver une règle de sécurité pour « faire passer » la vérif.

## Base Supabase

- Toute table : RLS activée + `revoke all ... from anon, authenticated, public` + grants minimaux + policies explicites. Écritures sensibles : `service_role` seulement (Edge Functions).
- Fonctions `security definer` : `set search_path = ''` et noms qualifiés (`public.table`). `revoke execute ... from public, anon`.
- Toute modification : nouvelle migration dans `supabase/migrations/` + cas dans `tools/test-rls.mjs` (skill `supabase-rls`).

## Edge Functions

- JWT vérifié (`utilisateurDuJwt`), l'identité vient UNIQUEMENT du JWT, jamais du corps.
- Montants / prix / URLs de retour décidés côté serveur. CORS limité à `SITE_ORIGINS`. Erreurs génériques (pas de détails internes), aucun log de jeton.
- Webhook Stripe : signature vérifiée sur le corps brut (skill `paiements-stripe`).

## Données personnelles (RGPD)

- Collecter le minimum (pseudo, avatar Discord, e-mail fourni par Discord). Chacun peut exporter et supprimer ses données depuis `profil.html` ; la suppression résilie Stripe puis supprime le compte (cascade).
- Toute nouvelle donnée personnelle : l'ajouter à l'export (`exporterMesDonnees`) et vérifier qu'elle part avec la suppression (`on delete cascade`).

## Vérifier

`npm run verif` (inclut règles maison, CSP, tests Edge Functions, profil, Premium, verrou PTS, audit npm ; RLS en CI). Avant une fonctionnalité sensible : skill `audit-securite`.
