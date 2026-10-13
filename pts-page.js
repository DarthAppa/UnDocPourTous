// Page Pack ta Small : verrouille ou débloque les cartes outils selon la connexion Discord.
// Sans JS (ou en attendant), les cartes restent verrouillées et mènent au Discord PTS.
import { etat, deconnexion, mesDonnees, surveillerInactivite, INVITATION } from './pts-auth.js';

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
            badge.innerHTML = '<img src="assets/icons/lock-keyhole.svg" alt="">VERROUILLÉ';
            badge.className = 'badge badge-pts pts-lock-badge';
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

    if (e.connecte) surveillerInactivite();
    afficherDonnees(e);

    if (note && !e.connecte && (e.inactif || new URLSearchParams(location.search).has('inactif'))) {
        note.textContent = `Tu as été déconnecté après une période d’inactivité. Reconnecte-toi avec Discord pour retrouver les outils.`;
        return;
    }
    if (note) {
        note.textContent = e.debloque
            ? 'Connecté avec Discord : les outils sont débloqués.'
            : 'Outils réservés aux membres du Discord Pack ta Small : connecte-toi avec Discord pour les débloquer.';
    }
}

// Collection et replays envoyés par l'extension PTS Companion (rien d'autre)
const blocDonnees = document.getElementById('pts-donnees');
async function afficherDonnees(e) {
    if (!blocDonnees) return;
    if (!e.connecte) { blocDonnees.hidden = true; return; }
    blocDonnees.hidden = false;
    const txt = blocDonnees.querySelector('[data-donnees]');
    txt.textContent = 'Lecture de tes données PTS…';
    try {
        const d = e.donnees || await mesDonnees();
        if (!d || !d.comptes.length) {
            txt.innerHTML = 'Aucune donnée PTS pour l’instant. Installe <b>PTS Companion</b> puis ouvre packtasmall.fr : ta collection et tes replays seront récupérés à chaque connexion au site.';
            return;
        }
        const maj = d.majCollection ? new Date(d.majCollection).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—';
        const nbCartes = Number(d.nbCartes) || 0;   // nombres forcés : rien d'externe n'est injecté en HTML
        const nbReplays = Number(d.nbReplays) || 0;
        txt.innerHTML = `Collection : <b>${nbCartes} cartes</b> (mise à jour le ${maj}) · Replays : <b>${nbReplays}</b>`;
    } catch {
        txt.textContent = 'Impossible de lire tes données PTS pour le moment.';
    }
}

zone?.querySelector('[data-deconnexion]')?.addEventListener('click', async () => {
    await deconnexion();
    history.replaceState(null, '', 'pts.html');   // pas de faux message « inactivité » après une déconnexion voulue
    appliquer({ connecte: false, debloque: false, membre: false, pseudo: '' });
});

etat().then(appliquer).catch(() => { /* reste verrouillé */ });
