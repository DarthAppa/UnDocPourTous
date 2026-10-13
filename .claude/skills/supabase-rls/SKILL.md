---
name: supabase-rls
description: Écrire et tester une migration Supabase (tables, règles RLS, fonctions security definer, grants) pour UnDocPourTous. À utiliser dès qu'on crée ou modifie une table, une policy, une fonction SQL ou un droit dans supabase/.
---

# Migrations et règles RLS

## Écrire

1. Nouvelle migration `supabase/migrations/AAAAMMJJHHMMSS_sujet.sql` (ne jamais modifier une migration déjà appliquée en production). Rejouable : `create table if not exists`, `drop policy if exists` + `create policy`, `create or replace function`.
2. Pour chaque table :
    ```sql
    alter table public.x enable row level security;
    revoke all on public.x from anon, authenticated, public;
    grant select on public.x to authenticated;              -- le strict nécessaire
    create policy "lire les miennes" on public.x for select to authenticated using (user_id = (select auth.uid()));
    ```
    Écriture par l'utilisateur seulement si indispensable, colonne par colonne (`grant update (pseudo) on public.profils to authenticated;`) avec `with check`.
3. Fonctions : `security definer` seulement si nécessaire, toujours `set search_path = ''`, noms qualifiés, `revoke execute on function ... from public, anon;` puis `grant execute ... to authenticated`.
4. Droits payants / membres : JAMAIS écrits par `authenticated`. Seul `service_role` (Edge Functions) écrit `abonnements`, `membres_pts`, `contenus`.
5. Attention : `PTS_Companion/supabase/schema.sql` (autre dépôt) fait `revoke all on all tables/functions in schema public from anon, authenticated`. S'il est rejoué, relancer ensuite les migrations de ce dépôt (`npx supabase db push` ne rejoue pas : réappliquer le fichier dans le SQL Editor).

## Tester (obligatoire)

- Ajouter les cas dans `tools/test-rls.mjs` : ce qui DOIT marcher et surtout ce qui doit ÉCHOUER (autre utilisateur, anon, écriture interdite, expiration).
- En local (Linux/WSL ou Docker) : `docker run -d --name pg -e POSTGRES_PASSWORD=postgres -p 5432:5432 postgres:16` puis `DATABASE_URL=postgres://postgres:postgres@localhost:5432/postgres npm run test:rls`. Sinon la CI GitHub le lance sur chaque PR (service postgres:16).
- Le mini-Supabase de test est `supabase/tests/stub-supabase.sql` (rôles, `auth.users`, `auth.uid()`).

## Déployer

`npx supabase login` → `npx supabase link --project-ref wibfiqtuqfddijjlfscs` → `npx supabase db push`. Vérifier ensuite dans le tableau de bord : Database › Policies, et Advisors › Security (aucune alerte).
