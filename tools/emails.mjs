// E-mails envoyés par Supabase Auth (confirmation, mot de passe oublié, changement d'e-mail, lien de connexion),
// en français ou en anglais selon la langue du navigateur à l'inscription (`langue` dans user_metadata,
// écrite par auth-modal.js : « fr » pour tout navigateur francophone, sinon « en »). Sans langue connue : français.
//
// Usage : npm run emails                aperçus HTML (fr et en) dans shots/emails/ pour les relire
//         npm run emails -- --publier   envoie sujets + modèles à Supabase (API Management,
//                                        SUPABASE_ACCESS_TOKEN dans .env, jamais commité)
//
// Les modèles sont des templates Go (moteur de Supabase Auth) : {{ .ConfirmationURL }}, {{ .Email }},
// {{ .NewEmail }}, {{ .Data.<clé> }}. La langue est testée avec printf "%v" pour ne jamais planter
// quand la clé est absente (comparer une valeur absente avec eq ferait échouer l'envoi).
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PROJET = 'wibfiqtuqfddijjlfscs';
const SITE = 'https://undocpourtous.com';
const LOGO = `${SITE}/assets/img/marque/logo.png`;
const SI_ANGLAIS = '{{ if eq (printf "%v" .Data.langue) "en" }}';

// Couleurs du site (tailwind.config.cjs) : les clients mail ne lisent pas les variables CSS
const C = {
    fond: '#0B0F17',
    carte: '#141B26',
    bord: '#293340',
    texte: '#F5F5F0',
    doux: '#9BA7B6',
    pale: '#7C8A9C',
    menthe: '#72E5BB',
};

// Contenu de chaque e-mail. `lien` = variable Go du bouton ; `extra` = paragraphe optionnel.
export const EMAILS = {
    confirmation: {
        fr: {
            sujet: 'Confirme ton adresse e-mail',
            titre: 'Bienvenue sur UnDocPourTous',
            texte: 'Il reste une étape : confirme ton adresse e-mail pour activer ton compte.',
            bouton: 'Confirmer mon adresse',
            fin: 'Tu n’as pas créé de compte ? Ignore simplement cet e-mail.',
        },
        en: {
            sujet: 'Confirm your email address',
            titre: 'Welcome to UnDocPourTous',
            texte: 'One last step: confirm your email address to activate your account.',
            bouton: 'Confirm my email',
            fin: 'Didn’t sign up? You can safely ignore this email.',
        },
        lien: '{{ .ConfirmationURL }}',
    },
    recovery: {
        fr: {
            sujet: 'Réinitialise ton mot de passe',
            titre: 'Mot de passe oublié ?',
            texte: 'Clique sur le bouton pour choisir un nouveau mot de passe. Le lien n’est valable qu’une heure et une seule fois.',
            bouton: 'Choisir un nouveau mot de passe',
            fin: 'Tu n’as rien demandé ? Ignore cet e-mail : ton mot de passe reste inchangé.',
        },
        en: {
            sujet: 'Reset your password',
            titre: 'Forgot your password?',
            texte: 'Click the button to choose a new password. The link works only once and expires in one hour.',
            bouton: 'Choose a new password',
            fin: 'Didn’t ask for this? Ignore this email: your password stays the same.',
        },
        lien: '{{ .ConfirmationURL }}',
    },
    email_change: {
        fr: {
            sujet: 'Confirme ta nouvelle adresse e-mail',
            titre: 'Changement d’adresse e-mail',
            texte: 'Confirme le passage de {{ .Email }} à {{ .NewEmail }} pour ton compte UnDocPourTous.',
            bouton: 'Confirmer le changement',
            fin: 'Tu n’as pas demandé ce changement ? Ne clique pas et change ton mot de passe.',
        },
        en: {
            sujet: 'Confirm your new email address',
            titre: 'Email address change',
            texte: 'Confirm the change from {{ .Email }} to {{ .NewEmail }} for your UnDocPourTous account.',
            bouton: 'Confirm the change',
            fin: 'Didn’t ask for this? Don’t click, and change your password.',
        },
        lien: '{{ .ConfirmationURL }}',
    },
    magic_link: {
        fr: {
            sujet: 'Ton lien de connexion',
            titre: 'Connexion à UnDocPourTous',
            texte: 'Clique sur le bouton pour te connecter. Le lien n’est valable qu’une fois.',
            bouton: 'Me connecter',
            fin: 'Tu n’as rien demandé ? Ignore simplement cet e-mail.',
        },
        en: {
            sujet: 'Your sign-in link',
            titre: 'Sign in to UnDocPourTous',
            texte: 'Click the button to sign in. The link works only once.',
            bouton: 'Sign in',
            fin: 'Didn’t ask for this? You can safely ignore this email.',
        },
        lien: '{{ .ConfirmationURL }}',
    },
};

const PIED = {
    fr: 'UnDocPourTous · Outils pour joueurs · Non affilié aux éditeurs des jeux cités.',
    en: 'UnDocPourTous · Tools for players · Not affiliated with the publishers of the games mentioned.',
};
const SECOURS = {
    fr: 'Le bouton ne marche pas ? Copie ce lien dans ton navigateur :',
    en: 'Button not working? Paste this link into your browser:',
};

