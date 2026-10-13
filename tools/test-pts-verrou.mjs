// Teste la logique « si connecté avec Discord → outils débloqués » des pages Pack ta Small.
// Usage : npm run test:pts   (captures des états dans shots/)
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { demarrer } from './serveur.mjs';

const serveur = await demarrer();
const browser = await chromium.launch();
mkdirSync('shots', { recursive: true });
let echecs = 0;
const verif = (ok, texte) => { console.log(`${ok ? '  ✓' : '  ✗'} ${texte}`); if (!ok) echecs++; };
const INVIT = 'https://discord.gg/packtasmall';

const etatCartes = (p) => p.$$eval('[data-outil]', (as) => as.map((a) => ({
    href: a.getAttribute('href'), verrou: a.classList.contains('is-locked'), badge: a.querySelector('.pts-lock-badge').textContent.trim()
})));

for (const vp of [{ nom: 'desktop', width: 1280, height: 900 }, { nom: 'mobile', width: 390, height: 844 }]) {
    console.log(`\n[${vp.nom}]`);
    const p = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
    const erreurs = [];
    p.on('pageerror', (e) => erreurs.push(e.message));

    // 1. Visiteur non connecté
    await p.goto(serveur.url + 'pts.html', { waitUntil: 'networkidle' });
    await p.evaluate(() => document.querySelectorAll('.reveal').forEach((e) => e.classList.add('visible')));
    let c = await etatCartes(p);
    verif(c.every((x) => x.href === INVIT && x.verrou), 'non connecté : les 2 cartes sont verrouillées et mènent au Discord PTS');
    verif(await p.isVisible('#pts-login'), 'non connecté : bouton « Se connecter avec Discord » visible');
    verif(await p.getAttribute('#pts-login', 'href') === 'connexion-pts.html', 'le bouton mène à la page de connexion');
    await p.screenshot({ path: `shots/pts-verrouille-${vp.nom}.png`, fullPage: true });

    // 2. Connecté mais pas membre du serveur
    await p.evaluate(async () => (await import('/pts-page.js')).appliquer({ connecte: true, membre: false, debloque: false, pseudo: 'Testeur' }));
    c = await etatCartes(p);
    verif(c.every((x) => x.href === INVIT && x.verrou), 'connecté non membre : cartes toujours verrouillées vers le Discord');
    verif(await p.isVisible('#pts-compte') && !(await p.isVisible('#pts-login')), 'connecté : zone compte affichée, bouton masqué');

    // 3. Connecté et membre : débloqué
    await p.evaluate(async () => (await import('/pts-page.js')).appliquer({ connecte: true, membre: true, debloque: true, pseudo: 'Apparance' }));
    c = await etatCartes(p);
    verif(c[0].href === 'pts-encyclopedie.html' && c[1].href === 'pts-builder.html' && c.every((x) => !x.verrou && x.badge === 'DÉBLOQUÉ'),
        'connecté et membre : cartes débloquées vers l’Encyclopédie et le Builder');
    await p.screenshot({ path: `shots/pts-debloque-${vp.nom}.png`, fullPage: true });

    // 4. Accès direct à un outil sans connexion : renvoi vers la page PTS
    await p.goto(serveur.url + 'pts-builder.html');
    await p.waitForURL(/pts\.html\?verrou=1/, { timeout: 10000 }).catch(() => {});
    verif(p.url().endsWith('pts.html?verrou=1'), 'outil ouvert sans connexion : renvoi vers pts.html');

    // 5. Page de connexion (Supabase pas encore configuré)
    await p.goto(serveur.url + 'connexion-pts.html', { waitUntil: 'networkidle' });
    await p.click('#pts-go');
    verif((await p.textContent('#pts-msg')).includes('pas encore activée'), 'connexion : message clair tant que Supabase n’est pas configuré');
    await p.screenshot({ path: `shots/connexion-pts-${vp.nom}.png`, fullPage: true });

    const largeur = await p.evaluate(() => document.documentElement.scrollWidth);
    verif(largeur <= vp.width, `pas de débordement horizontal (${largeur}px)`);
    verif(!erreurs.length, `aucune erreur JS ${erreurs.join(' | ')}`);
    await p.close();
}

await browser.close();
serveur.fermer();
console.log(echecs ? `\n${echecs} test(s) en échec.` : '\nTous les tests passent.');
process.exit(echecs ? 1 : 0);
