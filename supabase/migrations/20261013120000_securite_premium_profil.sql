-- Sécurité, contenus payants et profil — UnDocPourTous
--
-- Règle d'or : un contenu payant n'est JAMAIS dans le dépôt ni dans une page publique.
-- Il vit dans la table contenus et la base (RLS) décide seule qui peut le lire.
--
-- Tables : profils, abonnements, membres_pts, contenus.
-- Fonctions : a_acces(niveau), mon_acces().
-- Écritures sensibles (abonnements, membres_pts, contenus) : service_role uniquement
-- (Edge Functions stripe-webhook / verifier-guilde, outil tools/publier-contenu.mjs).
--
-- Migration rejouable : create ... if not exists, drop ... if exists, create or replace.
-- Les tables de l'extension PTS (pts_accounts, collections, replay_uploads) ne sont pas touchées.
--
-- RLS « forcée » (force row level security) : volontairement NON activée. Elle ne
-- s'applique qu'au propriétaire des tables (postgres), qui n'est utilisé que par les
-- migrations et par les fonctions security definer ci-dessous ; la forcer ferait échouer
-- le trigger de création de profil (inscription bloquée). anon/authenticated restent
-- soumis à la RLS, et service_role la contourne de toute façon (bypassrls).

-- ---------------------------------------------------------------------------
-- 1. Profils
-- ---------------------------------------------------------------------------

create table if not exists public.profils (
    id uuid primary key references auth.users (id) on delete cascade,
    pseudo text check (pseudo is null or char_length(pseudo) between 1 and 40),
    avatar_url text check (avatar_url is null or avatar_url like 'https://cdn.discordapp.com/%'),
    cree_le timestamptz not null default now(),
    maj_le timestamptz not null default now()
);

alter table public.profils enable row level security;

