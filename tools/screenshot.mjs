// Captures desktop + mobile de la page, avec rapport d'erreurs.
// Usage : node tools/screenshot.mjs [page.html]   (défaut : index.html)
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const page = process.argv[2] || 'index.html';
const url = pathToFileURL(resolve(page)).href;
const sizes = [
    { name: 'desktop', width: 1280, height: 900 },
    { name: 'mobile', width: 390, height: 844 },
];

mkdirSync('shots', { recursive: true });
const browser = await chromium.launch();
let problems = 0;

for (const s of sizes) {
    const p = await browser.newPage({ viewport: { width: s.width, height: s.height } });
    const errors = [];
    p.on('console', m => m.type() === 'error' && errors.push(m.text()));
    p.on('pageerror', e => errors.push(e.message));
    p.on('requestfailed', r => errors.push(`Ressource introuvable : ${r.url()}`));

    await p.goto(url, { waitUntil: 'networkidle' });
    // Affiche les blocs .reveal pour la capture pleine page
    await p.evaluate(() => document.querySelectorAll('.reveal').forEach(e => e.classList.add('visible')));
    await p.waitForTimeout(800);

    const scrollW = await p.evaluate(() => document.documentElement.scrollWidth);
    const file = `shots/${s.name}.png`;
    await p.screenshot({ path: file, fullPage: true });

    console.log(`\n[${s.name} ${s.width}px] -> ${file}`);
    if (scrollW > s.width) { console.log(`  ⚠ Débordement horizontal : ${scrollW}px > ${s.width}px`); problems++; }
    errors.forEach(e => { console.log(`  ⚠ ${e}`); problems++; });
    if (scrollW <= s.width && !errors.length) console.log('  OK');
    await p.close();
}

await browser.close();
console.log(problems ? `\n${problems} problème(s) à corriger.` : '\nAucun problème détecté.');
process.exit(problems ? 1 : 0);
