# Supabase — mise en route (contenus payants, membres PTS, profil)

Ce dossier contient la partie « serveur » du site :

- `migrations/20261013120000_securite_premium_profil.sql` : les tables `profils`, `abonnements`, `membres_pts`, `contenus` et leurs règles de sécurité (RLS). C'est la base qui décide qui lit quoi, jamais le navigateur.
- `functions/` : les Edge Functions (petits programmes qui tournent chez Supabase) :
    - `verifier-guilde` : vérifie qu'un compte Discord est bien membre du serveur PTS ;
    - `creer-paiement` : ouvre la page de paiement Stripe (abonnement premium) ;
    - `portail-abonnement` : ouvre le portail Stripe (changer de carte, résilier) ;
    - `stripe-webhook` : reçoit les messages de Stripe et met à jour les abonnements ;
    - `supprimer-compte` : résilie l'abonnement puis supprime le compte.
- `functions/_shared/` : le code commun (la logique `.js` est testée par `node tools/test-fonctions.mjs`).
- `tests/stub-supabase.sql` : un « faux Supabase » minimal pour tester les règles sur un Postgres local (ne jamais l'appliquer au vrai projet).

> Règle d'or : un contenu payant ne va **jamais** dans le dépôt (il est public) ni dans une page HTML du site. Il va dans la table `contenus`, avec l'outil `tools/publier-contenu.mjs`.

Toutes les commandes se tapent dans un terminal ouvert à la racine du dépôt (dans VS Code : Terminal › Nouveau terminal).

## 1. Se connecter à Supabase (une seule fois)

```bash
npx supabase login
```

Le navigateur s'ouvre : accepter. Puis relier le dépôt au projet en ligne :

```bash
npx supabase link --project-ref wibfiqtuqfddijjlfscs
```

Il demande le mot de passe de la base (Supabase › Project Settings › Database ; « Reset database password » si tu ne l'as plus).

## 2. Envoyer la base (tables + règles)

```bash
npx supabase db push
```

Il affiche la migration qui va être appliquée : répondre `Y`. La migration peut être rejouée sans danger.

Si la commande refuse parce que l'historique en ligne contient des migrations inconnues (tables de l'extension PTS créées à la main), ne force rien : ouvre Supabase › SQL Editor, colle tout le contenu du fichier de migration, clique « Run », puis marque-la comme appliquée :

```bash
npx supabase migration repair --status applied 20261013120000
```

Vérifier ensuite dans Supabase › Table Editor que les 4 tables portent le badge « RLS enabled ».

## 3. Les secrets des fonctions

Les secrets ne vont **jamais** dans le dépôt. On les donne à Supabase, une fois (remplacer `...` par la vraie valeur) :

```bash
npx supabase secrets set SITE_URL=https://undocpourtous.com
npx supabase secrets set SITE_ORIGINS=https://undocpourtous.com
npx supabase secrets set GUILD_ID=1329053478743572480
npx supabase secrets set STRIPE_SECRET_KEY=...
npx supabase secrets set STRIPE_PRICE_PREMIUM=...
npx supabase secrets set STRIPE_WEBHOOK_SECRET=...
```

| Nom                     | Rôle                                                                                                                                                        |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SITE_URL`              | adresse du site, pour les retours après paiement (`profil.html`, `albion-paiement.html`)                                                                    |
| `SITE_ORIGINS`          | sites autorisés à appeler les fonctions (séparés par des virgules, sans `/` final) ; ajouter `,http://127.0.0.1:5500` seulement le temps d'un test en local |
| `GUILD_ID`              | id du serveur Discord PTS ; `*` = n’importe quel compte Discord (vide = vérification refusée, par sécurité)                                                 |
| `STRIPE_SECRET_KEY`     | clé secrète Stripe (`sk_test_…` pour les essais, `sk_live_…` en vrai)                                                                                       |
| `STRIPE_PRICE_PREMIUM`  | id du prix de l'abonnement (`price_…`), voir étape 5                                                                                                        |
| `STRIPE_WEBHOOK_SECRET` | secret de signature du webhook (`whsec_…`), voir étape 5                                                                                                    |

`SUPABASE_URL` et `SUPABASE_SERVICE_ROLE_KEY` sont fournis automatiquement par Supabase aux fonctions : ne pas les définir.

Voir la liste (les valeurs restent cachées) : `npx supabase secrets list`.

## 4. Déployer les fonctions

```bash
npx supabase functions deploy verifier-guilde
npx supabase functions deploy creer-paiement
npx supabase functions deploy portail-abonnement
npx supabase functions deploy stripe-webhook
npx supabase functions deploy supprimer-compte
```

(`npx supabase functions deploy` sans nom les déploie toutes.) Le fichier `config.toml` règle `verify_jwt` : les fonctions exigent un utilisateur connecté, sauf `stripe-webhook` (Stripe n'est pas un utilisateur : c'est la signature Stripe qui est vérifiée).

Après une modification d'une fonction : relancer `node tools/test-fonctions.mjs`, puis redéployer la fonction.

## 5. Régler Stripe

D'abord en **mode test** (interrupteur « Test mode » dans Stripe), puis refaire la même chose en mode réel le jour du lancement.

1. **Produit et prix** : Stripe › Catalogue de produits › « Ajouter un produit » : nom « UnDocPourTous Premium », prix **récurrent** (mensuel). Copier l'id du prix (`price_…`) → secret `STRIPE_PRICE_PREMIUM`.
2. **Clé secrète** : Stripe › Développeurs › Clés API › « Clé secrète » → secret `STRIPE_SECRET_KEY`.
3. **Webhook** : Stripe › Développeurs › Webhooks › « Ajouter une destination » :
    - URL : `https://wibfiqtuqfddijjlfscs.supabase.co/functions/v1/stripe-webhook`
    - événements : `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`
    - copier le « secret de signature » (`whsec_…`) → secret `STRIPE_WEBHOOK_SECRET`.
4. **Portail client** : Stripe › Paramètres › Facturation › Portail client : l'activer (autoriser la résiliation et le changement de carte), sinon `portail-abonnement` échoue.
5. Redéployer n'est pas nécessaire après `secrets set` : les fonctions lisent les secrets à chaque appel.

Tester : sur le site, payer avec la carte de test `4242 4242 4242 4242` (date future, n'importe quel code). Dans Stripe › Webhooks, l'événement doit être en « 200 ». Dans Supabase › Table Editor › `abonnements`, une ligne `actif` apparaît.

## 6. Donner (ou retirer) un accès premium à la main

Supabase › SQL Editor (tu es administrateur, la RLS ne te bloque pas). Trouver l'id de la personne dans Authentication › Users (ou par son e-mail), puis :

```sql
-- Donner 30 jours de premium (remplacer l'e-mail)
insert into public.abonnements (user_id, offre, statut, fin)
select id, 'premium', 'actif', now() + interval '30 days'
from auth.users
where email = 'personne@exemple.com'
on conflict (user_id) do update set statut = excluded.statut, fin = excluded.fin, maj_le = now();

-- Premium sans date de fin : mettre fin = null.
-- Retirer l'accès :
update public.abonnements set statut = 'expire', maj_le = now()
where user_id = (select id from auth.users where email = 'personne@exemple.com');
```

Un accès donné à la main n'a pas d'abonnement Stripe : Stripe ne le modifiera jamais, pense à le retirer toi-même.

## 7. Publier un contenu premium ou PTS

Les contenus protégés vivent **uniquement** dans la table `contenus`. On les écrit dans un dossier privé `contenus-prives/` (ignoré par git, jamais publié) puis on les envoie avec la clé `service_role` :

1. Dans `.env` (copie de `.env.example`, ignoré par git), remplir `SUPABASE_SERVICE_ROLE_KEY` (Supabase › Project Settings › API › `service_role`, **secrète** : jamais dans le dépôt, jamais dans le navigateur).
2. Écrire le contenu en HTML, ex. `contenus-prives/guide-albion-tryhard.html`.
3. Publier :

```bash
node tools/publier-contenu.mjs guide-albion-tryhard contenus-prives/guide-albion-tryhard.html "Guide tryhard Albion" premium
```

- slug : minuscules, chiffres et tirets seulement (c'est l'identifiant lu par la page) ;
- niveau : `premium` (abonnés) ou `pts` (membres du serveur Discord PTS vérifiés depuis moins de 30 jours) ;
- relancer la même commande met le contenu à jour.

L'outil refuse un fichier hors de `contenus-prives/`, un fichier suivi par git, ou un dossier non ignoré par git. Le HTML est affiché tel quel aux abonnés : n'y mets que du contenu que tu as écrit toi-même.

Supprimer un contenu : SQL Editor → `delete from public.contenus where slug = 'guide-albion-tryhard';`

## 8. Tester les règles de sécurité en local

Les règles RLS se testent sur un vrai Postgres 16 jetable (Docker Desktop lancé) :

```bash
docker run --rm -d --name pg-test -p 54329:5432 -e POSTGRES_PASSWORD=postgres postgres:16
```

Puis (PowerShell) :

```powershell
$env:DATABASE_URL="postgres://postgres:postgres@localhost:54329/postgres"; node tools/test-rls.mjs
```

Le test crée une base neuve, applique la migration deux fois, vérifie chaque règle (✓/✗) et supprime la base. Arrêter Postgres ensuite : `docker stop pg-test`.

La logique des fonctions (CORS, statuts Stripe, vérification Discord…) se teste sans rien installer : `node tools/test-fonctions.mjs`.

## 9. Comptes du site : Google, e-mail, anti-robot, e-mails

On se connecte au site avec **Google** ou **e-mail + mot de passe** (page `connexion.html`).
Discord n'est **pas** un moyen de connexion : on le **relie** à son compte (page `connexion-pts.html`
ou profil) pour débloquer les outils Pack ta Small.

Réglages déjà faits (Authentication) : liaison manuelle d'identités activée (« Manual linking »),
mot de passe de 10 caractères minimum avec lettres et chiffres, redirections autorisées vers
`connexion.html`, `connexion-pts.html` et `profil.html`.

**Google** (Authentication › Sign In / Providers › Google) :

1. Google Cloud Console › API et services › Écran de consentement OAuth : type « Externe », nom
   « UnDocPourTous », e-mail d'assistance, domaine `undocpourtous.com`.
2. Identifiants › Créer des identifiants › ID client OAuth › « Application Web » :
    - Origines JavaScript autorisées : `https://undocpourtous.com`
    - URI de redirection autorisés : `https://wibfiqtuqfddijjlfscs.supabase.co/auth/v1/callback`
3. Copier l'ID client et le code secret dans Supabase › Providers › Google, activer, enregistrer.
   Le bouton « Continuer avec Google » apparaît alors tout seul sur le site.

**E-mails** : le serveur d'e-mails intégré à Supabase n'envoie qu'aux membres de l'équipe du projet,
et très peu par heure. Pour de vraies inscriptions, brancher un SMTP (ex. Resend, gratuit jusqu'à
3 000 e-mails/mois) dans Authentication › Emails › SMTP Settings, avec une adresse du domaine
(`no-reply@undocpourtous.com`).

**Anti-robot Cloudflare Turnstile** (gratuit) :

1. Cloudflare › Turnstile › Ajouter un widget : domaine `undocpourtous.com`, mode « Managed ».
2. Clé **publique** (Site Key) → `TURNSTILE_SITE_KEY` dans `pts-config.js` (elle est faite pour être visible).
3. Clé **secrète** → Supabase › Authentication › Attack Protection › CAPTCHA (fournisseur Turnstile).
   Activer les deux en même temps : sinon les inscriptions sont refusées.

**Double authentification** : chacun l'active depuis son profil (application type Google
Authenticator). La base l'exige ensuite pour lire ses données et les contenus réservés (migration
`20261014090000_comptes_site.sql`).

## Ce que garantit la base (résumé)

- Un visiteur non connecté (`anon`) ne lit rien dans ces 4 tables et ne peut appeler aucune fonction.
- Un utilisateur connecté lit seulement **sa** ligne de `profils`, `abonnements` et `membres_pts`, et ne peut modifier que **son pseudo**.
- Personne ne peut s'écrire un abonnement, se déclarer membre PTS ou publier un contenu depuis le navigateur : seules les fonctions (clé `service_role`) le peuvent.
- Un contenu `premium` n'est lisible qu'avec un abonnement `actif`/`essai` non expiré ; un contenu `pts` qu'avec une vérification Discord de moins de 30 jours, et seulement si ce Discord est **toujours relié** au compte.
- Un compte qui a activé la double authentification doit avoir saisi son code (session `aal2`) pour lire ses données et les contenus réservés.
- Supprimer un compte supprime aussi son profil, son abonnement et sa vérification PTS.