// Corps d'un e-mail dans une langue (HTML en tableaux + styles en ligne : compatible Gmail, Outlook, mobiles)
function corps(t, lien, langue) {
    const police = 'Arial,Helvetica,sans-serif';
    return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.fond};padding:32px 12px;font-family:${police};">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:${C.carte};border:1px solid ${C.bord};border-radius:16px;">
<tr><td style="padding:28px 28px 8px;">
<img src="${LOGO}" width="44" height="41" alt="" style="display:inline-block;vertical-align:middle;border:0;">
<span style="display:inline-block;vertical-align:middle;margin-left:10px;font-size:17px;font-weight:bold;color:${C.texte};">UnDocPourTous</span>
</td></tr>
<tr><td style="padding:16px 28px 0;">
<h1 style="margin:0 0 12px;font-family:Georgia,'Times New Roman',serif;font-size:24px;line-height:1.3;color:${C.texte};">${t.titre}</h1>
<p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:${C.doux};">${t.texte}</p>
<table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="border-radius:10px;background:${C.menthe};">
<a href="${lien}" style="display:inline-block;padding:13px 24px;font-size:15px;font-weight:bold;color:${C.fond};text-decoration:none;border-radius:10px;">${t.bouton}</a>
</td></tr></table>
<p style="margin:24px 0 6px;font-size:12px;line-height:1.5;color:${C.pale};">${SECOURS[langue]}</p>
<p style="margin:0 0 20px;font-size:12px;line-height:1.5;word-break:break-all;"><a href="${lien}" style="color:${C.menthe};">${lien}</a></p>
<p style="margin:0 0 28px;font-size:13px;line-height:1.6;color:${C.doux};">${t.fin}</p>
</td></tr>
<tr><td style="padding:16px 28px;border-top:1px solid ${C.bord};font-size:11px;line-height:1.5;color:${C.pale};">${PIED[langue]}</td></tr>
</table>
</td></tr>
</table>`;
}

// Document complet : fond sombre sur toute la hauteur (sinon blanc sous la carte dans certains clients)
const document = (contenu, langue) =>
    `<!doctype html><html lang="${langue}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="dark"></head><body style="margin:0;padding:0;background:${C.fond};">${contenu}</body></html>`;

export function modele(nom) {
    const e = EMAILS[nom];
    return {
        sujet: `${SI_ANGLAIS}${e.en.sujet}{{ else }}${e.fr.sujet}{{ end }}`,
        html: `${SI_ANGLAIS}\n${document(corps(e.en, e.lien, 'en'), 'en')}\n{{ else }}\n${document(corps(e.fr, e.lien, 'fr'), 'fr')}\n{{ end }}\n`,
    };
}

// Aperçu : remplace les variables Go par des exemples (pour relire dans un navigateur)
function apercu(nom, langue) {
    const e = EMAILS[nom];
    return corps(e[langue], 'https://undocpourtous.com/?code=exemple', langue)
        .replaceAll('{{ .ConfirmationURL }}', 'https://undocpourtous.com/?code=exemple')
        .replaceAll('{{ .Email }}', 'ancienne@exemple.fr')
        .replaceAll('{{ .NewEmail }}', 'nouvelle@exemple.fr');
}

function lireJeton() {
    for (const f of ['.env', '../UnDocPourTous/.env', '../UnDocPourTous-comptes/.env']) {
        const p = join(RACINE, f);
        if (!existsSync(p)) continue;
        const m = readFileSync(p, 'utf8').match(/^SUPABASE_ACCESS_TOKEN=(.+)$/m);
        if (m) return m[1].trim().replace(/^"|"$/g, '');
    }
    throw new Error('SUPABASE_ACCESS_TOKEN introuvable dans .env');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    if (process.argv.includes('--publier')) {
        const corpsRequete = {};
        for (const nom of Object.keys(EMAILS)) {
            const m = modele(nom);
            corpsRequete[`mailer_subjects_${nom}`] = m.sujet;
            corpsRequete[`mailer_templates_${nom}_content`] = m.html;
        }
        const r = await fetch(`https://api.supabase.com/v1/projects/${PROJET}/config/auth`, {
            method: 'PATCH',
            headers: { Authorization: `Bearer ${lireJeton()}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(corpsRequete),
        });
        if (!r.ok) {
            console.error(`✗ Supabase a refusé (${r.status}) : ${await r.text()}`);
            process.exit(1);
        }
        console.log(`✓ ${Object.keys(EMAILS).length} modèles d'e-mails publiés (fr + en) dans Supabase.`);
    } else {
        const dossier = join(RACINE, 'shots', 'emails');
        mkdirSync(dossier, { recursive: true });
        for (const nom of Object.keys(EMAILS))
            for (const langue of ['fr', 'en'])
                writeFileSync(
                    join(dossier, `${nom}-${langue}.html`),
                    document(apercu(nom, langue), langue).replace(
                        '<head>',
                        `<head><title>${EMAILS[nom][langue].sujet}</title>`,
                    ),
                );
        console.log(`Aperçus écrits dans shots/emails/ (${Object.keys(EMAILS).length * 2} fichiers).`);
    }
}
