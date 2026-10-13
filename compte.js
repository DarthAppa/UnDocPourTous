// Compte du site : Google, e-mail + mot de passe, mot de passe oublié, double authentification (TOTP).
// Discord n'est pas un moyen de connexion : il se relie au compte (pts-auth.js › relierDiscord).
// Toutes les erreurs sont traduites en français par messageErreur() ; aucune donnée sensible n'est journalisée.
import { PTS_CONFIG as C } from './pts-config.js';
import { getClient, configure, pageSure } from './pts-auth.js';

export { configure };
export const MDP_MIN = C.MDP_MIN || 10;
export const CONNEXIONS = Array.isArray(C.CONNEXIONS) ? C.CONNEXIONS : ['email'];

const ERREURS = {
    invalid_credentials: 'E-mail ou mot de passe incorrect.',
    email_not_confirmed: 'Confirme d’abord ton adresse : un lien t’a été envoyé par e-mail.',
    user_already_exists: 'Un compte existe déjà avec cet e-mail. Connecte-toi, ou utilise « Mot de passe oublié ».',
    email_exists: 'Un compte existe déjà avec cet e-mail. Connecte-toi, ou utilise « Mot de passe oublié ».',
    weak_password: `Mot de passe trop faible : au moins ${C.MDP_MIN || 10} caractères, avec des lettres et des chiffres.`,
    same_password: 'Le nouveau mot de passe doit être différent de l’ancien.',
    over_email_send_rate_limit: 'Trop d’e-mails envoyés. Réessaie dans quelques minutes.',
    over_request_rate_limit: 'Trop de tentatives. Patiente quelques minutes avant de réessayer.',
    captcha_failed: 'La vérification anti-robot a échoué. Recoche la case et réessaie.',
    signup_disabled: 'Les inscriptions sont fermées pour le moment.',
    email_address_invalid: 'Cette adresse e-mail n’est pas acceptée.',
    mfa_verification_failed: 'Code incorrect ou expiré. Saisis le code affiché en ce moment dans ton application.',
    mfa_challenge_expired: 'Le code a expiré. Saisis le nouveau code affiché dans ton application.',
    identity_already_exists: 'Ce compte Discord est déjà relié à un autre compte UnDocPourTous.',
    provider_disabled: 'Ce moyen de connexion n’est pas encore activé.',
    validation_failed: 'Vérifie les champs saisis.',
    reauthentication_needed: 'Par sécurité, reconnecte-toi avant de changer ton mot de passe.',
};

// Message lisible pour une erreur Supabase (ou d'ailleurs)
export function messageErreur(e) {
    if (e?.code && ERREURS[e.code]) return ERREURS[e.code];
    const m = String(e?.message || '');
    if (/invalid login credentials/i.test(m)) return ERREURS.invalid_credentials;
    if (/email not confirmed/i.test(m)) return ERREURS.email_not_confirmed;
    if (/already registered/i.test(m)) return ERREURS.user_already_exists;
    if (/captcha/i.test(m)) return ERREURS.captcha_failed;
    if (/password/i.test(m) && /(weak|short|at least|characters)/i.test(m)) return ERREURS.weak_password;
    if (e?.name === 'TypeError' || /fetch|network/i.test(m))
        return 'Connexion au serveur impossible. Vérifie ton réseau.';
    return 'Une erreur est survenue. Réessaie dans un instant.';
}

// Règle de mot de passe (la même que celle réglée dans Supabase)
export function mdpValide(mdp) {
    const s = String(mdp ?? '');
    return s.length >= MDP_MIN && /[A-Za-z]/.test(s) && /\d/.test(s);
}

async function client() {
    const sb = await getClient();
    if (!sb) throw Object.assign(new Error('non configuré'), { code: 'provider_disabled' });
    return sb;
}

const urlPage = (page, params = {}) => {
    const u = new URL(page, location.href);
    u.search = '';
    u.hash = '';
    for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
    return u.href;
};

// Fournisseurs réellement activés dans Supabase (réglages publics du projet) : on n'affiche pas un
// bouton « Continuer avec Google » qui mènerait à une erreur tant que Google n'est pas configuré.
export async function fournisseursActifs() {
    try {
        const r = await fetch(`${C.SUPABASE_URL}/auth/v1/settings`, { headers: { apikey: C.SUPABASE_ANON_KEY } });
        if (!r.ok) return {};
        const s = await r.json();
        return s && typeof s.external === 'object' ? s.external : {};
    } catch {
        return {};
    }
}

// ---------- Connexion / inscription ----------

export async function connexionGoogle(retour) {
    const sb = await client();
    const { error } = await sb.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: urlPage('connexion.html', { retour: pageSure(retour) }) },
    });
    if (error) throw error;
}

export async function connexionEmail(email, mdp, captchaToken) {
    const sb = await client();
    const { data, error } = await sb.auth.signInWithPassword({
        email,
        password: mdp,
        options: captchaToken ? { captchaToken } : undefined,
    });
    if (error) throw error;
    return data.session;
}

