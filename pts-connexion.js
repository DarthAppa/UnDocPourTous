// Page de connexion Pack ta Small.
// 1. Clic sur le bouton : départ vers Discord (via Supabase).
// 2. Retour de Discord sur cette page : on vérifie l'appartenance au serveur, puis on renvoie vers les outils.
import { etat, connexion, configure } from './pts-auth.js';

const btn = document.getElementById('pts-go');
const msg = document.getElementById('pts-msg');
const params = new URLSearchParams(location.search);

// Destination après connexion : uniquement une page du site (pas d'URL externe)
const voulu = params.get('retour') || 'pts.html';
const retour = /^[a-z0-9-]+\.html$/.test(voulu) ? voulu : 'pts.html';

const dire = (t) => {
    msg.textContent = t;
};

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
        if (e.debloque) {
            dire(`Bienvenue ${e.pseudo} ! Outils débloqués, redirection…`);
            setTimeout(() => location.replace(retour), retourDeDiscord ? 900 : 300);
        } else if (e.connecte) {
            btn.disabled = false;
            btn.lastChild.textContent = 'Revérifier avec Discord';
            dire(
                `Connecté en tant que ${e.pseudo}, mais tu n’es pas encore membre du serveur Pack ta Small. Rejoins-le, puis revérifie.`,
            );
        } else if (retourDeDiscord) {
            btn.disabled = false;
            dire('La connexion n’a pas abouti. Réessaie.');
        }
    } catch {
        btn.disabled = false;
        dire('Impossible de vérifier la connexion pour le moment. Réessaie dans un instant.');
    }
})();
