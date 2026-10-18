// Module d'authentification du site (Supabase Auth, fournisseur Discord).
// - Connexion, déconnexion, déconnexion automatique des inactifs, garde des pages outils PTS.
// - Appartenance au serveur Pack ta Small : la SOURCE DE VÉRITÉ est la table membres_pts,
//   écrite uniquement par l'Edge Function verifier-guilde (le navigateur ne décide de rien).
// - Profil, accès Premium, contenus réservés, Edge Functions, export et suppression du compte.
// La base ne laisse lire à chacun que ses propres lignes (RLS).
import { PTS_CONFIG as C } from './pts-config.js';

const CLIENT = '../vendor/supabase.mjs'; // client Supabase servi par le site (pas de CDN)
const REF = (() => {
    try {
        return new URL(C.SUPABASE_URL).hostname.split('.')[0];
    } catch {
        return '';
    }
})();
const CLE_SESSION = `sb-${REF}-auth-token`; // clé de stockage de la session Supabase

export const configure = !C.SUPABASE_URL.includes('REMPLACER') && !C.SUPABASE_ANON_KEY.includes('REMPLACER');
export const INVITATION = C.INVITATION;
export { supabase as getClient }; // client Supabase partagé (fenêtre de connexion du site)

// Ancien cache local de l'appartenance au serveur : plus utilisé, on le purge.
try {
    localStorage.removeItem('pts-acces');
} catch {
    /* stockage bloqué */
}

let client = null;
async function supabase() {
    if (!configure) return null;
    if (!client) {
        const { createClient } = await import(CLIENT);
        client = createClient(C.SUPABASE_URL, C.SUPABASE_ANON_KEY, {
            auth: { persistSession: true, detectSessionInUrl: true, flowType: 'pkce' },
        });
    }
    return client;
}

async function sessionCourante() {
    const sb = await supabase();
    if (!sb) return { sb: null, session: null };
    const {
        data: { session },
    } = await sb.auth.getSession();
    return { sb, session };
}

function pseudo(user) {
    const m = user?.user_metadata || {};
    return m.custom_claims?.global_name || m.full_name || m.name || m.user_name || 'joueur';
}

// Erreur normalisée : e.code ∈ non-configure, non-connecte, refuse, indisponible,
// trop-de-demandes, invalide, reseau, serveur, lecture-impossible ; e.statut = code HTTP éventuel
function erreur(code, statut = 0) {
    const e = new Error(code);
    e.code = code;
    e.statut = statut;
    return e;
}

// État courant : { configure, connecte, membre, debloque, pseudo, verification }
// verification : null (rien à vérifier), 'ok' ou 'echec' (juste après un retour de Discord)
export async function etat() {
    const vide = { configure, connecte: false, membre: false, debloque: false, pseudo: '', verification: null };
    const { sb, session } = await sessionCourante();
    if (!session) return vide;

    // Revenu après une longue absence : session close, il faut se reconnecter.
    if (inactifDepuisTrop()) {
        await deconnexion();
        return { ...vide, inactif: true };
    }

    // Juste après la connexion, Discord fournit un jeton : le serveur vérifie l'appartenance.
    let verification = null;
    if (session.provider_token) verification = await verifierServeur(sb, session);

    const membre = await estMembre(sb, session);
    return { configure, connecte: true, membre, debloque: membre, pseudo: pseudo(session.user), verification };
}

async function estMembre(sb, session) {
    if (!C.GUILD_ID) return true; // aucun serveur exigé : tout compte connecté passe
    const { data, error } = await sb
        .from('membres_pts')
        .select('membre, verifie_le')
        .eq('user_id', session.user.id)
        .maybeSingle();
    if (error || !data) return false;
    const age = Date.now() - new Date(data.verifie_le).getTime();
    return data.membre === true && age >= 0 && age < C.VERIF_JOURS * 864e5;
}

// Retire provider_token / provider_refresh_token de la session enregistrée (droits identify + guilds)
function oublierJetonDiscord() {
    try {
        const cle = `sb-${new URL(C.SUPABASE_URL).hostname.split('.')[0]}-auth-token`;
        const session = JSON.parse(localStorage.getItem(cle));
        if (session && (session.provider_token || session.provider_refresh_token)) {
            delete session.provider_token;
            delete session.provider_refresh_token;
            localStorage.setItem(cle, JSON.stringify(session));
        }
    } catch {
        /* stockage bloqué ou illisible */
    }
}