// Renvoie 'connecte' (compte actif tout de suite) ou 'a-confirmer' (e-mail de confirmation envoyé).
export async function inscription({ email, mdp, pseudo, retour, captchaToken }) {
    if (!mdpValide(mdp)) throw { code: 'weak_password' };
    const sb = await client();
    const { data, error } = await sb.auth.signUp({
        email,
        password: mdp,
        options: {
            data: {
                name: String(pseudo || '')
                    .trim()
                    .slice(0, 32),
            },
            emailRedirectTo: urlPage('connexion.html', { retour: pageSure(retour) }),
            ...(captchaToken ? { captchaToken } : {}),
        },
    });
    if (error) throw error;
    // Adresse déjà inscrite et confirmée : Supabase répond sans identité (pour ne rien révéler).
    // On affiche le même message que pour une nouvelle inscription : rien ne fuit sur l'existence du compte.
    return data.session ? 'connecte' : 'a-confirmer';
}

export async function motDePasseOublie(email, captchaToken) {
    const sb = await client();
    const { error } = await sb.auth.resetPasswordForEmail(email, {
        redirectTo: urlPage('connexion.html', { vue: 'nouveau-mdp' }),
        ...(captchaToken ? { captchaToken } : {}),
    });
    if (error) throw error;
}

export async function changerMotDePasse(mdp) {
    if (!mdpValide(mdp)) throw { code: 'weak_password' };
    const sb = await client();
    const { error } = await sb.auth.updateUser({ password: mdp });
    if (error) throw error;
}

// Renvoie la session courante (ou null) ; utile au retour de Google / du lien e-mail.
export async function sessionActuelle() {
    if (!configure) return null;
    const sb = await client();
    const { data } = await sb.auth.getSession();
    return data.session || null;
}

// Écoute l'arrivée par le lien « mot de passe oublié » (événement PASSWORD_RECOVERY)
export async function surRecuperation(fn) {
    if (!configure) return;
    const sb = await client();
    sb.auth.onAuthStateChange((evenement) => {
        if (evenement === 'PASSWORD_RECOVERY') fn();
    });
}

// ---------- Double authentification (application type Google Authenticator) ----------

// { actif, facteurs: [{ id, nom, cree_le }], niveau, niveauRequis }
export async function etatMfa() {
    const sb = await client();
    const [f, n] = await Promise.all([sb.auth.mfa.listFactors(), sb.auth.mfa.getAuthenticatorAssuranceLevel()]);
    if (f.error) throw f.error;
    const totp = (f.data?.totp || []).filter((x) => x.status === 'verified');
    return {
        actif: totp.length > 0,
        facteurs: totp.map((x) => ({ id: x.id, nom: x.friendly_name || 'Application', cree_le: x.created_at })),
        niveau: n.data?.currentLevel || 'aal1',
        niveauRequis: n.data?.nextLevel || 'aal1',
    };
}

// Étape 1 : crée le facteur et renvoie le QR code (image SVG en data:) et la clé à saisir à la main.
export async function commencerMfa() {
    const sb = await client();
    // Un essai précédent abandonné (non vérifié) bloque un nouvel essai : on le retire d'abord.
    const { data: liste } = await sb.auth.mfa.listFactors();
    for (const x of liste?.all || []) if (x.status !== 'verified') await sb.auth.mfa.unenroll({ factorId: x.id });
    const { data, error } = await sb.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName: `UnDocPourTous ${new Date().toISOString().slice(0, 10)}`,
    });
    if (error) throw error;
    return { factorId: data.id, qr: data.totp.qr_code, secret: data.totp.secret };
}

// Valide un code à 6 chiffres pour un facteur (activation, ou connexion avec double authentification).
export async function validerCodeMfa(factorId, code) {
    const propre = String(code ?? '').replace(/\s+/g, '');
    if (!/^\d{6}$/.test(propre)) throw { code: 'mfa_verification_failed' };
    const sb = await client();
    const { data: defi, error: e1 } = await sb.auth.mfa.challenge({ factorId });
    if (e1) throw e1;
    const { error: e2 } = await sb.auth.mfa.verify({ factorId, challengeId: defi.id, code: propre });
    if (e2) throw e2;
}

// Connexion avec double authentification : valide le code avec le premier facteur vérifié.
export async function validerConnexionMfa(code) {
    const { facteurs } = await etatMfa();
    if (!facteurs.length) return;
    await validerCodeMfa(facteurs[0].id, code);
}

export async function desactiverMfa(factorId) {
    const sb = await client();
    const { error } = await sb.auth.mfa.unenroll({ factorId });
    if (error) throw error;
    await sb.auth.refreshSession().catch(() => {});
}

// ---------- Anti-robot (Cloudflare Turnstile) ----------
// Charge le widget dans `boite` si une clé publique est réglée. Renvoie { jeton(), reinitialiser() }.
let turnstileCharge = null;
export async function antiRobot(boite) {
    const cle = C.TURNSTILE_SITE_KEY;
    const vide = { actif: false, jeton: () => '', reinitialiser: () => {} };
    if (!cle || !boite) return vide;
    turnstileCharge ??= new Promise((ok, ko) => {
        const s = document.createElement('script');
        s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
        s.async = true;
        s.onload = () => ok(globalThis.turnstile);
        s.onerror = ko;
        document.head.append(s);
    });
    try {
        const ts = await turnstileCharge;
        let jeton = '';
        const id = ts.render(boite, {
            sitekey: cle,
            language: 'fr',
            theme: 'dark',
            callback: (t) => {
                jeton = t;
            },
            'expired-callback': () => {
                jeton = '';
            },
        });
        return {
            actif: true,
            jeton: () => jeton,
            reinitialiser: () => {
                jeton = '';
                ts.reset(id);
            },
        };
    } catch {
        return vide;
    }
}
