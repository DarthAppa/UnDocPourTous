// Fenêtre de connexion / inscription (bouton « Connexion » de l'en-tête).
// - Deux onglets : Connexion et S'inscrire (e-mail + mot de passe) et des boutons de connexion rapide.
// - Même compte Supabase que les outils Pack ta Small. Discord passe par le flux PTS (vérification du serveur).
// - Sans JS, le bouton garde son lien vers connexion-pts.html.
import { PTS_CONFIG as C } from './pts-config.js';
import { getClient, configure, connexion as connexionDiscord, deconnexion } from './pts-auth.js';

const FOURNISSEURS = [
    {
        id: 'google',
        nom: 'Google',
        icone: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.46a5.52 5.52 0 0 1-2.4 3.62v3h3.88c2.27-2.09 3.58-5.17 3.58-8.81z"/><path fill="#34A853" d="M12 24c3.24 0 5.96-1.07 7.94-2.91l-3.88-3c-1.07.72-2.45 1.15-4.06 1.15-3.12 0-5.77-2.11-6.71-4.94H1.27v3.1A12 12 0 0 0 12 24z"/><path fill="#FBBC05" d="M5.29 14.3A7.2 7.2 0 0 1 4.91 12c0-.8.14-1.57.38-2.3v-3.1H1.27A12 12 0 0 0 0 12c0 1.94.46 3.77 1.27 5.4l4.02-3.1z"/><path fill="#EA4335" d="M12 4.77c1.76 0 3.34.61 4.58 1.8l3.43-3.43C17.95 1.19 15.24 0 12 0A12 12 0 0 0 1.27 6.6l4.02 3.1C6.23 6.88 8.88 4.77 12 4.77z"/></svg>',
    },
    {
        id: 'discord',
        nom: 'Discord',
        icone: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="#5865F2"><path d="M20.317 4.369A19.79 19.79 0 0 0 15.885 3c-.191.328-.403.77-.552 1.121a18.4 18.4 0 0 0-5.487 0A12.6 12.6 0 0 0 9.29 3a19.74 19.74 0 0 0-4.433 1.37C2.056 8.55 1.296 12.63 1.676 16.652a19.9 19.9 0 0 0 5.993 3.03 14.5 14.5 0 0 0 1.284-2.087 12.9 12.9 0 0 1-2.02-.97c.169-.124.334-.254.493-.388 3.9 1.8 8.13 1.8 11.985 0 .16.134.325.264.494.388-.646.385-1.32.71-2.022.97.37.73.8 1.43 1.284 2.087a19.84 19.84 0 0 0 5.994-3.03c.446-4.66-.762-8.704-3.347-12.283zM8.52 14.18c-1.183 0-2.157-1.085-2.157-2.42 0-1.333.955-2.418 2.157-2.418 1.21 0 2.176 1.095 2.157 2.418 0 1.335-.955 2.42-2.157 2.42zm7.975 0c-1.183 0-2.157-1.085-2.157-2.42 0-1.333.955-2.418 2.157-2.418 1.21 0 2.176 1.095 2.157 2.418 0 1.335-.946 2.42-2.157 2.42z"/></svg>',
    },
    {
        id: 'twitch',
        nom: 'Twitch',
        icone: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="#9146FF"><path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0 1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z"/></svg>',
    },
];
const ACTIFS = C.FOURNISSEURS || ['discord'];

const MESSAGES = {
    'Invalid login credentials': 'E-mail ou mot de passe incorrect.',
    'Email not confirmed': 'Confirme d’abord ton e-mail : un lien t’a été envoyé.',
    'User already registered': 'Un compte existe déjà avec cet e-mail.',
    over_email_send_rate_limit: 'Trop de demandes d’e-mails. Réessaie dans quelques minutes.',
    weak_password: 'Mot de passe trop faible (8 caractères minimum).',
};
const traduire = (e) =>
    MESSAGES[e?.code] || MESSAGES[e?.message] || 'Une erreur est survenue. Réessaie dans un instant.';

