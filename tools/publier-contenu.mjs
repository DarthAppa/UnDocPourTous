// Publie (ou met à jour) un contenu protégé dans la table Supabase « contenus ».
// Usage : node tools/publier-contenu.mjs <slug> <fichier.html|.json> "<titre>" <premium|pts>
//   ex. : node tools/publier-contenu.mjs guide-albion-tryhard contenus-prives/guide-albion-tryhard.html "Guide tryhard" premium
//
// Le fichier doit être dans contenus-prives/ (ignoré par git) : un contenu payant ne va JAMAIS
// dans le dépôt public. La clé SUPABASE_SERVICE_ROLE_KEY est lue dans .env et n'est jamais affichée.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, realpathSync, statSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { niveauValide, slugValide, titreValide } from '../supabase/functions/_shared/contenus.js';

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..');
const DOSSIER_PRIVE = join(RACINE, 'contenus-prives');
const URL_PAR_DEFAUT = 'https://wibfiqtuqfddijjlfscs.supabase.co';
const TAILLE_MAX = 2_000_000;

function stop(message) {
    console.error(`✗ ${message}`);
    process.exit(1);
}

// Lecture simple de .env (CLE=valeur, lignes # ignorées, guillemets retirés), sans dépendance.
function lireEnv() {
    const f = join(RACINE, '.env');
    const valeurs = {};
    if (!existsSync(f)) return valeurs;
    for (const ligne of readFileSync(f, 'utf8').split(/\r?\n/)) {
        const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(ligne);
        if (!m || ligne.trimStart().startsWith('#')) continue;
        valeurs[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
    }
    return valeurs;
}

const git = (...args) => {
    try {
        execFileSync('git', args, { cwd: RACINE, stdio: 'ignore' });
        return true;
    } catch {
        return false;
    }
};

const [slug, fichier, titre, niveau] = process.argv.slice(2);
if (process.argv.length !== 6)
    stop('usage : node tools/publier-contenu.mjs <slug> <fichier.html> "<titre>" <premium|pts>');
if (!slugValide(slug)) stop(`slug invalide « ${slug} » : minuscules, chiffres et tirets seulement (100 max)`);
if (!titreValide(titre)) stop('titre vide ou trop long (200 caractères max)');
if (!niveauValide(niveau)) stop(`niveau invalide « ${niveau} » : premium ou pts`);

// Le fichier doit exister, être un .html, et se trouver dans contenus-prives/.
if (!existsSync(fichier) || !statSync(fichier).isFile()) stop(`fichier introuvable : ${fichier}`);
// .html (guide Premium) ou .json (outil Pack ta Small préparé par npm run import:pts)
if (!/\.(html|json)$/i.test(fichier)) stop('le fichier doit être un .html ou un .json');
const chemin = realpathSync(fichier);
if (!existsSync(DOSSIER_PRIVE) || !chemin.startsWith(realpathSync(DOSSIER_PRIVE) + sep))
    stop('le fichier doit être dans le dossier contenus-prives/ (privé, ignoré par git)');
const relatif = relative(RACINE, chemin).split(sep).join('/');
if (git('ls-files', '--error-unmatch', '--', relatif))
    stop(`${relatif} est suivi par git : il serait public ! Le retirer (git rm --cached) avant de publier.`);
if (!git('check-ignore', '-q', '--', relatif))
    stop(`${relatif} n'est pas ignoré par git : ajouter « contenus-prives/ » dans .gitignore.`);

const html = readFileSync(chemin, 'utf8');
if (html.trim() === '') stop('le fichier est vide');
if (Buffer.byteLength(html) > TAILLE_MAX) stop('fichier trop gros (2 Mo max)');

const env = { ...lireEnv(), ...process.env };
const cle = env.SUPABASE_SERVICE_ROLE_KEY ?? '';
const url = (env.SUPABASE_URL || URL_PAR_DEFAUT).replace(/\/+$/, '');
if (!cle) stop('SUPABASE_SERVICE_ROLE_KEY manquante dans .env (voir .env.example)');
// Seulement un projet Supabase : la clé service_role ne doit jamais partir vers un autre hôte
if (!/^https:\/\/[a-z0-9]+\.supabase\.co$/.test(url)) stop('SUPABASE_URL invalide (https://<projet>.supabase.co)');

let reponse;
try {
    reponse = await fetch(`${url}/rest/v1/contenus?on_conflict=slug`, {
        method: 'POST',
        headers: {
            apikey: cle,
            Authorization: `Bearer ${cle}`,
            'Content-Type': 'application/json',
            Prefer: 'resolution=merge-duplicates,return=minimal',
        },
        body: JSON.stringify({ slug, titre: titre.trim(), niveau, html, maj_le: new Date().toISOString() }),
    });
} catch {
    stop('Supabase injoignable (connexion internet ?)');
}
if (!reponse.ok) {
    let detail = '';
    try {
        detail = String((await reponse.json()).message ?? '');
    } catch {
        // corps non JSON : on n'affiche que le code HTTP
    }
    stop(`refus de Supabase (HTTP ${reponse.status})${detail ? ` : ${detail.split(cle).join('***')}` : ''}`);
}
console.log(`✓ « ${titre.trim()} » publié (${niveau}) sous le slug ${slug}`);
