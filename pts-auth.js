// Connexion Discord des outils Pack ta Small (Supabase Auth, fournisseur Discord).
// Règle : outils débloqués SI connecté avec Discord ET membre du serveur Pack ta Small.
// Rappel : site statique, ce verrou se fait dans le navigateur. Il sert à orienter les joueurs
// vers le Discord PTS, pas à protéger des données secrètes.
import { PTS_CONFIG as C } from './pts-config.js';

const CLE_ACCES = 'pts-acces';
const CDN = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm';

export const configure = !C.SUPABASE_URL.includes('REMPLACER') && !C.SUPABASE_ANON_KEY.includes('REMPLACER');
export const INVITATION = C.INVITATION;

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
    if (sb) await sb.auth.signOut();
}

// Pages outils : renvoie vers la page Pack ta Small si les outils ne sont pas débloqués.
export async function garde() {
    const secours = setTimeout(() => location.replace('pts.html?verrou=1'), 8000);
    try {
        const e = await etat();
        clearTimeout(secours);
        if (e.debloque) document.documentElement.classList.remove('pts-attente');
        else location.replace('pts.html?verrou=1');
    } catch {
        location.replace('pts.html?verrou=1');
    }
}