const html = `
<div class="auth-card">
    <button type="button" class="auth-close" aria-label="Fermer" data-fermer>&times;</button>
    <h2 id="auth-titre" class="auth-titre">Rejoins UnDocPourTous</h2>
    <p class="auth-sous">Un seul compte pour tous les outils.</p>

    <div class="auth-vue" data-vue="formulaires">
        <div class="auth-tabs" role="tablist" aria-label="Connexion ou inscription">
            <button type="button" role="tab" id="auth-t-connexion" aria-controls="auth-p-connexion" aria-selected="true" data-onglet="connexion">Connexion</button>
            <button type="button" role="tab" id="auth-t-inscription" aria-controls="auth-p-inscription" aria-selected="false" tabindex="-1" data-onglet="inscription">S’inscrire</button>
        </div>

        <div class="auth-sociaux">
            ${FOURNISSEURS.map((f) => {
                const actif = ACTIFS.includes(f.id);
                return `<button type="button" class="auth-social" data-fournisseur="${f.id}"${actif ? '' : ' disabled aria-disabled="true"'}>${f.icone}<span>${f.nom}</span>${actif ? '' : '<small>Bientôt</small>'}</button>`;
            }).join('')}
        </div>
        <p class="auth-ou"><span>ou avec ton e-mail</span></p>

        <form id="auth-p-connexion" role="tabpanel" aria-labelledby="auth-t-connexion" data-form="connexion" novalidate>
            <label class="auth-champ"><span>E-mail</span><input type="email" name="email" autocomplete="email" required></label>
            <label class="auth-champ"><span>Mot de passe</span><input type="password" name="mdp" autocomplete="current-password" required></label>
            <button type="button" class="auth-lien" data-oublie>Mot de passe oublié ?</button>
            <button type="submit" class="btn-mint auth-valider">Se connecter</button>
        </form>

        <form id="auth-p-inscription" role="tabpanel" aria-labelledby="auth-t-inscription" data-form="inscription" hidden novalidate>
            <label class="auth-champ"><span>Pseudo</span><input type="text" name="pseudo" autocomplete="nickname" maxlength="32" required></label>
            <label class="auth-champ"><span>E-mail</span><input type="email" name="email" autocomplete="email" required></label>
            <label class="auth-champ"><span>Mot de passe <small>(8 caractères minimum)</small></span><input type="password" name="mdp" autocomplete="new-password" minlength="8" required></label>
            <label class="auth-case"><input type="checkbox" name="cgu" required><span>J’accepte les conditions d’utilisation et la politique de confidentialité.</span></label>
            <button type="submit" class="btn-mint auth-valider">Créer mon compte</button>
        </form>
    </div>

    <div class="auth-vue" data-vue="connecte" hidden>
        <p class="auth-etat">Connecté en tant que <strong data-pseudo></strong>.</p>
        <button type="button" class="btn-mint auth-valider" data-deconnexion>Se déconnecter</button>
    </div>

    <p class="auth-msg" role="status" aria-live="polite" data-msg></p>
</div>`;

let dialogue = null;
let declencheur = null;

