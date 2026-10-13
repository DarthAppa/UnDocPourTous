// Compile Tailwind (remplace le CDN cdn.tailwindcss.com) : assets/css/tailwind.src.css → assets/css/tailwind.css.
// La sortie minifiée est COMMITÉE : GitHub Pages ne lance aucun build.
// Usage : npm run build:css                 (régénère le fichier)
//         node tools/build-css.mjs --check  (code 1 si le fichier commité n'est pas à jour)
import { spawnSync } from 'node:child_process';
import { readFileSync, existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ENTREE = 'assets/css/tailwind.src.css';
const SORTIE = 'assets/css/tailwind.css';
const verifier = process.argv.includes('--check');

function compiler(cible) {
    const cli = join(RACINE, 'node_modules', 'tailwindcss', 'lib', 'cli.js');
    const r = spawnSync(process.execPath, [cli, '-c', 'tailwind.config.cjs', '-i', ENTREE, '-o', cible, '--minify'], {
        cwd: RACINE,
        encoding: 'utf8',
    });
    if (r.status !== 0) {
        console.error(r.stderr || r.stdout);
        console.error('✗ Compilation Tailwind impossible (npm install fait ?)');
        process.exit(1);
    }
}

if (!verifier) {
    compiler(join(RACINE, SORTIE));
    const ko = Math.round(readFileSync(join(RACINE, SORTIE)).length / 102.4) / 10;
    console.log(`${SORTIE} régénéré (${ko} Ko). Penser à le committer.`);
    process.exit(0);
}

// --check : compilation dans un dossier temporaire puis comparaison octet par octet
const dossier = mkdtempSync(join(tmpdir(), 'udpt-css-'));
try {
    const temp = join(dossier, 'tailwind.css');
    compiler(temp);
    const attendu = readFileSync(temp, 'utf8');
    const actuel = existsSync(join(RACINE, SORTIE)) ? readFileSync(join(RACINE, SORTIE), 'utf8') : '';
    if (attendu !== actuel) {
        console.error(`✗ ${SORTIE} n'est pas à jour : lancer \`npm run build:css\` puis committer le fichier.`);
        process.exit(1);
    }
    console.log(`✓ ${SORTIE} à jour.`);
} finally {
    rmSync(dossier, { recursive: true, force: true });
}
