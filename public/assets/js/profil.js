// Page « Mon profil » : réservée aux comptes connectés (sinon renvoi vers la connexion).
// Règle : toute donnée venant du compte est écrite avec textContent, jamais en HTML.
import {
    etat,
    configure,
    monProfil,
    monAcces,
    changerPseudo,
    mesDonnees,
    appelerFonction,
    deconnexion,
    deconnexionPartout,
    exporterMesDonnees,
    supprimerCompte,
    surveillerInactivite,
    PSEUDO_MIN,
    PSEUDO_MAX,
} from './pts-auth.js';

const $ = (id) => document.getElementById(id);
const champ = (nom) => document.querySelector(`[data-champ="${nom}"]`);
const dire = (el, texte, ton = '') => {
    if (!el) return;
    el.textContent = texte;
    el.dataset.ton = ton;
};
const attendre = (ms) => new Promise((ok) => setTimeout(ok, ms));

const CONNEXION = 'connexion-pts.html?retour=profil.html';
const AVATAR_DISCORD = 'https://cdn.discordapp.com/';
const FOURNISSEURS = { discord: 'Discord', email: 'E-mail', google: 'Google', twitch: 'Twitch', apple: 'Apple' };
const STATUTS = {
    actif: 'Actif',
    essai: 'Période d’essai',
    annule: 'Annulé',
    impaye: 'Paiement en attente',
    expire: 'Expiré',
};

const statut = $('profil-statut');
const contenu = $('profil-contenu');
const params = new URLSearchParams(location.search);

