---
name: audit-securite
description: Audit de sécurité complet et adversarial du site UnDocPourTous (front, Supabase/RLS, Edge Functions, Stripe, CSP, dépendances, GitHub). À utiliser avant une mise en ligne qui touche aux comptes ou aux paiements, sur demande « audit sécurité », ou une fois par mois.
---

# Audit de sécurité

Faire l'audit dans des sous-agents (un par zone) et ne rapporter que des failles DÉMONTRÉES (commande + sortie, ou raisonnement précis sur le code). Penser comme un attaquant : « que puis-je lire, écrire, payer moins cher, ou faire faire à quelqu'un d'autre ? ».

## 1. Outils automatiques

- `npm run verif:rapide` (règles maison = secrets, CSP, tests) ; `npm audit` (alertes « high » des outils de build : vérifier qu'elles ne touchent pas le site publié).
- GitHub : onglet Security (CodeQL, Dependabot, secret scanning) : `gh api repos/DarthAppa/UnDocPourTous/code-scanning/alerts --jq '.[].rule.description'`, `gh api repos/DarthAppa/UnDocPourTous/dependabot/alerts --jq '.[] | .security_advisory.summary'`.

## 2. Zones et attaques à tenter

| Zone             | Attaques                                                                                                                                                                                                                                                                                                                                                               |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Base (RLS)       | lire la ligne d'un autre (profils, abonnements, membres_pts, contenus) ; s'insérer un abonnement ; se mettre membre ; modifier avatar_url ou id ; appeler une fonction interne ; anon qui lit quoi que ce soit ; abonnement expiré/annulé qui donne encore accès. Monter un Postgres jetable (voir `supabase-rls`) et écrire les attaques en SQL.                      |
| Edge Functions   | JWT absent/expiré/d'un autre ; corps qui désigne un autre utilisateur ; jeton Discord d'un autre (verifier-guilde doit répondre 403) ; webhook sans signature / corps modifié ; prix ou URL de retour choisis par le client ; double paiement ; suppression du compte d'un autre ; Origin non autorisée ; messages d'erreur trop bavards ; absence de limite d'appels. |
| Front            | XSS : pseudo `<img src=x onerror=alert(1)>`, contenu Premium piégé (svg, xlink:href, `java\tscript:`, style, form, srcset) ; open redirect `?retour=https://evil` ; provider_token resté en localStorage ; page dans une iframe ; CSP contournable (script tiers ajouté, `unsafe-inline`).                                                                             |
| Contenus payants | présents dans le dépôt, l'historique (`git log -p -S "<extrait>"`), une capture, un test, un cache ? `contenus-prives/` bien ignoré ?                                                                                                                                                                                                                                  |
| Dépôt / CI       | secrets dans l'historique (`git log -p                                                                                                                                                                                                                                                                                                                                 | grep -E "sk_live | service_role | whsec_"`), workflows avec `pull_request_target`, permissions larges, `${{ github.event.* }}`dans un`run:`, actions non épinglées. |
| Comptes          | MFA activée sur GitHub, Supabase, Stripe, Discord, registrar du domaine ; clés API à droits minimaux ; qui a accès ?                                                                                                                                                                                                                                                   |

## 3. Rapport

Tableau : gravité (critique / haute / moyenne / basse), fichier:ligne, attaque concrète, preuve, correctif exact. Puis patchs. Après accord : corriger par commits `fix(sécurité): …`, ajouter un test qui aurait détecté chaque faille (RLS → `tools/test-rls.mjs`, fonctions → `tools/test-fonctions.mjs`, front → tests Playwright), `npm run verif` vert.
