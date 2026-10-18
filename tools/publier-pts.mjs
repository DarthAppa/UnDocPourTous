// Publie dans Supabase (table contenus, niveau pts) le contenu réservé des outils Pack ta Small,
// préparé par npm run import:pts dans contenus-prives/pts/ (ignoré par git).
// Usage : npm run publier:pts   — à lancer après chaque import, AVANT de fusionner la pull request.
//
// Chaque partie passe par tools/publier-contenu.mjs (mêmes contrôles : fichier privé, non suivi par git…).
// Clé : SUPABASE_SERVICE_ROLE_KEY du .env ; à défaut, lue avec SUPABASE_ACCESS_TOKEN (API de gestion
// Supabase) et gardée en mémoire le temps de la publication : jamais écrite, jamais affichée.
// Les anciennes versions restent dans la table (la page en ligne peut encore s'en servir) : voir LISEZMOI.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..');
const PRIVE = join(RACINE, 'contenus-prives', 'pts');
const PROJET = 'wibfiqtuqfddijjlfscs';

function stop(message) {
    console.error(`✗ ${message}`);
    process.exit(1);
}

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

async function cleServiceRole(jeton) {
    let r;
    try {
        r = await fetch(`https://api.supabase.com/v1/projects/${PROJET}/api-keys?reveal=true`, {
            headers: { Authorization: `Bearer ${jeton}` },
        });
    } catch {
        stop('API Supabase injoignable (connexion internet ?)');
    }
    if (!r.ok) stop(`lecture de la clé refusée par Supabase (HTTP ${r.status}) : vérifier SUPABASE_ACCESS_TOKEN`);
    const cles = await r.json();
    const cle = Array.isArray(cles) ? cles.find((c) => c.name === 'service_role')?.api_key : null;
    if (!cle || !cle.startsWith('eyJ')) stop('clé service_role introuvable dans le projet Supabase');
    return cle;
}

const fichierManifeste = join(PRIVE, 'manifeste.json');
if (!existsSync(fichierManifeste))
    stop('contenus-prives/pts/manifeste.json absent : lancer d’abord npm run import:pts');
const manifeste = JSON.parse(readFileSync(fichierManifeste, 'utf8'));
if (!Array.isArray(manifeste) || !manifeste.length) stop('manifeste vide');

const env = { ...lireEnv(), ...process.env };
let cle = env.SUPABASE_SERVICE_ROLE_KEY || '';
if (!cle) {
    if (!env.SUPABASE_ACCESS_TOKEN) stop('ni SUPABASE_SERVICE_ROLE_KEY ni SUPABASE_ACCESS_TOKEN dans .env');
    cle = await cleServiceRole(env.SUPABASE_ACCESS_TOKEN);
}

for (const { slug, fichier, titre } of manifeste) {
    if (!/^pts-[a-z0-9-]+$/.test(slug) || !/^[a-z0-9-]+\.json$/.test(fichier)) stop(`entrée invalide : ${slug}`);
    try {
        execFileSync(
            process.execPath,
            [join(RACINE, 'tools', 'publier-contenu.mjs'), slug, join(PRIVE, fichier), titre, 'pts'],
            { cwd: RACINE, stdio: 'inherit', env: { ...process.env, SUPABASE_SERVICE_ROLE_KEY: cle } },
        );
    } catch {
        stop(`publication de ${slug} interrompue`);
    }
}
console.log(`\n✓ ${manifeste.length} partie(s) publiée(s). La pull request peut être fusionnée.`);
