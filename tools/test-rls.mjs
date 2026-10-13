// Teste les règles RLS de la migration Supabase sur un VRAI Postgres 16.
// Usage : DATABASE_URL=postgres://postgres:postgres@localhost:5432/postgres node tools/test-rls.mjs
// Crée une base neuve et jetable, y installe un mini-Supabase (supabase/tests/stub-supabase.sql),
// applique la migration deux fois (elle doit être rejouable), joue les cas puis supprime la base.
// Il faut un rôle superutilisateur (créer une base, des rôles anon/authenticated/service_role).
import pg from 'pg';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';

const URL_BASE = process.env.DATABASE_URL;
if (!URL_BASE) {
    console.error('DATABASE_URL manquant (ex. postgres://postgres:postgres@localhost:5432/postgres)');
    process.exit(1);
}

const lire = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const STUB = lire('supabase/tests/stub-supabase.sql');
const MIGRATION = lire('supabase/migrations/20261013120000_securite_premium_profil.sql');

let echecs = 0;
let reussites = 0;
const verif = (ok, texte) => {
    console.log(`${ok ? '  ✓' : '  ✗'} ${texte}`);
    if (ok) reussites++;
    else echecs++;
};

const nomBase = `test_rls_${process.pid}_${Date.now()}`;
const admin = new pg.Client({ connectionString: URL_BASE });
await admin.connect();
await admin.query(`create database ${nomBase}`);

const urlTest = new URL(URL_BASE);
urlTest.pathname = `/${nomBase}`;
const c = new pg.Client({ connectionString: urlTest.href });
// Les avertissements (raise warning) du trigger ne doivent pas polluer la sortie.
c.on('notice', () => {});

const A = randomUUID();
const B = randomUUID();
const C = randomUUID();
const D = randomUUID();
const E = randomUUID();

// Exécute fn dans une transaction annulée, avec le rôle et l'utilisateur (JWT « sub ») donnés.
async function enTantQue(role, uid, fn) {
    await c.query('begin');
    try {
        await c.query(`set local role ${role}`);
        if (uid) await c.query("select set_config('request.jwt.claim.sub', $1, true)", [uid]);
        return await fn();
    } finally {
        await c.query('rollback');
    }
}
const lignes = (role, uid, sql, params = []) => enTantQue(role, uid, async () => (await c.query(sql, params)).rows);
// Renvoie le code d'erreur Postgres (ex. 42501 = droit refusé), ou 'ok' si la requête passe.
const codeErreur = (role, uid, sql, params = []) =>
    enTantQue(role, uid, async () => {
        try {
            await c.query(sql, params);
            return 'ok';
        } catch (e) {
            return e.code;
        }
    });
const sql = (texte, params = []) => c.query(texte, params);
const DROIT_REFUSE = '42501';

