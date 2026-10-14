// En-tête et pied de page : « Connexion » devient « Mon profil » quand une session existe.
// Aucun appel réseau : on regarde seulement si la session Supabase est enregistrée dans ce navigateur.
// (La session peut avoir expiré : profil.html renverra alors vers la connexion.)
import { PTS_CONFIG as C } from './pts-config.js';

// Anti-clickjacking : GitHub Pages ne permet pas l'en-tête frame-ancestors, donc si le site est
// affiché dans le cadre d'une autre page, on le masque (personne ne peut faire cliquer à notre place).
if (window.top !== window.self) document.documentElement.hidden = true;

function sessionEnregistree() {
    try {
        const ref = new URL(C.SUPABASE_URL).hostname.split('.')[0];
        return !!localStorage.getItem(`sb-${ref}-auth-token`);
    } catch {
        return false; // stockage bloqué ou réglage invalide : on garde « Connexion »
    }
}

// Retour d'une connexion Google/Twitch ou d'un lien reçu par e-mail (?code=…) : on termine la connexion.
// connexion-pts.html gère elle-même son retour Discord (pts-connexion.js).
const retour = new URLSearchParams(location.search);
const pageConnexionPts = /connexion-pts\.html$/.test(location.pathname);
if (!pageConnexionPts && (retour.has('code') || retour.has('error_description'))) {
    import('./auth-modal.js').then((m) => m.retourConnexion());
} else if (!sessionEnregistree() && document.querySelector('a.btn-login')) {
    // Pas connecté : « Connexion » ouvre la fenêtre de connexion / inscription (sans JS, le lien reste valable)
    import('./auth-modal.js');
}

if (sessionEnregistree()) {
    document.querySelectorAll('a.btn-login').forEach((a) => {
        a.href = 'profil.html';
        a.setAttribute('aria-label', 'Mon profil');
        const texte = a.querySelector('span');
        if (texte) texte.textContent = 'Mon profil';
    });
    document.querySelectorAll('a.footer-link[href="connexion-pts.html"]').forEach((a) => {
        a.href = 'profil.html';
        a.textContent = 'Mon profil';
        a.setAttribute('aria-label', 'Mon profil');
    });
}