-- Pseudo lisible depuis les métadonnées Discord (null si rien d'exploitable).
create or replace function public.pseudo_depuis_meta(meta jsonb)
returns text
language sql
immutable
set search_path = ''
as $$
    select pg_catalog.left(
        coalesce(
            nullif(pg_catalog.btrim(meta #>> '{custom_claims,global_name}'), ''),
            nullif(pg_catalog.btrim(meta ->> 'full_name'), ''),
            nullif(pg_catalog.btrim(meta ->> 'name'), ''),
            nullif(pg_catalog.btrim(meta ->> 'user_name'), '')
        ),
        40
    )
$$;

-- Avatar gardé seulement s'il vient du CDN Discord (pas d'URL arbitraire affichée sur le site).
create or replace function public.avatar_depuis_meta(meta jsonb)
returns text
language sql
immutable
set search_path = ''
as $$
    select case
        when meta ->> 'avatar_url' ~ '^https://cdn\.discordapp\.com/[A-Za-z0-9/._-]+(\?[A-Za-z0-9=&._-]*)?$'
            and pg_catalog.length(meta ->> 'avatar_url') <= 300
        then meta ->> 'avatar_url'
    end
$$;

-- Trigger d'inscription : crée le profil. Ne doit JAMAIS faire échouer une inscription.
create or replace function public.creer_profil()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
    meta jsonb := new.raw_user_meta_data;
begin
    if meta is null or pg_catalog.jsonb_typeof(meta) <> 'object' then
        meta := '{}'::jsonb;
    end if;
    begin
        insert into public.profils (id, pseudo, avatar_url)
        values (new.id, public.pseudo_depuis_meta(meta), public.avatar_depuis_meta(meta))
        on conflict (id) do nothing;
    exception when others then
        -- Profil minimal plutôt qu'une inscription refusée.
        raise warning 'creer_profil : profil minimal pour % (%)', new.id, sqlstate;
        insert into public.profils (id) values (new.id) on conflict (id) do nothing;
    end;
    return new;
exception when others then
    raise warning 'creer_profil : profil non créé pour % (%)', new.id, sqlstate;
    return new;
end;
$$;

drop trigger if exists profils_creer_a_inscription on auth.users;
create trigger profils_creer_a_inscription
    after insert on auth.users
    for each row execute function public.creer_profil();

-- maj_le tenu à jour par la base (le client ne peut pas l'écrire).
create or replace function public.maj_le_maintenant()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
    new.maj_le := pg_catalog.now();
    return new;
end;
$$;

drop trigger if exists profils_maj_le on public.profils;
create trigger profils_maj_le
    before update on public.profils
    for each row execute function public.maj_le_maintenant();

-- Profils des comptes déjà inscrits (utilisateurs de l'extension PTS).
insert into public.profils (id, pseudo, avatar_url)
select
    u.id,
    public.pseudo_depuis_meta(case when pg_catalog.jsonb_typeof(u.raw_user_meta_data) = 'object' then u.raw_user_meta_data else '{}'::jsonb end),
    public.avatar_depuis_meta(case when pg_catalog.jsonb_typeof(u.raw_user_meta_data) = 'object' then u.raw_user_meta_data else '{}'::jsonb end)
from auth.users u
on conflict (id) do nothing;

drop policy if exists profils_lire_le_sien on public.profils;
create policy profils_lire_le_sien on public.profils
    for select to authenticated
    using (id = (select auth.uid()));

drop policy if exists profils_modifier_le_sien on public.profils;
create policy profils_modifier_le_sien on public.profils
    for update to authenticated
    using (id = (select auth.uid()))
    with check (id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- 2. Abonnements (écrits uniquement par le webhook Stripe, service_role)
-- ---------------------------------------------------------------------------

create table if not exists public.abonnements (
    user_id uuid primary key references auth.users (id) on delete cascade,
    offre text not null default 'premium' check (offre in ('premium')),
    statut text not null check (statut in ('actif', 'essai', 'annule', 'impaye', 'expire')),
    fin timestamptz,
    stripe_customer_id text unique,
    stripe_subscription_id text unique,
    maj_le timestamptz not null default now()
);

alter table public.abonnements enable row level security;

drop policy if exists abonnements_lire_le_sien on public.abonnements;
create policy abonnements_lire_le_sien on public.abonnements
    for select to authenticated
    using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- 3. Membres du serveur Discord PTS (écrits uniquement par verifier-guilde, service_role)
-- ---------------------------------------------------------------------------

create table if not exists public.membres_pts (
    user_id uuid primary key references auth.users (id) on delete cascade,
    discord_id text not null,
    membre boolean not null,
    verifie_le timestamptz not null default now()
);

alter table public.membres_pts enable row level security;

drop policy if exists membres_pts_lire_le_sien on public.membres_pts;
create policy membres_pts_lire_le_sien on public.membres_pts
    for select to authenticated
    using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- 4. Contenus protégés (publiés uniquement avec la clé service_role, jamais dans le dépôt)
-- ---------------------------------------------------------------------------

create table if not exists public.contenus (
    slug text primary key check (slug ~ '^[a-z0-9-]+$' and char_length(slug) <= 100),
    titre text not null,
    niveau text not null check (niveau in ('premium', 'pts')),
    html text not null,
    maj_le timestamptz not null default now()
);

alter table public.contenus enable row level security;

-- ---------------------------------------------------------------------------
-- 5. Fonctions d'accès
-- ---------------------------------------------------------------------------

-- Vrai si l'utilisateur connecté (auth.uid()) a droit au niveau demandé.
create or replace function public.a_acces(niveau text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
    select case niveau
        when 'premium' then exists (
            select 1
            from public.abonnements a
            where a.user_id = auth.uid()
                and a.statut in ('actif', 'essai')
                and (a.fin is null or a.fin > pg_catalog.now())
        )
        when 'pts' then exists (
            select 1
            from public.membres_pts m
            where m.user_id = auth.uid()
                and m.membre
                and m.verifie_le > pg_catalog.now() - interval '30 days'
        )
        else false
    end
$$;

-- État des accès de l'utilisateur connecté (une ligne, toujours ; tout à faux si non connecté).
create or replace function public.mon_acces()
returns table (
    premium boolean,
    premium_statut text,
    premium_fin timestamptz,
    pts boolean,
    pts_verifie_le timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
    select
        coalesce(a.statut in ('actif', 'essai') and (a.fin is null or a.fin > pg_catalog.now()), false),
        a.statut,
        a.fin,
        coalesce(m.membre and m.verifie_le > pg_catalog.now() - interval '30 days', false),
        m.verifie_le
    from (select auth.uid() as uid) moi
    left join public.abonnements a on a.user_id = moi.uid
    left join public.membres_pts m on m.user_id = moi.uid
$$;

drop policy if exists contenus_lire_si_acces on public.contenus;
create policy contenus_lire_si_acces on public.contenus
    for select to authenticated
    using (public.a_acces(niveau));

-- ---------------------------------------------------------------------------
-- 6. Droits : rien pour anon/public, le strict minimum pour authenticated
-- ---------------------------------------------------------------------------

revoke all on table public.profils, public.abonnements, public.membres_pts, public.contenus
    from anon, authenticated, public;

grant select on table public.profils, public.abonnements, public.membres_pts, public.contenus to authenticated;
grant update (pseudo) on table public.profils to authenticated;

grant select, insert, update, delete on table public.profils, public.abonnements, public.membres_pts, public.contenus
    to service_role;

revoke all on function public.pseudo_depuis_meta(jsonb) from anon, authenticated, public;
revoke all on function public.avatar_depuis_meta(jsonb) from anon, authenticated, public;
revoke all on function public.creer_profil() from anon, authenticated, public;
revoke all on function public.maj_le_maintenant() from anon, authenticated, public;
revoke all on function public.a_acces(text) from anon, authenticated, public;
revoke all on function public.mon_acces() from anon, authenticated, public;

grant execute on function public.a_acces(text) to authenticated;
grant execute on function public.mon_acces() to authenticated;
grant execute on function public.a_acces(text), public.mon_acces() to service_role;
