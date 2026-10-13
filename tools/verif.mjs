// Vérification complète avant push / pull request.
// Usage : npm run verif            (tout, y compris captures desktop + mobile de chaque page)
//         npm run verif -- --rapide (sans les captures)
// Code de sortie 1 si une étape échoue : le push / la PR sont alors bloqués.
import { spawnSync } from 'node:child_process';
import { readdirSync, existsSync, readFileSync } from 'node:fs';

const rapide = process.argv.includes('--rapide');
const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
const GENEREES = ['pts-encyclopedie.html', 'pts-builder.html'];
const pages = readdirSync('.').filter((f) => f.endsWith('.html'));
const pagesSources = pages.filter((f) => !GENEREES.includes(f));

const etapes = [
    ['Formatage (Prettier)', 'npx --no-install prettier --check . --log-level warn'],
    ['JavaScript (ESLint)', 'npx --no-install eslint . --max-warnings 0'],
    ['CSS (Stylelint)', 'npx --no-install stylelint "**/*.css"'],
    ['HTML (html-validate)', `npx --no-install html-validate ${pagesSources.join(' ')}`],
    ['Règles maison (CLAUDE.md)', 'node tools/regles.mjs'],
];
if (pkg.scripts?.['test:pts'] && existsSync('tools/test-pts-verrou.mjs')) etapes.push(['Tests verrou PTS', 'npm run test:pts']);
if (!rapide) for (const p of pages) etapes.push([`Rendu ${p} (390px + 1280px)`, `node tools/screenshot.mjs ${p}`]);

const resultats = [];
for (const [nom, cmd] of etapes) {
    console.log(`\n━━ ${nom}\n$ ${cmd}`);
    const debut = Date.now();
    const r = spawnSync(cmd, { shell: true, stdio: 'inherit' });
    resultats.push({ nom, ok: r.status === 0, s: ((Date.now() - debut) / 1000).toFixed(1) });
}

console.log('\n━━━━━━━━━━━━ Bilan ━━━━━━━━━━━━');
for (const r of resultats) console.log(`${r.ok ? '✓' : '✗'} ${r.nom} (${r.s}s)`);
const echecs = resultats.filter((r) => !r.ok);
if (echecs.length) {
    console.log(`\n${echecs.length} étape(s) en échec : corriger avant le push / la pull request.`);
    console.log('Astuce : `npm run format` corrige le formatage, `npm run lint:fix` une partie du JS/CSS.');
    process.exit(1);
}
console.log(`\nTout est vert${rapide ? ' (sans captures)' : ''} : prêt pour la pull request.`);
