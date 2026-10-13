// Vérification complète avant push / pull request.
// Usage : npm run verif            (tout, y compris captures desktop + mobile de chaque page)
//         npm run verif -- --rapide (sans les captures)
// Code de sortie 1 si une étape échoue : le push / la PR sont alors bloqués.
import { spawnSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';

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
    ['CSS Tailwind à jour', 'node tools/build-css.mjs --check'],
    ['Classes Tailwind présentes', 'node tools/classes-tailwind.mjs'],
    ['CSP à jour', 'node tools/csp.mjs --check'],
];
for (const [script, nom] of [
    ['test:fonctions', 'Tests logique des Edge Functions'],
    ['test:pts', 'Tests verrou PTS'],
    ['test:profil', 'Tests page Mon profil'],
    ['test:premium', 'Tests contenu Premium et paiement'],
])
    if (pkg.scripts?.[script]) etapes.push([nom, `npm run ${script}`]);
// Règles RLS : besoin d'un Postgres (DATABASE_URL). Toujours lancé en CI ; en local seulement si défini.
if (process.env.DATABASE_URL) etapes.push(['Tests règles RLS (Postgres)', 'npm run test:rls']);
else console.log('ℹ Tests RLS ignorés en local (DATABASE_URL absent) : ils tournent dans GitHub Actions.');
// Dépendances : bloque sur une faille critique. Les outils de build (Tailwind 3 → braces) ont des
// alertes « high » sans correctif qui ne concernent que la compilation sur le PC, pas le site publié.
etapes.push(['Audit des dépendances (npm audit)', 'npm audit --audit-level=critical']);
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