function construire() {
    dialogue = document.createElement('dialog');
    dialogue.className = 'auth-modal';
    dialogue.setAttribute('aria-labelledby', 'auth-titre');
    dialogue.innerHTML = html;
    document.body.appendChild(dialogue);

    const msg = (t, erreur = false) => {
        const m = dialogue.querySelector('[data-msg]');
        m.textContent = t;
        m.dataset.erreur = erreur ? '1' : '';
    };
    const occupe = (form, etat) =>
        form.querySelectorAll('button, input').forEach((e) => {
            e.disabled = etat;
        });

    // Fermeture : bouton, clic sur le fond, Échap (natif)
    dialogue.addEventListener('click', (e) => {
        if (e.target === dialogue || e.target.closest('[data-fermer]')) dialogue.close();
    });
    dialogue.addEventListener('close', () => {
        declencheur?.focus();
        msg('');
    });

    // Onglets (flèches gauche/droite)
    const onglets = [...dialogue.querySelectorAll('[role="tab"]')];
    const choisir = (nom, focus = false) => {
        onglets.forEach((t) => {
            const actif = t.dataset.onglet === nom;
            t.setAttribute('aria-selected', String(actif));
            t.tabIndex = actif ? 0 : -1;
            document.getElementById(t.getAttribute('aria-controls')).hidden = !actif;
            if (actif && focus) t.focus();
        });
        msg('');
    };
    onglets.forEach((t, i) => {
        t.addEventListener('click', () => choisir(t.dataset.onglet));
        t.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
                e.preventDefault();
                choisir(
                    onglets[(i + (e.key === 'ArrowRight' ? 1 : onglets.length - 1)) % onglets.length].dataset.onglet,
                    true,
                );
            }
        });
    });
    dialogue.choisir = choisir;

    // Connexion rapide
    dialogue.querySelectorAll('[data-fournisseur]').forEach((b) =>
        b.addEventListener('click', async () => {
            if (!configure) {
                msg('La connexion n’est pas encore activée sur le site.', true);
                return;
            }
            const id = b.dataset.fournisseur;
            msg('Redirection…');
            try {
                if (id === 'discord') {
                    const page = location.pathname.split('/').pop() || 'index.html';
                    await connexionDiscord(/^[a-z0-9-]+\.html$/.test(page) ? page : 'index.html');
                } else {
                    const sb = await getClient();
                    const { error } = await sb.auth.signInWithOAuth({
                        provider: id,
                        options: { redirectTo: location.href },
                    });
                    if (error) throw error;
                }
            } catch {
                msg('Cette connexion n’a pas pu démarrer. Réessaie dans un instant.', true);
            }
        }),
    );

    // Formulaires e-mail
    dialogue.querySelectorAll('form').forEach((form) =>
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!configure) {
                msg('La connexion n’est pas encore activée sur le site.', true);
                return;
            }
            if (!form.checkValidity()) {
                form.reportValidity();
                return;
            }
            const d = Object.fromEntries(new FormData(form));
            occupe(form, true);
            try {
                const sb = await getClient();
                if (form.dataset.form === 'connexion') {
                    const { error } = await sb.auth.signInWithPassword({ email: d.email, password: d.mdp });
                    if (error) throw error;
                    await afficher();
                    msg('Connexion réussie.');
                } else {
                    const { data, error } = await sb.auth.signUp({
                        email: d.email,
                        password: d.mdp,
                        options: { data: { name: d.pseudo }, emailRedirectTo: location.href },
                    });
                    if (error) throw error;
                    if (data.user && data.user.identities && data.user.identities.length === 0)
                        throw { code: '', message: 'User already registered' };
                    if (data.session) {
                        await afficher();
                        msg('Compte créé. Bienvenue !');
                    } else msg('Compte créé. Vérifie ta boîte mail pour confirmer ton adresse.');
                }
            } catch (err) {
                msg(traduire(err), true);
            }
            occupe(form, false);
        }),
    );

    dialogue.querySelector('[data-oublie]').addEventListener('click', async () => {
        const email = dialogue.querySelector('[data-form="connexion"] [name="email"]').value.trim();
        if (!email) {
            msg('Saisis ton e-mail, puis clique sur « Mot de passe oublié ».', true);
            return;
        }
        try {
            const sb = await getClient();
            const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: location.href });
            if (error) throw error;
            msg('Si un compte existe, un e-mail de réinitialisation vient d’être envoyé.');
        } catch (err) {
            msg(traduire(err), true);
        }
    });

    dialogue.querySelector('[data-deconnexion]').addEventListener('click', async () => {
        await deconnexion();
        await afficher();
        msg('Tu es déconnecté.');
    });
}

// Affiche soit les formulaires, soit l'état « connecté »
async function afficher() {
    const form = dialogue.querySelector('[data-vue="formulaires"]');
    const connecte = dialogue.querySelector('[data-vue="connecte"]');
    let session = null;
    if (configure) {
        try {
            session = (await (await getClient()).auth.getSession()).data.session;
        } catch {
            /* réseau */
        }
    }
    form.hidden = !!session;
    connecte.hidden = !session;
    if (session) {
        const m = session.user.user_metadata || {};
        connecte.querySelector('[data-pseudo]').textContent =
            m.name || m.full_name || m.user_name || session.user.email || 'joueur';
    }
}

async function ouvrir(declencheurClic) {
    if (!dialogue) construire();
    declencheur = declencheurClic;
    dialogue.querySelector('[data-msg]').textContent = '';
    dialogue.showModal();
    await afficher();
}

document.querySelectorAll('.btn-login').forEach((b) =>
    b.addEventListener('click', (e) => {
        e.preventDefault();
        ouvrir(b);
    }),
);
