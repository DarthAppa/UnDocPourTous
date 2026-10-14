// Site en direct pour travailler : Tailwind en mode « watch » + serveur Astro (rechargement automatique).
// Usage : npm run dev   (Ctrl+C pour arrêter les deux)
import { spawn } from 'node:child_process';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const cli = join(RACINE, 'node_modules', 'tailwindcss', 'lib', 'cli.js');
const tailwind = spawn(
    process.execPath,
    [
        cli,
        '-c',
        'tailwind.config.cjs',
        '-i',
        'src/styles/tailwind.css',
        '-o',
        'public/assets/css/tailwind.css',
        '--watch',
    ],
    { cwd: RACINE, stdio: ['pipe', 'inherit', 'inherit'] }, // stdin ouvert : sinon --watch s'arrête aussitôt
);
const astro = spawn(
    process.execPath,
    [join(RACINE, 'node_modules', 'astro', 'bin', 'astro.mjs'), 'dev', ...process.argv.slice(2)],
    {
        cwd: RACINE,
        stdio: 'inherit',
    },
);

const arreter = () => {
    tailwind.kill();
    astro.kill();
};
process.on('SIGINT', arreter);
process.on('SIGTERM', arreter);
astro.on('exit', (code) => {
    tailwind.kill();
    process.exit(code ?? 0);
});
