// Page « Débloquer les outils Pack ta Small » : relier son Discord à son compte du site.
// 1. Pas connecté au site : on renvoie vers connexion.html (Google ou e-mail), qui revient ici ensuite.
// 2. Connecté : bouton « Relier mon Discord » (ou « Revérifier » s'il est déjà relié) → Discord.
// 3. Retour de Discord : le serveur vérifie l'appartenance au serveur Pack ta Small (Edge Function
//    verifier-guilde), puis on renvoie vers la page demandée (`retour`).
import { etat, relierDiscord, configure, pageSure, urlConnexion } from './pts-auth.js';

const btn = document.getElementById('pts-go');
const texteBtn = btn.querySelector('[data-texte]') || btn.lastChild;
const msg = document.getElementById('pts-msg');
const params = new URLSearchParams(location.search);
const hash = new URLSearchParams(location.hash.slice(1));
const retour = pageSure(params.get('retour'), 'pts.html');

const dire = (t) => {
    msg.textContent = t;
};
const libelle = (t) => {
    texteBtn.textContent = t;
};
const rediriger = (delai) => setTimeout(() => location.replace(retour), delai);

let action = 'connexion'; // 'connexion' (vers connexion.html) ou 'discord'
btn.addEventListener('click', async () => {
    if (!configure) {
        dire('La connexion n’est pas encore activée sur le site. Reviens bientôt !');
        return;
    }
    if (action === 'connexion') {
        location.assign(urlConnexion('connexion-pts.html'));
        return;
    }
    btn.disabled = true;
    dire('Ouverture de Discord…');
    try {
        await relierDiscord(retour);
    } catch (e) {
        btn.disabled = false;
        dire(
            e?.code === 'non-connecte'
                ? 'Ta session a expiré : reconnecte-toi à ton compte.'
                : e?.code === 'indisponible'
                  ? 'Relier Discord n’est pas encore activé sur le site. Reviens bientôt !'
                  : 'Discord n’a pas pu s’ouvrir. Réessaie dans un instant.',
        );
    }
});

function erreurRetour() {
    const code = params.get('error_code') || hash.get('error_code') || '';
    const err = params.get('error') || hash.get('error') || '';
    if (!code && !err) return '';
    if (code === 'identity_already_exists')
        return 'Ce compte Discord est déjà relié à un autre compte UnDocPourTous. Connecte-toi à ce compte-là, ou utilise un autre Discord.';
    if (err === 'access_denied') return 'Autorisation annulée sur Discord.';
    return 'Discord n’a pas pu être relié. Réessaie dans un instant.';
}

(async () => {
    if (!configure) return;
    const probleme = erreurRetour();
    const retourDeDiscord = params.has('code');
    if (retourDeDiscord) {
        btn.disabled = true;
        dire('Vérification de ton compte…');
    }
    try {
        const e = await etat();
        btn.disabled = false;
        if (!e.connecte) {
            action = 'connexion';
            libelle('Se connecter ou créer un compte');
            dire(
                e.mfaRequis
                    ? 'Saisis d’abord ton code de double authentification.'
                    : 'Étape 1 : connecte-toi à ton compte UnDocPourTous (Google ou e-mail). Étape 2 : relie ton Discord.',
            );
            return;
        }
        action = 'discord';
        if (probleme) {
            libelle(e.discord ? 'Revérifier avec Discord' : 'Relier mon Discord');
            dire(probleme);
            return;
        }
        if (e.debloque) {
            dire(`Bienvenue ${e.pseudo} ! Outils débloqués, redirection…`);
            rediriger(retourDeDiscord ? 900 : 300);
            return;
        }
        if (e.verification === 'echec') {
            libelle('Réessayer avec Discord');
            dire('Vérification impossible pour le moment. Réessaie dans un instant.');
            return;
        }
        if (!e.discord) {
            libelle('Relier mon Discord');
            dire(
                `Connecté en tant que ${e.pseudo}. Relie ton Discord pour vérifier que tu es membre du serveur Pack ta Small.`,
            );
            return;
        }
        libelle('Revérifier avec Discord');
        dire(
            'Discord relié, mais tu n’es pas (encore) membre du serveur Pack ta Small, ou ta vérification date de plus de 30 jours. Rejoins le serveur, puis revérifie.',
        );
    } catch {
        btn.disabled = false;
        dire('Vérification impossible pour le moment. Réessaie dans un instant.');
    }
})();