function dateFr(d) {
    if (!d) return '—';
    const x = new Date(d);
    return Number.isNaN(x.getTime())
        ? '—'
        : x.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

// ---------- Compte ----------
function afficherAvatar(url, pseudo) {
    const boite = $('profil-avatar');
    const initiale = () => boite.replaceChildren(([...pseudo.trim()][0] || '?').toUpperCase());
    const sur = (() => {
        try {
            return typeof url === 'string' && url.startsWith(AVATAR_DISCORD) && new URL(url).protocol === 'https:';
        } catch {
            return false;
        }
    })();
    if (!sur) {
        initiale();
        return;
    }
    const img = document.createElement('img');
    img.alt = '';
    img.width = 72;
    img.height = 72;
    img.referrerPolicy = 'no-referrer';
    img.addEventListener('error', initiale, { once: true }); // avatar supprimé chez Discord : initiale
    img.src = url;
    boite.replaceChildren(img);
}

function afficherProfil(p) {
    champ('pseudo').textContent = p.pseudo;
    champ('email').textContent = p.email || '—';
    champ('fournisseur').textContent = FOURNISSEURS[p.fournisseur] || p.fournisseur || '—';
    champ('cree').textContent = dateFr(p.creeLe);
    $('champ-pseudo').value = p.pseudo;
    afficherAvatar(p.avatarUrl, p.pseudo);
}

// ---------- Premium et Pack ta Small ----------
function afficherAcces(a) {
    if (!a) {
        champ('premium-statut').textContent = 'Lecture impossible pour le moment';
        champ('premium-fin').textContent = '—';
        champ('pts-statut').textContent = 'Lecture impossible pour le moment. Recharge la page dans un instant.';
        return;
    }
    champ('premium-statut').textContent = a.premiumStatut
        ? STATUTS[a.premiumStatut] || a.premiumStatut
        : 'Aucun abonnement';
    champ('premium-fin').textContent = a.premiumFin ? dateFr(a.premiumFin) : '—';
    $('btn-portail').hidden = !a.premiumStatut; // un abonnement existe (même annulé) : gestion chez Stripe
    $('lien-premium').hidden = a.premium;

    champ('pts-statut').textContent = a.pts
        ? `Membre vérifié du serveur Pack ta Small (vérifié le ${dateFr(a.ptsVerifieLe)}). Les outils PTS sont débloqués.`
        : a.ptsVerifieLe
          ? `Non membre du serveur Pack ta Small, ou vérification trop ancienne (dernière vérification le ${dateFr(a.ptsVerifieLe)}).`
          : 'Appartenance au serveur Pack ta Small pas encore vérifiée.';
}

async function afficherDonneesPts() {
    const el = champ('pts-donnees');
    el.textContent = 'Lecture de tes données PTS…';
    try {
        const d = await mesDonnees();
        if (!d || !d.comptes.length) {
            el.textContent =
                'Aucune donnée PTS pour l’instant. Installe PTS Companion puis ouvre packtasmall.fr : ta collection et tes replays seront récupérés à chaque connexion au site.';
            return;
        }
        const maj = d.majCollection ? dateFr(d.majCollection) : '—';
        el.textContent = `Collection : ${Number(d.nbCartes) || 0} cartes (mise à jour le ${maj}) · Replays : ${Number(d.nbReplays) || 0}`;
    } catch {
        el.textContent = 'Impossible de lire tes données PTS pour le moment.';
    }
}

// Retour de Stripe : l'abonnement est enregistré par le webhook, quelques secondes plus tard.
async function suivrePaiement() {
    dire(statut, 'Paiement reçu, merci ! L’accès Premium peut prendre quelques secondes à s’activer.', 'ok');
    history.replaceState(null, '', location.pathname); // paramètre retiré, adresse propre gardée
    for (let i = 0; i < 6; i++) {
        await attendre(3000);
        try {
            const a = await monAcces();
            afficherAcces(a);
            if (a?.premium) {
                dire(statut, 'Paiement reçu : ton accès Premium est actif.', 'ok');
                return;
            }
        } catch {
            /* on réessaie */
        }
    }
    dire(statut, 'Paiement reçu. Ton accès s’affichera ici dès qu’il sera activé : recharge la page dans un instant.');
}

// ---------- Formulaire du pseudo ----------
$('form-pseudo')?.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const input = $('champ-pseudo');
    const msg = $('pseudo-msg');
    const valeur = input.value.trim();
    const n = [...valeur].length;
    if (n < PSEUDO_MIN || n > PSEUDO_MAX) {
        input.setAttribute('aria-invalid', 'true');
        dire(msg, `Ton pseudo doit faire entre ${PSEUDO_MIN} et ${PSEUDO_MAX} caractères.`, 'erreur');
        input.focus();
        return;
    }
    input.removeAttribute('aria-invalid');
    const bouton = ev.currentTarget.querySelector('button[type="submit"]');
    bouton.disabled = true;
    dire(msg, 'Enregistrement…');
    try {
        const pseudo = await changerPseudo(valeur);
        champ('pseudo').textContent = pseudo;
        input.value = pseudo;
        if (!$('profil-avatar').querySelector('img')) afficherAvatar(null, pseudo);
        dire(msg, 'Pseudo enregistré.', 'ok');
    } catch {
        dire(msg, 'Impossible d’enregistrer ton pseudo pour le moment. Réessaie dans un instant.', 'erreur');
    }
    bouton.disabled = false;
});

// ---------- Abonnement ----------
$('btn-portail')?.addEventListener('click', async (ev) => {
    const b = ev.currentTarget;
    const msg = $('premium-msg');
    b.disabled = true;
    dire(msg, 'Ouverture de la gestion de l’abonnement…');
    try {
        const { url } = await appelerFonction('portail-abonnement', {});
        if (typeof url === 'string' && url.startsWith('https://billing.stripe.com/')) {
            location.assign(url);
            return;
        }
        dire(msg, 'La gestion de l’abonnement en ligne arrive bientôt.', 'erreur');
    } catch {
        dire(msg, 'La gestion de l’abonnement est indisponible pour le moment. Réessaie dans un instant.', 'erreur');
    }
    b.disabled = false;
});

