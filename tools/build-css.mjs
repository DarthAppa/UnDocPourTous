// Compile Tailwind : src/styles/tailwind.css → public/assets/css/tailwind.css (minifié).
// Fichier GÉNÉRÉ, non suivi par git : `npm run build` (et `npm run dev`) le refont à chaque fois,
// et GitHub Actions le refait avant chaque mise en ligne.
// Usage : npm run build:css
import { spawnSync } from 'node:child_process';
import { readFileSync, mkdirSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ENTREE = 'src/styles/tailwind.css';
const SORTIE = 'public/assets/css/tailwind.css';

mkdirSync(dirname(join(RACINE, SORTIE)), { recursive: true });
const cli = join(RACINE, 'node_modules', 'tailwindcss', 'lib', 'cli.js');
const r = spawnSync(process.execPath, [cli, '-c', 'tailwind.config.cjs', '-i', ENTREE, '-o', SORTIE, '--minify'], {
    cwd: RACINE,
    encoding: 'utf8',
});
if (r.status !== 0) {
    console.error(r.stderr || r.stdout);
    console.error('✗ Compilation Tailwind impossible (npm install fait ?)');
    process.exit(1);
}
const ko = Math.round(readFileSync(join(RACINE, SORTIE)).length / 102.4) / 10;
console.log(`${SORTIE} généré (${ko} Ko).`);