// Un seul appel même si plusieurs scripts demandent l'état en même temps
let verifEnCours = null;
function verifierServeur(sb, session) {
    verifEnCours ??= (async () => {
        let resultat = 'ok';
        try {
            if (C.GUILD_ID)
                await appelerFonction('verifier-guilde', { provider_token: session.provider_token }, session);
        } catch {
            resultat = 'echec';
        }
        // Le jeton Discord n'a plus d'utilité : une session rafraîchie ne le contient plus.
        try {
            const { error } = await sb.auth.refreshSession();
            if (error) throw error;
        } catch {
            oublierJetonDiscord(); // rafraîchissement impossible : on retire quand même le jeton du stockage
        }
        return resultat;
    })().finally(() => {
        verifEnCours = null;
    });
    return verifEnCours;
}

// Lance la connexion Discord ; au retour, l'utilisateur arrive sur connexion-pts.html.
export async function connexion(retour = 'pts.html') {
    if (!/^[a-z0-9-]+\.html$/.test(retour)) retour = 'pts.html'; // jamais de redirection hors du site
    const sb = await supabase();
    if (!sb) throw erreur('non-configure');
    noterActivite(); // nouvelle session : le compteur d'inactivité repart de zéro
    const url = new URL('connexion-pts.html', location.href);
    url.searchParams.set('retour', retour);
    await sb.auth.signInWithOAuth({
        provider: 'discord',
        options: { redirectTo: url.href, scopes: 'identify guilds' },
    });
}

function purgerSessionLocale() {
    try {
        localStorage.removeItem(CLE_SESSION);
        localStorage.removeItem(`${CLE_SESSION}-code-verifier`);
    } catch {
        /* bloqué */
    }
}

// Déconnexion fiable : l'état local est effacé d'abord, même hors ligne.
async function fermerSession(scope) {
    arreterSurveillance();
    try {
        localStorage.removeItem(CLE_ACTIVITE);
    } catch {
        /* bloqué */
    }
    let echec = null;
    try {
        const sb = await supabase();
        if (sb) ({ error: echec } = await sb.auth.signOut({ scope }));
    } catch (e) {
        echec = e;
    }
    // Hors ligne ou client injoignable : on purge quand même la session Supabase stockée
    if (echec) purgerSessionLocale();
    return !echec;
}
// scope 'local' : ne coupe pas la session de l'extension PTS Companion (même projet Supabase).
export async function deconnexion() {
    await fermerSession('local');
}
// Coupe toutes les sessions du compte (autres appareils, extension PTS Companion comprise).
// Renvoie false si le serveur n'a pas pu être joint (la session de ce navigateur est fermée quand même).
export async function deconnexionPartout() {
    return fermerSession('global');
}

// Pages outils : renvoie vers la page Pack ta Small si les outils ne sont pas débloqués.
export async function garde() {
    const secours = setTimeout(() => location.replace('pts.html?verrou=1'), 8000);
    try {
        const e = await etat();
        clearTimeout(secours);
        if (e.debloque) {
            document.documentElement.classList.remove('pts-attente');
            surveillerInactivite();
        } else location.replace('pts.html?verrou=1');
    } catch {
        location.replace('pts.html?verrou=1');
    }
}

