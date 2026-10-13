// Connexion Discord des outils Pack ta Small (Supabase Auth, fournisseur Discord).
// Règle : outils débloqués SI connecté avec Discord ET membre du serveur Pack ta Small.
// Rappel : site statique, ce verrou se fait dans le navigateur. Il sert à orienter les joueurs
// vers le Discord PTS, pas à protéger des données secrètes.
import { PTS_CONFIG as C } from './pts-config.js';

const CLE_ACCES = 'pts-acces';
const CDN = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm';

export const configure = !C.SUPABASE_URL.includes('REMPLACER') && !C.SUPABASE_ANON_KEY.includes('REMPLACER');
export const INVITATION = C.INVITATION;
export { supabase as getClient };   // client Supabase partagé (fenêtre de connexion du site)

let client = null;
async function supabase() {
    if (!configure) return null;
    if (!client) {
        const { createClient } = await import(CDN);
        client = createClient(C.SUPABASE_URL, C.SUPABASE_ANON_KEY, {
            auth: { persistSession: true, detectSessionInUrl: true, flowType: 'pkce' }
        });
    }
    return client;
}

const lire = () => { try { return JSON.parse(localStorage.getItem(CLE_ACCES)) || null; } catch { return null; } };
const ecrire = (v) => { try { v ? localStorage.setItem(CLE_ACCES, JSON.stringify(v)) : localStorage.removeItem(CLE_ACCES); } catch { /* stockage bloqué */ } };

function pseudo(user) {
    const m = user?.user_metadata || {};
    return m.custom_claims?.global_name || m.full_name || m.name || m.user_name || 'joueur';
}

// État courant : { configure, connecte, membre, debloque, pseudo }
export async function etat() {
    const vide = { configure, connecte: false, membre: false, debloque: false, pseudo: '' };
    const sb = await supabase();
    if (!sb) return vide;
    const { data: { session } } = await sb.auth.getSession();
    if (!session) return vide;

    // Revenu après une longue absence : session close, il faut se reconnecter.
    if (inactifDepuisTrop()) { await deconnexion(); return { ...vide, inactif: true }; }

    // Juste après la connexion, Discord fournit un jeton : on vérifie l'appartenance au serveur.
    if (session.provider_token) await verifierServeur(session);

    let membre = true;
    if (C.GUILD_ID) {
        const a = lire();
        const frais = a && Date.now() - a.verifie < C.VERIF_JOURS * 864e5;
        membre = !!(a && frais && a.uid === session.user.id && a.membre);
    }
    return { configure, connecte: true, membre, debloque: membre, pseudo: pseudo(session.user) };
}

async function verifierServeur(session) {
    if (!C.GUILD_ID) return;
    try {
        const r = await fetch('https://discord.com/api/v10/users/@me/guilds', {
            headers: { Authorization: `Bearer ${session.provider_token}` }
        });
        if (!r.ok) return;
        const serveurs = await r.json();
        ecrire({ uid: session.user.id, membre: serveurs.some((g) => g.id === C.GUILD_ID), verifie: Date.now() });
    } catch { /* réseau : on garde l'état précédent */ }
}

// Lance la connexion Discord ; au retour, l'utilisateur arrive sur connexion-pts.html.
export async function connexion(retour = 'pts.html') {
    const sb = await supabase();
    if (!sb) throw new Error('non-configure');
    noterActivite();   // nouvelle session : le compteur d'inactivité repart de zéro
    const url = new URL('connexion-pts.html', location.href);
    url.searchParams.set('retour', retour);
    await sb.auth.signInWithOAuth({
        provider: 'discord',
        options: { redirectTo: url.href, scopes: 'identify guilds' }
    });
}

export async function deconnexion() {
    const sb = await supabase();
    ecrire(null);
    try { localStorage.removeItem('pts-derniere-activite'); } catch { /* bloqué */ }
    if (sb) await sb.auth.signOut();
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

// ---------- Déconnexion automatique des inactifs ----------
// Dernière activité partagée entre les onglets (localStorage). Au-delà de INACTIVITE_MINUTES
// sans souris, clavier, défilement ni toucher : déconnexion et retour sur pts.html?inactif=1.
// Vaut aussi au retour sur le site après avoir fermé l'onglet longtemps.
const CLE_ACTIVITE = 'pts-derniere-activite';
const limite = () => C.INACTIVITE_MINUTES * 60e3;
const derniereActivite = () => { try { return Number(localStorage.getItem(CLE_ACTIVITE)) || 0; } catch { return 0; } };
const noterActivite = () => { try { localStorage.setItem(CLE_ACTIVITE, String(Date.now())); } catch { /* bloqué */ } };

export function inactifDepuisTrop() {
    const d = derniereActivite();
    return d > 0 && Date.now() - d > limite();
}

let surveillance = null;
export function surveillerInactivite() {
    if (surveillance || !C.INACTIVITE_MINUTES) return;
    if (!derniereActivite()) noterActivite();
    let derniereEcriture = 0;
    const activite = () => {
        const n = Date.now();
        if (n - derniereEcriture > 10e3) { derniereEcriture = n; noterActivite(); }
        cacherAvertissement();
    };
    ['pointerdown', 'pointermove', 'keydown', 'scroll', 'wheel', 'touchstart'].forEach((ev) =>
        addEventListener(ev, activite, { passive: true, capture: true }));
    document.addEventListener('visibilitychange', () => { if (!document.hidden) verifier(); });

    async function verifier() {
        const reste = limite() - (Date.now() - derniereActivite());
        if (reste <= 0) {
            clearInterval(surveillance);
            await deconnexion();
            location.replace('pts.html?inactif=1');
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
        bandeau.setAttribute('role', 'alert');
        bandeau.style.cssText = 'position:fixed;left:50%;bottom:20px;transform:translateX(-50%);z-index:9999;width:min(520px, calc(100% - 32px));box-sizing:border-box;'
            + 'padding:12px 18px;border-radius:10px;background:#070909;color:#D8C091;border:1px solid #D9A64F;'
            + 'box-shadow:0 10px 30px rgba(0,0,0,.6);font:600 14px/1.4 Inter,system-ui,sans-serif;text-align:center';
        document.body.appendChild(bandeau);
    }
    bandeau.textContent = `Inactif depuis un moment : déconnexion dans ${secondes} s. Bouge la souris ou touche l’écran pour rester connecté.`;
}
function cacherAvertissement() { if (bandeau) { bandeau.remove(); bandeau = null; } }

// ---------- Données PTS du joueur (envoyées par l'extension PTS Companion) ----------
// Uniquement sa collection et ses replays : la base ne laisse lire que ses propres lignes (RLS).
export async function mesDonnees() {
    const sb = await supabase();
    if (!sb) return null;
    const [comptes, collections, replays] = await Promise.all([
        sb.from('pts_accounts').select('player_id, username, last_sync'),
        sb.from('collections').select('player_id, n_cards, updated_at'),
        sb.from('replay_uploads').select('match_id', { count: 'exact', head: true })
    ]);
    if (comptes.error || collections.error || replays.error) throw new Error('lecture_impossible');
    return {
        comptes: comptes.data,
        collections: collections.data,
        nbCartes: collections.data.reduce((s, c) => s + (c.n_cards || 0), 0),
        majCollection: collections.data.map((c) => c.updated_at).sort().pop() || null,
        nbReplays: replays.count || 0
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
