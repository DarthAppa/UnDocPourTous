// Page de connexion du site : Google, e-mail + mot de passe, création de compte, mot de passe oublié,
// nouveau mot de passe (lien reçu par e-mail) et code de double authentification.
// Après connexion, retour vers ?retour=<page>.html (uniquement une page du site).
import { etat, deconnexion, pageSure } from './pts-auth.js';
import {
    configure,
    CONNEXIONS,
    fournisseursActifs,
    MDP_MIN,
    mdpValide,
    messageErreur,
    connexionGoogle,
    connexionEmail,
    inscription,
    motDePasseOublie,
    changerMotDePasse,
    validerConnexionMfa,
    surRecuperation,
    antiRobot,
} from './compte.js';

const params = new URLSearchParams(location.search);
const hash = new URLSearchParams(location.hash.slice(1));
const retour = pageSure(params.get('retour'), 'profil.html');
const $ = (s) => document.querySelector(s);
const msg = $('#compte-msg');
const titre = $('#titre-compte');

const dire = (texte, ton = '') => {
    msg.textContent = texte;
    msg.dataset.ton = ton;
};
const TITRES = {
    accueil: 'Connexion',
    oublie: 'Mot de passe oublié',
    'nouveau-mdp': 'Nouveau mot de passe',
    mfa: 'Double authentification',
    info: 'Vérifie ta boîte mail',
};
function vue(nom, garderMessage = false) {
    document.querySelectorAll('[data-vue]').forEach((v) => {
        v.hidden = v.dataset.vue !== nom;
    });
    titre.textContent = TITRES[nom] || 'Connexion';
    if (!garderMessage) dire('');
    const premier = document.querySelector(`[data-vue="${nom}"] input`);
    if (premier && nom !== 'accueil') premier.focus();
}
function info(texte) {
    $('[data-info]').textContent = texte;
    vue('info');
}
const partir = () => location.replace(retour);
const occupe = (form, oui) =>
    form.querySelectorAll('button, input').forEach((e) => {
        e.disabled = oui;
    });

// ---------- Onglets Se connecter / Créer un compte ----------
const onglets = [...document.querySelectorAll('[role="tab"]')];
function choisir(nom, focus = false) {
    onglets.forEach((t) => {
        const actif = t.dataset.onglet === nom;
        t.setAttribute('aria-selected', String(actif));
        t.tabIndex = actif ? 0 : -1;
        document.getElementById(t.getAttribute('aria-controls')).hidden = !actif;
        if (actif && focus) t.focus();
    });
    dire('');
}
onglets.forEach((t, i) => {
    t.addEventListener('click', () => choisir(t.dataset.onglet));
    t.addEventListener('keydown', (e) => {
        if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
        e.preventDefault();
        const j = (i + (e.key === 'ArrowRight' ? 1 : onglets.length - 1)) % onglets.length;
        choisir(onglets[j].dataset.onglet, true);
    });
});
document.querySelectorAll('[data-aller]').forEach((b) => b.addEventListener('click', () => vue(b.dataset.aller)));
document.querySelectorAll('[data-aide-mdp]').forEach((p) => {
    p.textContent = `Au moins ${MDP_MIN} caractères, avec des lettres et des chiffres.`;
});

// ---------- Anti-robot (si une clé Turnstile est réglée) ----------
let robot = { actif: false, jeton: () => '', reinitialiser: () => {} };
const jetonRobot = () => {
    if (robot.actif && !robot.jeton()) {
        dire('Coche d’abord la case anti-robot ci-dessous.', 'erreur');
        return null;
    }
    return robot.jeton() || undefined;
};

// ---------- Google (affiché seulement s'il est activé dans Supabase) ----------
if (configure && CONNEXIONS.includes('google'))
    fournisseursActifs().then((actifs) => {
        const google = actifs.google === true;
        $('#btn-google').hidden = !google;
        $('#separateur').hidden = !google;
    });
$('#btn-google').addEventListener('click', async (ev) => {
    if (!configure) return dire('La connexion n’est pas encore activée sur le site.', 'erreur');
    const b = ev.currentTarget;
    b.disabled = true;
    dire('Ouverture de Google…');
    try {
        await connexionGoogle(retour);
    } catch (e) {
        b.disabled = false;
        dire(messageErreur(e), 'erreur');
    }
});

// ---------- Formulaires ----------
function surEnvoi(id, action) {
    const form = document.getElementById(id);
    form.addEventListener('submit', async (ev) => {
        ev.preventDefault();
        if (!configure) return dire('La connexion n’est pas encore activée sur le site.', 'erreur');
        if (!form.checkValidity()) {
            form.reportValidity();
            return;
        }
        const d = Object.fromEntries(new FormData(form));
        occupe(form, true);
        try {
            await action(d, form);
        } catch (e) {
            dire(messageErreur(e), 'erreur');
        } finally {
            occupe(form, false);
            robot.reinitialiser(); // un jeton anti-robot ne sert qu'une fois
        }
    });
}