// ---------- Edge Functions ----------
// POST `${SUPABASE_URL}/functions/v1/<nom>` avec le jeton de l'utilisateur. Erreurs normalisées (voir erreur()).
export async function appelerFonction(nom, corps = {}, session = null) {
    if (!/^[a-z0-9-]+$/.test(nom)) throw erreur('invalide');
    if (!configure) throw erreur('non-configure');
    if (!session) {
        try {
            ({ session } = await sessionCourante());
        } catch {
            throw erreur('reseau');
        }
    }
    if (!session?.access_token) throw erreur('non-connecte');
    let r;
    try {
        r = await fetch(`${C.SUPABASE_URL}/functions/v1/${nom}`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${session.access_token}`,
                apikey: C.SUPABASE_ANON_KEY,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(corps),
        });
    } catch {
        throw erreur('reseau');
    }
    let donnees = null;
    try {
        donnees = await r.json();
    } catch {
        /* réponse vide ou non JSON */
    }
    if (!r.ok) {
        const codes = {
            400: 'invalide',
            401: 'non-connecte',
            403: 'refuse',
            404: 'indisponible',
            429: 'trop-de-demandes',
        };
        throw erreur(codes[r.status] || 'serveur', r.status);
    }
    return donnees ?? {};
}

// ---------- Compte, profil, accès ----------
// { premium, premiumStatut, premiumFin, pts, ptsVerifieLe } ou null si non connecté
export async function monAcces() {
    const { sb, session } = await sessionCourante();
    if (!session) return null;
    const { data, error } = await sb.rpc('mon_acces');
    if (error) throw erreur('lecture-impossible');
    const l = (Array.isArray(data) ? data[0] : data) || {};
    return {
        premium: l.premium === true,
        premiumStatut: l.premium_statut ?? null,
        premiumFin: l.premium_fin ?? null,
        pts: l.pts === true,
        ptsVerifieLe: l.pts_verifie_le ?? null,
    };
}

// Profil + informations du compte (e-mail, fournisseur, date de création), ou null si non connecté
export async function monProfil() {
    const { sb, session } = await sessionCourante();
    if (!session) return null;
    const u = session.user;
    const { data, error } = await sb.from('profils').select('pseudo, avatar_url, cree_le').eq('id', u.id).maybeSingle();
    if (error) throw erreur('lecture-impossible');
    return {
        id: u.id,
        pseudo: data?.pseudo || pseudo(u),
        avatarUrl: data?.avatar_url || null,
        email: u.email || '',
        fournisseur: u.app_metadata?.provider || '',
        creeLe: data?.cree_le || u.created_at || null,
    };
}

export const PSEUDO_MIN = 2;
export const PSEUDO_MAX = 32;
export async function changerPseudo(p) {
    const valeur = String(p ?? '').trim();
    const n = [...valeur].length;
    if (n < PSEUDO_MIN || n > PSEUDO_MAX) throw erreur('invalide');
    const { sb, session } = await sessionCourante();
    if (!session) throw erreur('non-connecte');
    const { error } = await sb.from('profils').update({ pseudo: valeur }).eq('id', session.user.id);
    if (error) throw erreur('serveur');
    return valeur;
}

// Contenu réservé (Premium ou PTS) : null si l'utilisateur n'y a pas accès (la base ne renvoie aucune ligne).
export async function chargerContenu(slug) {
    if (!/^[a-z0-9-]+$/.test(slug)) throw erreur('invalide');
    const { sb, session } = await sessionCourante();
    if (!session) return null;
    const { data, error } = await sb.from('contenus').select('html, titre').eq('slug', slug).maybeSingle();
    if (error) throw erreur('lecture-impossible');
    return data || null;
}

// Tout ce que le site sait du compte, en un objet (téléchargé en JSON par la page profil)
export async function exporterMesDonnees() {
    const { sb, session } = await sessionCourante();
    if (!session) throw erreur('non-connecte');
    const lire = async (f) => {
        try {
            return await f();
        } catch {
            return { erreur: 'lecture impossible' };
        }
    };
    const u = session.user;
    return {
        site: 'UnDocPourTous',
        exporte_le: new Date().toISOString(),
        compte: {
            id: u.id,
            email: u.email || null,
            fournisseur: u.app_metadata?.provider || null,
            cree_le: u.created_at || null,
        },
        profil: await lire(async () => {
            const { data, error } = await sb.from('profils').select('*').eq('id', u.id).maybeSingle();
            if (error) throw error;
            return data;
        }),
        abonnement: await lire(monAcces),
        membres_pts: await lire(async () => {
            const { data, error } = await sb.from('membres_pts').select('*').eq('user_id', u.id).maybeSingle();
            if (error) throw error;
            return data;
        }),
        pts: await lire(mesDonnees),
    };
}

// Suppression définitive du compte (côté serveur), puis nettoyage du navigateur.
export async function supprimerCompte() {
    await appelerFonction('supprimer-compte', { confirmation: 'SUPPRIMER' });
    await deconnexion();
    purgerSessionLocale(); // le compte n'existe plus : rien ne doit rester
}

// ---------- Déconnexion automatique des inactifs ----------
// Dernière activité partagée entre les onglets (localStorage). Au-delà de INACTIVITE_MINUTES
// sans souris, clavier, défilement ni toucher : déconnexion et renvoi vers `destination`.
// Vaut aussi au retour sur le site après avoir fermé l'onglet longtemps.
const CLE_ACTIVITE = 'pts-derniere-activite';
const limite = () => C.INACTIVITE_MINUTES * 60e3;
const derniereActivite = () => {
    try {
        return Number(localStorage.getItem(CLE_ACTIVITE)) || 0;
    } catch {
        return 0;
    }
};
const noterActivite = () => {
    try {
        localStorage.setItem(CLE_ACTIVITE, String(Date.now()));
    } catch {
        /* bloqué */
    }
};

function inactifDepuisTrop() {
    const d = derniereActivite();
    return d > 0 && Date.now() - d > limite();
}

let surveillance = null;
let arretEcoute = null;
function arreterSurveillance() {
    clearInterval(surveillance);
    surveillance = null;
    arretEcoute?.abort();
    arretEcoute = null;
    cacherAvertissement();
}
export function surveillerInactivite(destination = 'pts.html?inactif=1') {
    if (surveillance || !C.INACTIVITE_MINUTES) return;
    if (!derniereActivite()) noterActivite();
    arretEcoute = new AbortController();
    const options = { passive: true, capture: true, signal: arretEcoute.signal };
    let derniereEcriture = 0;
    const activite = () => {
        const n = Date.now();
        if (n - derniereEcriture > 10e3) {
            derniereEcriture = n;
            noterActivite();
        }
        cacherAvertissement();
    };
    ['pointerdown', 'pointermove', 'keydown', 'scroll', 'wheel', 'touchstart'].forEach((ev) =>
        addEventListener(ev, activite, options),
    );
    document.addEventListener(
        'visibilitychange',
        () => {
            if (!document.hidden) verifier();
        },
        { signal: arretEcoute.signal },
    );

    async function verifier() {
        const d = derniereActivite();
        if (!d) {
            arreterSurveillance();
            return;
        } // déconnecté (bouton ou autre onglet) : plus rien à surveiller
        const reste = limite() - (Date.now() - d);
        if (reste <= 0) {
            await deconnexion();
            location.replace(destination);
        } else if (reste <= 60e3) afficherAvertissement(Math.ceil(reste / 1000));
        else cacherAvertissement();
    }
    surveillance = setInterval(verifier, 5e3);
    verifier();
}

// Bandeau d'avertissement autonome (styles en ligne : marche aussi sur les pages outils)
let bandeau = null;
function afficherAvertissement(secondes) {
    if (!bandeau) {
        bandeau = document.createElement('div');
        bandeau.id = 'pts-avertissement';
        bandeau.setAttribute('role', 'status'); // annoncé poliment, pas relu en boucle toutes les 5 s
        bandeau.setAttribute('aria-live', 'polite');
        bandeau.style.cssText =
            'position:fixed;left:50%;bottom:20px;transform:translateX(-50%);z-index:9999;width:min(520px, calc(100% - 32px));box-sizing:border-box;' +
            'padding:12px 18px;border-radius:10px;background:#070909;color:#D8C091;border:1px solid #D9A64F;' +
            'box-shadow:0 10px 30px rgba(0,0,0,.6);font:600 14px/1.4 Inter,system-ui,sans-serif;text-align:center';
        document.body.appendChild(bandeau);
    }
    bandeau.textContent = `Inactif depuis un moment : déconnexion dans ${secondes} s. Bouge la souris ou touche l’écran pour rester connecté.`;
}
function cacherAvertissement() {
    if (bandeau) {
        bandeau.remove();
        bandeau = null;
    }
}

// ---------- Données PTS du joueur (envoyées par l'extension PTS Companion) ----------
// Uniquement sa collection et ses replays : la base ne laisse lire que ses propres lignes (RLS).
export async function mesDonnees() {
    const sb = await supabase();
    if (!sb) return null;
    const [comptes, collections, replays] = await Promise.all([
        sb.from('pts_accounts').select('player_id, username, last_sync'),
        sb.from('collections').select('player_id, n_cards, updated_at'),
        sb.from('replay_uploads').select('match_id', { count: 'exact', head: true }),
    ]);
    if (comptes.error || collections.error || replays.error) throw new Error('lecture_impossible');
    return {
        comptes: comptes.data,
        collections: collections.data,
        nbCartes: collections.data.reduce((s, c) => s + (c.n_cards || 0), 0),
        majCollection:
            collections.data
                .map((c) => c.updated_at)
                .sort()
                .pop() || null,
        nbReplays: replays.count || 0,
    };
}

// Collection complète d'un compte (pour le builder « ma collection »)
export async function maCollection(playerId) {
    const sb = await supabase();
    if (!sb) return null;
    let q = sb.from('collections').select('player_id, roster, meta, updated_at');
    if (playerId) q = q.eq('player_id', playerId);
    const { data, error } = await q.order('updated_at', { ascending: false }).limit(1);
    if (error) throw error;
    return data[0] || null;
}
