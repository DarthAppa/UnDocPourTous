-- Mini « Supabase » pour tester la migration sur un Postgres 16 nu (local ou CI).
-- Reproduit seulement ce dont la migration a besoin : rôles, schéma auth, auth.uid(),
-- et surtout les droits par défaut de Supabase (tout est accordé à anon/authenticated
-- dans le schéma public), pour prouver que la migration les retire bien.
-- NE PAS appliquer sur le vrai projet Supabase.

do $$
begin
    if not exists (select 1 from pg_roles where rolname = 'anon') then
        create role anon nologin noinherit;
    end if;
    if not exists (select 1 from pg_roles where rolname = 'authenticated') then
        create role authenticated nologin noinherit;
    end if;
    if not exists (select 1 from pg_roles where rolname = 'service_role') then
        create role service_role nologin noinherit bypassrls;
    end if;
end
$$;

create schema if not exists auth;
grant usage on schema auth to anon, authenticated, service_role;

create table if not exists auth.users (
    id uuid primary key,
    email text,
    raw_user_meta_data jsonb
);

-- Comme Supabase : lit le « sub » du JWT posé par PostgREST dans la transaction.
create or replace function auth.uid() returns uuid
language sql stable
as $$
    select coalesce(
        nullif(current_setting('request.jwt.claim.sub', true), ''),
        (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
    )::uuid
$$;
grant execute on function auth.uid() to anon, authenticated, service_role;

-- Comme Supabase : toutes les revendications du JWT (dont « aal », niveau d'authentification).
create or replace function auth.jwt() returns jsonb
language sql stable
as $$
    select coalesce(
        nullif(current_setting('request.jwt.claims', true), '')::jsonb,
        pg_catalog.jsonb_build_object('sub', nullif(current_setting('request.jwt.claim.sub', true), ''))
    )
$$;
grant execute on function auth.jwt() to anon, authenticated, service_role;

-- Identités reliées à un compte (Google, e-mail, Discord…) : une identité = un seul compte.
create table if not exists auth.identities (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users (id) on delete cascade,
    provider text not null,
    provider_id text not null,
    identity_data jsonb,
    unique (provider_id, provider)
);

-- Facteurs de double authentification (TOTP…)
create table if not exists auth.mfa_factors (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users (id) on delete cascade,
    factor_type text not null default 'totp',
    status text not null check (status in ('verified', 'unverified'))
);

-- Droits par défaut de Supabase sur le schéma public (très larges : c'est la RLS et les
-- revoke de la migration qui doivent protéger les données).
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