surEnvoi('form-connexion', async (d) => {
    const captcha = jetonRobot();
    if (captcha === null) return;
    dire('Connexion…');
    await connexionEmail(d.email.trim(), d.mdp, captcha);
    const e = await etat();
    if (e.mfaRequis) return vue('mfa');
    dire('Connecté ! Redirection…', 'ok');
    partir();
});

surEnvoi('form-inscription', async (d) => {
    if ([...String(d.pseudo).trim()].length < 2) return dire('Ton pseudo doit faire au moins 2 caractères.', 'erreur');
    if (!mdpValide(d.mdp))
        return dire(
            `Mot de passe trop faible : au moins ${MDP_MIN} caractères, avec des lettres et des chiffres.`,
            'erreur',
        );
    const captcha = jetonRobot();
    if (captcha === null) return;
    dire('Création du compte…');
    const r = await inscription({ email: d.email.trim(), mdp: d.mdp, pseudo: d.pseudo, retour, captchaToken: captcha });
    if (r === 'connecte') {
        dire('Compte créé. Bienvenue !', 'ok');
        partir();
        return;
    }
    info(
        `Si cette adresse n’a pas encore de compte, un e-mail de confirmation vient d’être envoyé à ${d.email.trim()}. Clique sur le lien qu’il contient pour activer ton compte (pense à regarder dans les indésirables).`,
    );
});

surEnvoi('form-oublie', async (d) => {
    const captcha = jetonRobot();
    if (captcha === null) return;
    await motDePasseOublie(d.email.trim(), captcha);
    info(
        'Si un compte existe avec cette adresse, un e-mail vient d’être envoyé avec un lien pour choisir un nouveau mot de passe.',
    );
});

surEnvoi('form-nouveau-mdp', async (d) => {
    if (!mdpValide(d.mdp))
        return dire(
            `Mot de passe trop faible : au moins ${MDP_MIN} caractères, avec des lettres et des chiffres.`,
            'erreur',
        );
    if (d.mdp !== d.mdp2) return dire('Les deux mots de passe ne sont pas identiques.', 'erreur');
    await changerMotDePasse(d.mdp);
    dire('Mot de passe enregistré. Redirection…', 'ok');
    history.replaceState(null, '', 'connexion.html');
    setTimeout(() => location.replace('profil.html'), 900);
});

surEnvoi('form-mfa', async (d) => {
    await validerConnexionMfa(d.code);
    dire('Code validé. Redirection…', 'ok');
    partir();
});

$('[data-deconnexion]').addEventListener('click', async () => {
    await deconnexion();
    vue('accueil');
});

// ---------- Chargement ----------
(async () => {
    if (!configure) {
        dire('La connexion n’est pas encore activée sur le site. Reviens bientôt !');
        return;
    }
    robot = await antiRobot(document.getElementById('anti-robot'));

    // Erreur renvoyée par Google ou par un lien e-mail (expiré, déjà utilisé…)
    const erreur = params.get('error_code') || hash.get('error_code') || params.get('error') || hash.get('error');
    if (erreur) {
        dire(
            /otp_expired|expired/.test(erreur)
                ? 'Ce lien a expiré ou a déjà été utilisé. Recommence la démarche pour en recevoir un nouveau.'
                : erreur === 'access_denied'
                  ? 'Connexion annulée.'
                  : 'La connexion n’a pas abouti. Réessaie.',
            'erreur',
        );
    }
    if (params.has('inactif'))
        dire('Tu as été déconnecté après une période d’inactivité. Reconnecte-toi pour continuer.');

    // Arrivée par le lien « mot de passe oublié »
    let recuperation = params.get('vue') === 'nouveau-mdp';
    await surRecuperation(() => {
        recuperation = true;
        vue('nouveau-mdp');
    });

    try {
        const e = await etat();
        if (recuperation && e.connecte) return vue('nouveau-mdp', true);
        if (recuperation) {
            vue('oublie', true);
            if (!erreur) dire('Ce lien n’est plus valable. Demande un nouveau lien ci-dessous.', 'erreur');
            return;
        }
        if (e.mfaRequis) return vue('mfa', true);
        if (e.connecte) {
            dire('Tu es connecté. Redirection…', 'ok');
            partir();
            return;
        }
        if (params.get('vue') === 'inscription') choisir('inscription');
        vue('accueil', true);
    } catch {
        dire('Connexion au serveur impossible pour le moment. Réessaie dans un instant.', 'erreur');
    }
})();
