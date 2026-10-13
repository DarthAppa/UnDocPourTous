// Page Pack ta Small : verrouille ou débloque les cartes outils selon la connexion Discord.
// Sans JS (ou en attendant), les cartes restent verrouillées et mènent au Discord PTS.
import { etat, deconnexion, INVITATION } from './pts-auth.js';

const cartes = [...document.querySelectorAll('[data-outil]')];
const zone = document.getElementById('pts-compte');
const btnLogin = document.getElementById('pts-login');
const note = document.getElementById('pts-verrou-note');

export function appliquer(e) {
    document.documentElement.classList.toggle('pts-debloque', e.debloque);

    cartes.forEach((a) => {
        const badge = a.querySelector('.pts-lock-badge');
        const hint = a.querySelector('.card-hint');
        if (e.debloque) {
            a.href = a.dataset.outil;
            a.removeAttribute('target');
            a.removeAttribute('rel');
            a.classList.remove('is-locked');
            badge.innerHTML = '<img src="assets/icons/check.svg" alt="">DÉBLOQUÉ';
            badge.className = 'badge badge-free pts-lock-badge';
            hint.textContent = a.dataset.hintOuvert;
        } else {
            a.href = INVITATION;
            a.target = '_blank';
            a.rel = 'noopener';
            a.classList.add('is-locked');
            hint.textContent = e.connecte ? 'Rejoindre le serveur Pack ta Small →' : 'Rejoindre le Discord pour débloquer →';
        }
    });

    if (e.connecte) {
        btnLogin.hidden = true;
        zone.hidden = false;
        zone.querySelector('[data-pseudo]').textContent = e.pseudo;
        zone.querySelector('[data-statut]').textContent = e.debloque
            ? 'Outils débloqués'
            : 'Pas encore membre du serveur Pack ta Small : rejoins-le, puis reconnecte-toi.';
    } else {
        btnLogin.hidden = false;
        zone.hidden = true;
    }

    if (note) {
        note.textContent = e.debloque
            ? 'Connecté avec Discord : les outils sont débloqués.'
            : 'Outils réservés aux membres du Discord Pack ta Small : connecte-toi avec Discord pour les débloquer.';
    }
}

zone?.querySelector('[data-deconnexion]')?.addEventListener('click', async () => {
    await deconnexion();
    appliquer({ connecte: false, debloque: false, membre: false, pseudo: '' });
});

etat().then(appliquer).catch(() => { /* reste verrouillé */ });
