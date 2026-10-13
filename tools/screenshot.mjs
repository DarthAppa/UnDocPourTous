// Captures desktop + mobile de la page, avec rapport d'erreurs.
// Usage : node tools/screenshot.mjs [page.html]   (défaut : index.html)
// HORS_LIGNE=1 : les ressources externes (CDN, Google Fonts) sont bloquées et leurs échecs ignorés.
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { demarrer } from './serveur.mjs';

const page = process.argv[2] || 'index.html';
const horsLigne = process.env.HORS_LIGNE === '1';
const sizes = [
    { name: 'desktop', width: 1280, height: 900 },
    { name: 'mobile', width: 390, height: 844 },
];

mkdirSync('shots', { recursive: true });
const serveur = await demarrer(); // http:// local : nécessaire pour les modules JS (pages Pack ta Small)
const url = serveur.url + page;
const local = (u) => u.startsWith(serveur.url);
let browser;
let problems = 0;

try {
    browser = await chromium.launch();
    for (const s of sizes) {
        const p = await browser.newPage({ viewport: { width: s.width, height: s.height } });
        p.setDefaultTimeout(15000);
        if (horsLigne)
            await p.route(
                (u) => !local(u.href),
                (r) => r.abort(),
            );
        const errors = [];
        const avertissements = [];
        p.on('console', (m) => {
            if (m.type() !== 'error') return;
            if (m.text().startsWith('Failed to load resource')) return; // déjà signalé avec l'URL ci-dessous
            errors.push(m.text());
        });
        p.on('pageerror', (e) => errors.push(e.message));
        p.on('response', (r) => {
            if (r.status() >= 400 && local(r.url())) errors.push(`Ressource introuvable (${r.status()}) : ${r.url()}`);
        });
        p.on('requestfailed', (r) => {
            const msg = `Échec réseau (${r.failure()?.errorText}) : ${r.url()}`;
            (local(r.url()) ? errors : avertissements).push(msg); // CDN externe : avertissement seulement
        });

        await p.goto(url, { waitUntil: 'load' });
        await p.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {}); // pas bloquant si un CDN traîne
        // Affiche les blocs .reveal pour la capture pleine page
        await p.evaluate(() => document.querySelectorAll('.reveal').forEach((e) => e.classList.add('visible')));
        await p.waitForTimeout(800);

        const scrollW = await p.evaluate(() => document.documentElement.scrollWidth);
        const file = `shots/${page.replace(/\.html$/, '').replace(/[\\/]/g, '_')}-${s.name}.png`;
        await p.screenshot({ path: file, fullPage: true });

        console.log(`\n[${s.name} ${s.width}px] -> ${file}`);
        if (scrollW > s.width) {
            console.log(`  ⚠ Débordement horizontal : ${scrollW}px > ${s.width}px`);
            problems++;
        }
        errors.forEach((e) => {
            console.log(`  ⚠ ${e}`);
            problems++;
        });
        avertissements.forEach((e) => console.log(`  · ${e}`));
        if (scrollW <= s.width && !errors.length) console.log('  OK');
        await p.close();
    }
} catch (e) {
    console.error(`\n✗ Capture impossible : ${e.message.split('\n')[0]}`);
    problems++;
} finally {
    await browser?.close();
    serveur.fermer();
}
console.log(problems ? `\n${problems} problème(s) à corriger.` : '\nAucun problème détecté.');
process.exit(problems ? 1 : 0);
