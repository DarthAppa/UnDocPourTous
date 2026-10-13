// Contrôle : chaque classe utilisée par les pages et les scripts a bien une règle CSS.
// Sert à vérifier que le Tailwind compilé (assets/css/tailwind.css) ne perd rien par rapport
// à l'ancien CDN, qui générait les classes à la volée en lisant le DOM.
// Usage : node tools/classes-tailwind.mjs              (analyse statique des fichiers)
//         node tools/classes-tailwind.mjs --navigateur (+ classes présentes dans le DOM après chargement, Chromium)
// Code 1 si une classe que Tailwind sait générer manque dans assets/css/tailwind.css.
import { readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const GENEREES = new Set(['pts-encyclopedie.html', 'pts-builder.html']);
const pages = readdirSync('.').filter((f) => f.endsWith('.html') && !GENEREES.has(f));
const scripts = readdirSync('.').filter((f) => f.endsWith('.js') && !f.endsWith('.config.js'));

// Classes définies par une feuille : tous les « .xxx » des sélecteurs (échappements Tailwind défaits)
function classesDefinies(css) {
    const sansCommentaires = css.replace(/\/\*[\s\S]*?\*\//g, '');
    const selecteurs = sansCommentaires.replace(/\{[^{}]*\}/g, '{}'); // garde les sélecteurs, pas les valeurs
    const ens = new Set();
    for (const m of selecteurs.matchAll(/\.((?:\\.|[\w-])+)/g)) ens.add(m[1].replace(/\\(.)/g, '$1'));
    return ens;
}
const tailwind = classesDefinies(readFileSync('assets/css/tailwind.css', 'utf8'));
const maison = classesDefinies(readFileSync('style.css', 'utf8'));

// 1. Classes trouvées dans les fichiers : attributs class="…" et appels classList / className des scripts
const utilisees = new Map(); // classe → fichier où elle apparaît
const noter = (c, f) => c && !utilisees.has(c) && utilisees.set(c, f);
for (const f of [...pages, ...scripts]) {
    const t = readFileSync(f, 'utf8');
    for (const m of t.matchAll(/\bclass(?:Name)?\s*=\s*(["'`])([^"'`]*)\1/g))
        for (const c of m[2].split(/\s+/)) if (!c.includes('${')) noter(c, f);
    for (const m of t.matchAll(/classList\.(?:add|remove|toggle|contains|replace)\(([^)]*)\)/g))
        for (const a of m[1].matchAll(/(["'])([^"']+)\1/g)) noter(a[2], f);
}

// 2. Option --navigateur : classes réellement présentes dans le DOM (y compris ajoutées par le JS)
if (process.argv.includes('--navigateur')) {
    const { chromium } = await import('playwright');
    const { demarrer } = await import('./serveur.mjs');
    const serveur = await demarrer();
    const nav = await chromium.launch();
    try {
        for (const p of pages) {
            const onglet = await nav.newPage({ viewport: { width: 1280, height: 900 } });
            await onglet.route(
                (u) => !u.href.startsWith(serveur.url),
                (r) => r.abort(),
            );
            await onglet.goto(serveur.url + p, { waitUntil: 'load' });
            await onglet.waitForTimeout(500);
            const dom = await onglet.evaluate(() => [
                ...new Set([...document.querySelectorAll('[class]')].flatMap((e) => [...e.classList])),
            ]);
            for (const c of dom) noter(c, `${p} (DOM)`);
            await onglet.close();
        }
    } finally {
        await nav.close();
        serveur.fermer();
    }
}

// 3. Classes sans règle : Tailwind sait-il les générer ? Si oui, elles manquent dans le CSS compilé.
const inconnues = [...utilisees.keys()].filter((c) => !tailwind.has(c) && !maison.has(c));
let manquantes = [];
if (inconnues.length) {
    const postcss = require('postcss');
    const tw = require('tailwindcss');
    const config = require('../tailwind.config.cjs');
    const r = await postcss([
        tw({ ...config, content: [{ raw: ['flex', ...inconnues].map((c) => `<i class="${c}"></i>`).join('\n') }] }),
    ]).process('@tailwind components; @tailwind utilities;', { from: undefined });
    const generees = classesDefinies(r.css);
    manquantes = inconnues.filter((c) => generees.has(c));
}
const sansCss = inconnues.filter((c) => !manquantes.includes(c));

console.log(
    `${utilisees.size} classes utilisées : ${[...utilisees.keys()].filter((c) => tailwind.has(c)).length} Tailwind, ` +
        `${[...utilisees.keys()].filter((c) => maison.has(c) && !tailwind.has(c)).length} maison (style.css).`,
);
if (sansCss.length)
    console.log(
        `Classes sans aucune règle (crochets JS ou repères, sans effet visuel avec le CDN non plus) :\n  ${sansCss.map((c) => `${c} [${utilisees.get(c)}]`).join('\n  ')}`,
    );
if (manquantes.length) {
    console.error(
        `✗ Classes Tailwind absentes de assets/css/tailwind.css (lancer npm run build:css, ou écrire la classe en entier dans le code) :\n  ${manquantes.map((c) => `${c} [${utilisees.get(c)}]`).join('\n  ')}`,
    );
    process.exit(1);
}
console.log('✓ Toutes les classes Tailwind utilisées sont dans le CSS compilé.');