// ---------- Sécurité et vie privée ----------
const msgSecurite = $('securite-msg');

$('btn-deconnexion')?.addEventListener('click', async () => {
    await deconnexion();
    location.replace('index.html');
});

$('btn-deconnexion-partout')?.addEventListener('click', async () => {
    dire(msgSecurite, 'Déconnexion de tous les appareils…');
    const ok = await deconnexionPartout();
    if (ok) {
        location.replace('index.html');
        return;
    }
    contenu.hidden = true;
    dire(
        statut,
        'Tu es déconnecté de ce navigateur, mais le serveur n’a pas pu être joint : tes autres appareils sont peut-être encore connectés. Reconnecte-toi plus tard pour réessayer.',
        'erreur',
    );
});

$('btn-export')?.addEventListener('click', async (ev) => {
    const b = ev.currentTarget;
    b.disabled = true;
    dire(msgSecurite, 'Préparation de tes données…');
    try {
        const donnees = await exporterMesDonnees();
        const blob = new Blob([JSON.stringify(donnees, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `undocpourtous-mes-donnees-${new Date().toISOString().slice(0, 10)}.json`;
        document.body.append(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 10e3);
        dire(msgSecurite, 'Tes données ont été téléchargées (fichier JSON).', 'ok');
    } catch {
        dire(msgSecurite, 'Impossible de préparer tes données pour le moment. Réessaie dans un instant.', 'erreur');
    }
    b.disabled = false;
});

// Suppression : dialogue où il faut taper SUPPRIMER
const dialogue = $('dialogue-suppression');
const confirmation = $('champ-confirmation');
const btnConfirmer = $('btn-confirmer-suppression');
const msgSuppression = $('suppression-msg');
const confirme = () => confirmation.value.trim() === 'SUPPRIMER';

$('btn-suppression')?.addEventListener('click', () => {
    confirmation.value = '';
    btnConfirmer.disabled = true;
    dire(msgSuppression, '');
    dialogue.showModal();
    confirmation.focus();
});
confirmation?.addEventListener('input', () => {
    btnConfirmer.disabled = !confirme();
});
dialogue?.querySelector('[data-fermer]')?.addEventListener('click', () => dialogue.close());
dialogue?.addEventListener('close', () => $('btn-suppression').focus());
$('form-suppression')?.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    if (!confirme()) return;
    btnConfirmer.disabled = true;
    dire(msgSuppression, 'Suppression de ton compte…');
    try {
        await supprimerCompte();
        location.replace('index.html');
    } catch {
        dire(
            msgSuppression,
            'La suppression n’a pas pu aboutir. Réessaie dans un instant ou contacte-nous sur Discord.',
            'erreur',
        );
        btnConfirmer.disabled = !confirme();
    }
});

// ---------- Chargement ----------
(async () => {
    if (!configure) {
        dire(statut, 'La connexion n’est pas encore activée sur le site. Reviens bientôt !');
        return;
    }
    dire(statut, 'Chargement de ton profil…');
    let e;
    try {
        e = await etat();
    } catch {
        dire(statut, 'Impossible de charger ton profil pour le moment. Réessaie dans un instant.', 'erreur');
        return;
    }
    if (!e.connecte) {
        location.replace(CONNEXION + (e.inactif ? '&inactif=1' : ''));
        return;
    }
    surveillerInactivite(`${CONNEXION}&inactif=1`);

    const [profil, acces] = await Promise.allSettled([monProfil(), monAcces()]);
    if (profil.status !== 'fulfilled' || !profil.value) {
        dire(statut, 'Impossible de charger ton profil pour le moment. Réessaie dans un instant.', 'erreur');
        return;
    }
    afficherProfil(profil.value);
    afficherAcces(acces.status === 'fulfilled' ? acces.value : null);
    contenu.hidden = false;
    dire(statut, '');
    afficherDonneesPts();
    if (params.get('paiement') === 'ok') suivrePaiement();
})();
