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
    relierDiscord,
    delierDiscord,
    urlConnexion,
    PSEUDO_MIN,
    PSEUDO_MAX,
} from './pts-auth.js';
import {
    MDP_MIN,
    mdpValide,
    messageErreur,
    changerMotDePasse,
    etatMfa,
    commencerMfa,
    validerCodeMfa,
    desactiverMfa,
} from './compte.js';

const $ = (id) => document.getElementById(id);
const champ = (nom) => document.querySelector(`[data-champ="${nom}"]`);
const dire = (el, texte, ton = '') => {
    if (!el) return;
    el.textContent = texte;
    el.dataset.ton = ton;
};
const attendre = (ms) => new Promise((ok) => setTimeout(ok, ms));

const CONNEXION = urlConnexion('profil.html');
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
    const moyens = (p.fournisseurs?.length ? p.fournisseurs : [p.fournisseur]).filter(Boolean);
    champ('fournisseur').textContent = moyens.map((f) => FOURNISSEURS[f] || f).join(', ') || '—';
    afficherDiscord(p);
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
    history.replaceState(null, '', 'profil.html');
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

// ---------- Discord relié (outils Pack ta Small) ----------
function afficherDiscord(p) {
    champ('discord-statut').textContent = p.discord
        ? 'Discord relié à ton compte. Revérifie si tu viens de rejoindre le serveur ou si ta vérification a plus de 30 jours.'
        : 'Aucun Discord relié. Relie le tien pour débloquer les outils Pack ta Small.';
    $('btn-discord').textContent = p.discord ? 'Revérifier avec Discord' : 'Relier mon Discord';
    // Délier n'est possible que s'il reste un autre moyen de se connecter (Google, e-mail).
    $('btn-delier-discord').hidden = !p.discord || (p.fournisseurs || []).length < 2;
}

$('btn-discord')?.addEventListener('click', async (ev) => {
    const b = ev.currentTarget;
    b.disabled = true;
    dire($('discord-msg'), 'Ouverture de Discord…');
    try {
        await relierDiscord('profil.html');
    } catch (e) {
        b.disabled = false;
        dire(
            $('discord-msg'),
            e?.code === 'indisponible'
                ? 'Relier Discord n’est pas encore activé sur le site.'
                : 'Discord n’a pas pu s’ouvrir. Réessaie dans un instant.',
            'erreur',
        );
    }
});

$('btn-delier-discord')?.addEventListener('click', async (ev) => {
    const b = ev.currentTarget;
    b.disabled = true;
    dire($('discord-msg'), 'Retrait de Discord…');
    try {
        await delierDiscord();
        const [p, a] = await Promise.all([monProfil(), monAcces().catch(() => null)]);
        if (p) afficherDiscord(p);
        afficherAcces(a);
        dire(
            $('discord-msg'),
            'Discord retiré de ton compte. Les outils Pack ta Small sont de nouveau verrouillés.',
            'ok',
        );
    } catch (e) {
        dire(
            $('discord-msg'),
            e?.code === 'refuse'
                ? 'Impossible : Discord est ton seul moyen de connexion. Choisis d’abord un mot de passe ci-dessous.'
                : 'Impossible de retirer Discord pour le moment. Réessaie dans un instant.',
            'erreur',
        );
    }
    b.disabled = false;
});

// ---------- Mot de passe ----------
$('aide-mdp').textContent = `Au moins ${MDP_MIN} caractères, avec des lettres et des chiffres.`;
$('form-mdp')?.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const form = ev.currentTarget;
    const msg = $('mdp-msg');
    const mdp = $('champ-mdp').value;
    if (!mdpValide(mdp)) {
        dire(
            msg,
            `Mot de passe trop faible : au moins ${MDP_MIN} caractères, avec des lettres et des chiffres.`,
            'erreur',
        );
        return;
    }
    if (mdp !== $('champ-mdp2').value) {
        dire(msg, 'Les deux mots de passe ne sont pas identiques.', 'erreur');
        return;
    }
    const bouton = form.querySelector('button[type="submit"]');
    bouton.disabled = true;
    dire(msg, 'Enregistrement…');
    try {
        await changerMotDePasse(mdp);
        form.reset();
        dire(msg, 'Mot de passe enregistré.', 'ok');
    } catch (e) {
        dire(msg, messageErreur(e), 'erreur');
    }
    bouton.disabled = false;
});

// ---------- Double authentification ----------
const msgMfa = $('mfa-msg');
let facteurEnCours = null;
async function afficherMfa() {
    try {
        const m = await etatMfa();
        champ('mfa-statut').textContent = m.actif
            ? 'Activée : un code de ton application est demandé à chaque connexion.'
            : 'Désactivée. Active-la pour protéger ton compte même si ton mot de passe fuit.';
        $('btn-mfa-activer').hidden = m.actif;
        $('btn-mfa-desactiver').hidden = !m.actif;
        $('btn-mfa-desactiver').dataset.facteur = m.facteurs[0]?.id || '';
    } catch {
        champ('mfa-statut').textContent = 'État de la double authentification illisible pour le moment.';
    }
}
$('btn-mfa-activer')?.addEventListener('click', async (ev) => {
    const b = ev.currentTarget;
    b.disabled = true;
    dire(msgMfa, 'Préparation…');
    try {
        const { factorId, qr, secret } = await commencerMfa();
        facteurEnCours = factorId;
        if (typeof qr === 'string' && qr.startsWith('data:image/')) {
            const img = document.createElement('img');
            img.alt = 'QR code à scanner avec ton application';
            img.width = 164;
            img.height = 164;
            img.src = qr;
            $('mfa-qr').replaceChildren(img);
        }
        $('mfa-secret').textContent = secret;
        $('form-mfa-activation').hidden = false;
        b.hidden = true;
        dire(msgMfa, '');
        $('champ-mfa').focus();
    } catch (e) {
        dire(msgMfa, messageErreur(e), 'erreur');
    }
    b.disabled = false;
});
$('btn-mfa-annuler')?.addEventListener('click', async () => {
    $('form-mfa-activation').hidden = true;
    if (facteurEnCours) await desactiverMfa(facteurEnCours).catch(() => {});
    facteurEnCours = null;
    dire(msgMfa, '');
    afficherMfa();
});
$('form-mfa-activation')?.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const form = ev.currentTarget;
    const bouton = form.querySelector('button[type="submit"]');
    bouton.disabled = true;
    try {
        await validerCodeMfa(facteurEnCours, $('champ-mfa').value);
        facteurEnCours = null;
        form.reset();
        form.hidden = true;
        dire(msgMfa, 'Double authentification activée.', 'ok');
        afficherMfa();
    } catch (e) {
        dire(msgMfa, messageErreur(e), 'erreur');
    }
    bouton.disabled = false;
});
$('btn-mfa-desactiver')?.addEventListener('click', async (ev) => {
    const b = ev.currentTarget;
    b.disabled = true;
    dire(msgMfa, 'Désactivation…');
    try {
        await desactiverMfa(b.dataset.facteur);
        dire(msgMfa, 'Double authentification désactivée.', 'ok');
        afficherMfa();
    } catch (e) {
        dire(msgMfa, messageErreur(e), 'erreur');
    }
    b.disabled = false;
});

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
    afficherMfa();
    if (e.verification === 'echec')
        dire($('discord-msg'), 'Vérification Discord impossible pour le moment. Réessaie dans un instant.', 'erreur');
    else if (e.verification === 'ok') dire($('discord-msg'), 'Discord vérifié.', 'ok');
    if (params.get('paiement') === 'ok') suivrePaiement();
})();