try {
    await c.connect();
    await sql(STUB);
    await sql(MIGRATION);

    console.log('\n[migration]');
    let rejouable = true;
    try {
        await sql(MIGRATION);
    } catch {
        rejouable = false;
    }
    verif(rejouable, 'la migration se rejoue sans erreur');

    const rls = await sql(
        `select relname, relrowsecurity from pg_class
         where relnamespace = 'public'::regnamespace and relname in ('profils','abonnements','membres_pts','contenus')`,
    );
    verif(rls.rows.length === 4 && rls.rows.every((r) => r.relrowsecurity), 'RLS activée sur les 4 tables');

    const definer = await sql(
        `select proname, prosecdef, proconfig from pg_proc
         where pronamespace = 'public'::regnamespace and proname in ('a_acces','mon_acces','creer_profil')`,
    );
    verif(
        definer.rows.length === 3 &&
            definer.rows.every((r) => r.prosecdef && (r.proconfig || []).includes('search_path=""')),
        'fonctions security definer avec search_path vide',
    );

    const droits = (
        await sql(`select
            has_function_privilege('anon', 'public.a_acces(text)', 'execute') as anon_a_acces,
            has_function_privilege('anon', 'public.mon_acces()', 'execute') as anon_mon_acces,
            has_function_privilege('authenticated', 'public.creer_profil()', 'execute') as auth_creer_profil,
            has_function_privilege('authenticated', 'public.a_acces(text)', 'execute') as auth_a_acces,
            has_function_privilege('authenticated', 'public.mon_acces()', 'execute') as auth_mon_acces,
            has_table_privilege('anon', 'public.contenus', 'select') as anon_contenus,
            has_table_privilege('authenticated', 'public.contenus', 'insert') as auth_insert_contenus,
            has_column_privilege('authenticated', 'public.profils', 'avatar_url', 'update') as auth_avatar`)
    ).rows[0];
    verif(!droits.anon_a_acces && !droits.anon_mon_acces, 'anon ne peut exécuter ni a_acces ni mon_acces');
    verif(!droits.auth_creer_profil, 'authenticated ne peut pas exécuter le trigger creer_profil');
    verif(droits.auth_a_acces && droits.auth_mon_acces, 'authenticated peut exécuter a_acces et mon_acces');
    verif(
        !droits.anon_contenus && !droits.auth_insert_contenus && !droits.auth_avatar,
        'droits de tables minimaux (rien pour anon, pas d’écriture des contenus ni de l’avatar)',
    );

    console.log('\n[inscription → profil]');
    const inscrire = (id, meta) =>
        sql('insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, $3)', [
            id,
            `${id}@exemple.test`,
            meta === undefined ? null : JSON.stringify(meta),
        ]);
    await inscrire(A, {
        custom_claims: { global_name: 'Alice' },
        full_name: 'alice_discord',
        avatar_url: 'https://cdn.discordapp.com/avatars/111/abc.png',
    });
    await inscrire(B, { full_name: 'Bob', avatar_url: 'https://pirate.exemple/x.png' });
    let inscriptionNull = true;
    try {
        await inscrire(C, undefined);
        await inscrire(D, [1, 2, 3]);
        await inscrire(E, { name: 'x'.repeat(80), avatar_url: 'javascript:alert(1)//cdn.discordapp.com/' });
    } catch {
        inscriptionNull = false;
    }
    verif(inscriptionNull, 'inscriptions avec métadonnées absentes, tableau ou bizarres acceptées');
    const profils = Object.fromEntries(
        (await sql('select id, pseudo, avatar_url from public.profils')).rows.map((r) => [r.id, r]),
    );
    verif(
        profils[A]?.pseudo === 'Alice' && profils[A]?.avatar_url === 'https://cdn.discordapp.com/avatars/111/abc.png',
        'profil créé par le trigger (pseudo global_name, avatar Discord gardé)',
    );
    verif(profils[B]?.pseudo === 'Bob' && profils[B]?.avatar_url === null, 'avatar hors CDN Discord ignoré');
    verif(
        profils[C] && profils[C].pseudo === null && profils[D] !== undefined,
        'métadonnées nulles : profil vide créé',
    );
    verif(
        profils[E]?.pseudo?.length === 40 && profils[E]?.avatar_url === null,
        'pseudo tronqué à 40, avatar piégé ignoré',
    );

    console.log('\n[isolation entre utilisateurs]');
    await sql(
        `insert into public.abonnements (user_id, statut, fin, stripe_customer_id, stripe_subscription_id)
               values ($1, 'actif', now() + interval '20 days', 'cus_B', 'sub_B')`,
        [B],
    );
    await sql(`insert into public.membres_pts (user_id, discord_id, membre) values ($1, '222', true)`, [B]);
    let r = await lignes('authenticated', A, 'select id from public.profils');
    verif(r.length === 1 && r[0].id === A, 'A ne lit que son propre profil');
    r = await lignes('authenticated', A, 'select * from public.abonnements');
    verif(r.length === 0, 'A ne lit pas l’abonnement de B');
    r = await lignes('authenticated', A, 'select * from public.membres_pts');
    verif(r.length === 0, 'A ne lit pas la vérification PTS de B');
    r = await lignes('authenticated', B, 'select user_id from public.abonnements');
    verif(r.length === 1 && r[0].user_id === B, 'B lit son propre abonnement');

    console.log('\n[écritures interdites]');
    verif(
        (await codeErreur('authenticated', A, `insert into public.abonnements (user_id, statut) values ($1, 'actif')`, [
            A,
        ])) === DROIT_REFUSE,
        'A ne peut pas s’insérer un abonnement',
    );
    verif(
        (await codeErreur('authenticated', B, `update public.abonnements set fin = now() + interval '10 years'`)) ===
            DROIT_REFUSE,
        'B ne peut pas prolonger son abonnement',
    );
    verif(
        (await codeErreur(
            'authenticated',
            A,
            `insert into public.membres_pts (user_id, discord_id, membre) values ($1, '1', true)`,
            [A],
        )) === DROIT_REFUSE,
        'A ne peut pas se déclarer membre PTS',
    );
    verif(
        (await codeErreur('authenticated', B, `update public.membres_pts set verifie_le = now()`)) === DROIT_REFUSE,
        'B ne peut pas rafraîchir sa vérification PTS',
    );
    verif(
        (await codeErreur(
            'authenticated',
            A,
            `insert into public.contenus (slug, titre, niveau, html) values ('x','x','pts','x')`,
        )) === DROIT_REFUSE,
        'A ne peut pas publier de contenu',
    );
    verif(
        (await codeErreur('authenticated', A, `delete from public.profils where id = $1`, [A])) === DROIT_REFUSE,
        'A ne peut pas supprimer son profil directement',
    );

    console.log('\n[modification du profil]');
    r = await enTantQue('authenticated', A, async () => {
        const res = await c.query(`update public.profils set pseudo = 'Alice2' where id = $1`, [A]);
        const relu = await c.query('select pseudo from public.profils where id = $1', [A]);
        return { n: res.rowCount, pseudo: relu.rows[0]?.pseudo };
    });
    verif(r.n === 1 && r.pseudo === 'Alice2', 'A modifie son pseudo');
    r = await enTantQue(
        'authenticated',
        A,
        async () => (await c.query(`update public.profils set pseudo = 'pirate' where id = $1`, [B])).rowCount,
    );
    verif(r === 0, 'A ne modifie pas le pseudo de B (0 ligne)');
    verif(
        (await codeErreur(
            'authenticated',
            A,
            `update public.profils set avatar_url = 'https://cdn.discordapp.com/x' where id = $1`,
            [A],
        )) === DROIT_REFUSE,
        'A ne peut pas modifier avatar_url',
    );
    verif(
        (await codeErreur('authenticated', A, `update public.profils set id = $2 where id = $1`, [A, randomUUID()])) ===
            DROIT_REFUSE,
        'A ne peut pas changer l’id de son profil',
    );

    console.log('\n[visiteur anonyme]');
    for (const table of ['profils', 'abonnements', 'membres_pts', 'contenus'])
        verif(
            (await codeErreur('anon', null, `select * from public.${table}`)) === DROIT_REFUSE,
            `anon ne lit rien dans ${table}`,
        );
    verif(
        (await codeErreur('anon', null, `select * from public.mon_acces()`)) === DROIT_REFUSE,
        'anon ne peut pas appeler mon_acces()',
    );

    console.log('\n[contenus premium]');
    await sql(`insert into public.contenus (slug, titre, niveau, html) values
               ('guide-premium', 'Guide premium', 'premium', '<p>secret premium</p>'),
               ('guide-pts', 'Guide PTS', 'pts', '<p>secret pts</p>')`);
    const voit = async (uid, slug) =>
        (await lignes('authenticated', uid, 'select slug from public.contenus where slug = $1', [slug])).length === 1;
    const abonner = (statut, fin) =>
        sql(
            `insert into public.abonnements (user_id, statut, fin) values ($1, $2, $3)
             on conflict (user_id) do update set statut = excluded.statut, fin = excluded.fin`,
            [A, statut, fin],
        );
    verif(!(await voit(A, 'guide-premium')), 'premium invisible sans abonnement');
    verif(await voit(B, 'guide-premium'), 'premium visible pour B (abonnement actif)');
    await abonner('actif', new Date(Date.now() + 10 * 864e5));
    verif(await voit(A, 'guide-premium'), 'premium visible avec abonnement actif');
    verif(!(await voit(A, 'guide-pts')), 'l’abonnement premium ne donne pas les contenus PTS');
    await abonner('actif', new Date(Date.now() - 864e5));
    verif(!(await voit(A, 'guide-premium')), 'premium invisible si la fin est passée');
    await abonner('annule', new Date(Date.now() + 10 * 864e5));
    verif(!(await voit(A, 'guide-premium')), 'premium invisible si statut annule');
    await abonner('impaye', new Date(Date.now() + 10 * 864e5));
    verif(!(await voit(A, 'guide-premium')), 'premium invisible si statut impaye');
    await abonner('essai', null);
    verif(await voit(A, 'guide-premium'), 'premium visible en essai sans date de fin');

    console.log('\n[contenus PTS]');
    const membre = (estMembre, jours) =>
        sql(
            `insert into public.membres_pts (user_id, discord_id, membre, verifie_le)
             values ($1, '111', $2, now() - make_interval(days => $3))
             on conflict (user_id) do update set membre = excluded.membre, verifie_le = excluded.verifie_le`,
            [A, estMembre, jours],
        );
    await membre(true, 10);
    verif(await voit(A, 'guide-pts'), 'PTS visible si membre vérifié il y a 10 jours');
    await membre(true, 31);
    verif(!(await voit(A, 'guide-pts')), 'PTS invisible si vérifié il y a 31 jours');
    await membre(false, 1);
    verif(!(await voit(A, 'guide-pts')), 'PTS invisible si non membre');

    console.log('\n[mon_acces()]');
    await membre(true, 10);
    const acces = async (uid) => (await lignes('authenticated', uid, 'select * from public.mon_acces()'))[0];
    let m = await acces(A);
    verif(
        m.premium === true &&
            m.premium_statut === 'essai' &&
            m.premium_fin === null &&
            m.pts === true &&
            m.pts_verifie_le,
        'A : premium (essai) et PTS',
    );
    await abonner('annule', new Date(Date.now() + 864e5));
    await membre(true, 31);
    m = await acces(A);
    verif(
        m.premium === false && m.premium_statut === 'annule' && m.pts === false,
        'A : plus rien après annulation et 31 jours',
    );
    m = await acces(C);
    verif(
        m.premium === false && m.premium_statut === null && m.pts === false && m.pts_verifie_le === null,
        'C : rien, sans erreur',
    );
    m = (await lignes('authenticated', null, 'select * from public.mon_acces()'))[0];
    verif(m.premium === false && m.pts === false, 'sans utilisateur : tout à faux');
    m = (await lignes('authenticated', A, `select public.a_acces('autre') as x`))[0];
    verif(m.x === false, 'a_acces d’un niveau inconnu : faux');

    console.log('\n[service_role et contraintes]');
    verif(
        (await codeErreur(
            'service_role',
            null,
            `insert into public.contenus (slug, titre, niveau, html) values ('nouveau-guide','t','premium','<p>x</p>')`,
        )) === 'ok',
        'service_role peut publier un contenu',
    );
    verif(
        (await codeErreur(
            'service_role',
            null,
            `insert into public.contenus (slug, titre, niveau, html) values ('Mauvais Slug','t','premium','x')`,
        )) === '23514',
        'slug invalide refusé par la base',
    );
    verif(
        (await codeErreur('service_role', null, `update public.abonnements set statut = 'gratuit' where user_id = $1`, [
            A,
        ])) === '23514',
        'statut d’abonnement inconnu refusé',
    );

    console.log('\n[suppression du compte]');
    await sql('delete from auth.users where id = $1', [A]);
    const restes = (
        await sql(
            `select (select count(*) from public.profils where id = $1)
                  + (select count(*) from public.abonnements where user_id = $1)
                  + (select count(*) from public.membres_pts where user_id = $1) as n`,
            [A],
        )
    ).rows[0].n;
    verif(Number(restes) === 0, 'suppression de l’utilisateur : profil, abonnement et membre supprimés (cascade)');
} catch (e) {
    echecs++;
    console.error('  ✗ erreur inattendue :', e.message);
} finally {
    await c.end().catch(() => {});
    await admin.query(`drop database if exists ${nomBase}`).catch(() => {});
    await admin.end();
}

console.log(`\n${reussites} ✓, ${echecs} ✗`);
process.exit(echecs ? 1 : 0);
