-- Comptes du site (Google, e-mail + mot de passe) et Discord relié au compte - UnDocPourTous
--
-- Avant : on se connectait au site avec Discord, et l'appartenance au serveur PTS suivait.
-- Maintenant : on a un compte du site (Google ou e-mail) et on y RELIE son Discord pour les
-- outils PTS. Deux règles en découlent :
--
-- 1. Une vérification PTS ne compte que si le compte Discord vérifié est TOUJOURS relié au
--    compte (auth.identities). Délier son Discord retire l'accès PTS tout de suite, et un même
--    Discord ne peut pas débloquer deux comptes (Supabase interdit de relier une identité à deux
--    comptes).
-- 2. Double authentification (MFA) : un compte qui l'a activée doit l'avoir validée dans sa
--    session (aal2) pour lire ses données et les contenus réservés. Sans MFA activée, rien ne
--    change (aal1 suffit).
--
-- Migration rejouable (create or replace, drop ... if exists).

-- ---------------------------------------------------------------------------
-- 1. MFA : la session a-t-elle le niveau exigé par le compte ?
-- ---------------------------------------------------------------------------

-- Vrai si le compte connecté n'a pas de facteur MFA vérifié, ou si sa session est en aal2.
create or replace function public.mfa_ok()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
    select coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
        or not exists (
            select 1
            from auth.mfa_factors f
            where f.user_id = auth.uid()
                and f.status = 'verified'
        )
$$;

-- ---------------------------------------------------------------------------
-- 2. PTS : membre vérifié ET Discord toujours relié au compte
-- ---------------------------------------------------------------------------

create or replace function public.pts_valide(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
    select exists (
        select 1
        from public.membres_pts m
        join auth.identities i
            on i.user_id = m.user_id
            and i.provider = 'discord'
            and i.provider_id = m.discord_id
        where m.user_id = uid
            and m.membre
            and m.verifie_le > pg_catalog.now() - interval '30 days'
    )
$$;

-- ---------------------------------------------------------------------------
-- 3. Fonctions d'accès (même signature qu'avant : le site n'a rien à changer)
-- ---------------------------------------------------------------------------

create or replace function public.a_acces(niveau text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
    select public.mfa_ok() and case niveau
        when 'premium' then exists (
            select 1
            from public.abonnements a
            where a.user_id = auth.uid()
                and a.statut in ('actif', 'essai')
                and (a.fin is null or a.fin > pg_catalog.now())
        )
        when 'pts' then public.pts_valide(auth.uid())
        else false
    end
$$;

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
        public.mfa_ok() and coalesce(a.statut in ('actif', 'essai') and (a.fin is null or a.fin > pg_catalog.now()), false),
        a.statut,
        a.fin,
        public.mfa_ok() and public.pts_valide(moi.uid),
        m.verifie_le
    from (select auth.uid() as uid) moi
    left join public.abonnements a on a.user_id = moi.uid
    left join public.membres_pts m on m.user_id = moi.uid
$$;

-- ---------------------------------------------------------------------------
-- 4. MFA exigée sur les lectures directes des tables (règle « restrictive » : elle s'ajoute aux autres)
-- ---------------------------------------------------------------------------

drop policy if exists profils_mfa on public.profils;
create policy profils_mfa on public.profils as restrictive
    for all to authenticated
    using (public.mfa_ok())
    with check (public.mfa_ok());

drop policy if exists abonnements_mfa on public.abonnements;
create policy abonnements_mfa on public.abonnements as restrictive
    for select to authenticated
    using (public.mfa_ok());

drop policy if exists membres_pts_mfa on public.membres_pts;
create policy membres_pts_mfa on public.membres_pts as restrictive
    for select to authenticated
    using (public.mfa_ok());

-- contenus : déjà protégé par a_acces(), qui exige mfa_ok().

-- ---------------------------------------------------------------------------
-- 5. Droits
-- ---------------------------------------------------------------------------

revoke all on function public.mfa_ok() from anon, authenticated, public;
revoke all on function public.pts_valide(uuid) from anon, authenticated, public;
-- mfa_ok() est appelée par les règles RLS, évaluées avec le rôle de l'utilisateur.
grant execute on function public.mfa_ok() to authenticated, service_role;
grant execute on function public.pts_valide(uuid) to service_role;

revoke all on function public.a_acces(text) from anon, authenticated, public;
revoke all on function public.mon_acces() from anon, authenticated, public;
grant execute on function public.a_acces(text), public.mon_acces() to authenticated, service_role;
