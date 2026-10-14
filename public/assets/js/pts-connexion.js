// Page de connexion du site (Discord via Supabase).
// 1. Clic sur le bouton : départ vers Discord (via Supabase).
// 2. Retour de Discord sur cette page : le serveur vérifie l'appartenance au serveur Pack ta Small
//    (Edge Function verifier-guilde), puis on renvoie vers la page demandée (`retour`).
import { etat, connexion, configure } from './pts-auth.js';

const btn = document.getElementById('pts-go');
const msg = document.getElementById('pts-msg');
const params = new URLSearchParams(location.search);

// Destination après connexion : uniquement une page du site (pas d'URL externe)
const voulu = params.get('retour') || 'pts.html';
const retour = /^[a-z0-9-]+\.html$/.test(voulu) ? voulu : 'pts.html';
const modePts = retour === 'pts.html' || retour.startsWith('pts-'); // outils PTS : appartenance exigée

const dire = (t) => {
    msg.textContent = t;
};

// Connexion générale au site (profil, paiement…) : textes adaptés, rien de spécifique à PTS
if (!modePts) {
    document.title = 'Connexion — UnDocPourTous';
    document.querySelectorAll('[data-mode]').forEach((el) => {
        el.hidden = el.dataset.mode !== 'site';
    });
    const lienRetour = document.getElementById('pts-retour');
    if (lienRetour) {
        lienRetour.href = retour;
        lienRetour.textContent = '← Revenir à la page précédente';
    }
}
if (params.has('inactif')) dire('Tu as été déconnecté après une période d’inactivité. Reconnecte-toi pour continuer.');

btn.addEventListener('click', async () => {
    if (!configure) {
        dire('La connexion Discord n’est pas encore activée sur le site. Reviens bientôt !');
        return;
    }
    btn.disabled = true;
    dire('Ouverture de Discord…');
    try {
        await connexion(retour);
    } catch {
        btn.disabled = false;
        dire('La connexion n’a pas pu démarrer. Réessaie dans un instant.');
    }
});

const rediriger = (delai) => setTimeout(() => location.replace(retour), delai);

(async () => {
    if (params.get('error_description')) dire('Connexion annulée ou refusée par Discord.');
    if (!configure) return;
    const retourDeDiscord = params.has('code');
    if (retourDeDiscord) {
        btn.disabled = true;
        dire('Vérification de ton compte…');
    }
    try {
        const e = await etat();
        const echec = e.verification === 'echec';
        if (!e.connecte) {
            btn.disabled = false;
            if (retourDeDiscord) dire('La connexion n’a pas abouti. Réessaie.');
            return;
        }
        if (!modePts) {
            // Connexion générale : l'appartenance au serveur PTS n'est pas requise
            dire(
                echec
                    ? `Bienvenue ${e.pseudo} ! Vérification du serveur Pack ta Small impossible pour le moment (tu pourras la relancer depuis ton profil). Redirection…`
                    : `Bienvenue ${e.pseudo} ! Redirection…`,
            );
            rediriger(echec ? 2500 : retourDeDiscord ? 900 : 300);
        } else if (e.debloque) {
            dire(`Bienvenue ${e.pseudo} ! Outils débloqués, redirection…`);
            rediriger(retourDeDiscord ? 900 : 300);
        } else if (echec) {
            btn.disabled = false;
            btn.lastChild.textContent = 'Réessayer avec Discord';
            dire('Vérification impossible pour le moment. Réessaie dans un instant.');
        } else {
            btn.disabled = false;
            btn.lastChild.textContent = 'Revérifier avec Discord';
            dire(
                `Connecté en tant que ${e.pseudo}, mais tu n’es pas encore membre du serveur Pack ta Small. Rejoins-le, puis revérifie.`,
            );
        }
    } catch {
        btn.disabled = false;
        dire('Vérification impossible pour le moment. Réessaie dans un instant.');
    }
})();
