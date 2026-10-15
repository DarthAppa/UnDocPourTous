// Teste l'adresse propre (assets/js/adresse.js) :
// - « en ligne » (https://undocpourtous.com simulé, comme GitHub Pages : /page sert page.html) :
//   plus de .html ni de #ancre dans la barre, paramètres et #error=… gardés, F5 sur l'adresse propre OK ;
// - en local : chemin inchangé (le serveur de test ne sert pas /page), ancres quand même retirées.
// Usage : npm run test:adresse   (après npm run build)
import { chromium } from 'playwright';
import { readFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { demarrer } from './serveur.mjs';
import { preparer, SESSION, compteur } from './faux-supabase.mjs';

const EN_LIGNE = 'https://undocpourtous.com';
const DIST = resolve('dist');
const TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css',
    '.js': 'text/javascript',
    '.mjs': 'text/javascript',
};
const serveur = await demarrer();
const browser = await chromium.launch();
const t = compteur();
const MEMBRE = { user_id: 'u1', membre: true, verifie_le: new Date().toISOString() };

// Faux GitHub Pages : /albion → dist/albion.html, / → dist/index.html
async function pagesGithub(route) {
    let chemin = new URL(route.request().url()).pathname;
    if (chemin.endsWith('/')) chemin += 'index.html';
    else if (!extname(chemin)) chemin += '.html';
    try {
        const corps = await readFile(resolve(DIST, '.' + chemin));
        await route.fulfill({ contentType: TYPES[extname(chemin)] || 'application/octet-stream', body: corps });
    } catch {
        await route.fulfill({ status: 404, body: '' });
    }
}

async function ouvrir(base, tables = {}) {
    const p = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    p.setDefaultTimeout(15000);
    const erreurs = [];
    p.on('pageerror', (e) => erreurs.push(e.message));
    if (base === EN_LIGNE) await p.route(`${EN_LIGNE}/**`, pagesGithub); // déclarée d'abord : les routes du faux Supabase passent avant
    await preparer(p, { serveurUrl: base, faux: { session: SESSION, tables } });
    return { p, erreurs };
}
const adresse = (p) => p.evaluate(() => location.pathname + location.search + location.hash);

console.log('\n[en ligne : undocpourtous.com simulé]');
{
    const { p, erreurs } = await ouvrir(EN_LIGNE);
    await p.goto(`${EN_LIGNE}/albion.html`, { waitUntil: 'networkidle' });
    t.verif((await adresse(p)) === '/albion', `albion.html affichée « /albion » (${await adresse(p)})`);

    await p.goto(`${EN_LIGNE}/index.html`, { waitUntil: 'networkidle' });
    t.verif((await adresse(p)) === '/', 'index.html affichée « / »');
    const actif = await p.$eval('.nav-link[aria-current="page"]', (a) => a.getAttribute('href')).catch(() => null);
    t.verif(actif === 'index.html', 'lien du menu de la page en cours toujours repéré (« / » = index.html)');

    await p.goto(`${EN_LIGNE}/conditions.html?retour=profil.html#error=refus`, { waitUntil: 'networkidle' });
    t.verif((await adresse(p)) === '/conditions?retour=profil.html#error=refus', 'paramètres et #error=… gardés');

    await p.goto(`${EN_LIGNE}/albion`, { waitUntil: 'networkidle' });
    await p.reload({ waitUntil: 'networkidle' });
    t.verif(
        (await adresse(p)) === '/albion' && (await p.title()).includes('Albion'),
        'F5 sur « /albion » : page servie',
    );
    t.verif(!erreurs.length, `aucune erreur JS ${erreurs.join(' | ')}`);
    await p.close();
}
{
    const { p, erreurs } = await ouvrir(EN_LIGNE, { membres_pts: MEMBRE });
    await p.goto(`${EN_LIGNE}/pts-encyclopedie.html#ch10`, { waitUntil: 'networkidle' });
    await p.waitForFunction(() => !document.documentElement.classList.contains('pts-attente'));
    await p.waitForFunction(() => !location.hash);
    t.verif((await adresse(p)) === '/pts-encyclopedie', `encyclopédie avec #ch10 affichée « /pts-encyclopedie »`);
    await p.waitForTimeout(1500); // la page finit de se construire : la section doit rester visée
    const haut = await p.$eval('#ch10', (el) => Math.round(el.getBoundingClientRect().top));
    t.verif(Math.abs(haut) < 120, `arrivée sur le chapitre visé (#ch10 à ${haut}px du haut)`);

    await p.click('nav a[href="#ch14"]');
    // Défilement doux (scroll-behavior: smooth) sur toute la page : on lui laisse jusqu'à 10 s
    await p
        .waitForFunction(() => Math.abs(document.getElementById('ch14').getBoundingClientRect().top) < 120, null, {
            timeout: 10000,
        })
        .catch(() => {});
    const haut2 = await p.$eval('#ch14', (el) => Math.round(el.getBoundingClientRect().top));
    t.verif((await adresse(p)) === '/pts-encyclopedie', 'clic dans le sommaire : pas de # dans l’adresse');
    t.verif(Math.abs(haut2) < 120, `clic dans le sommaire : défilement jusqu’au chapitre (${haut2}px)`);
    t.verif(
        await p.$eval('#ch14', (el) => document.activeElement === el),
        'clic dans le sommaire : focus sur le chapitre',
    );
    t.verif(!erreurs.length, `encyclopédie : aucune erreur JS ${erreurs.join(' | ')}`);
    await p.close();
}

console.log('\n[local : serveur de test]');
{
    const { p, erreurs } = await ouvrir(serveur.url);
    await p.goto(`${serveur.url}albion.html`, { waitUntil: 'networkidle' });
    t.verif(
        (await adresse(p)) === '/albion.html',
        'chemin inchangé hors ligne (le serveur local ne sert pas « /albion »)',
    );
    t.verif(!erreurs.length, `aucune erreur JS ${erreurs.join(' | ')}`);
    await p.close();
}

await browser.close();
serveur.fermer();
console.log(t.echecs ? `\n${t.echecs} échec(s).` : '\nTous les tests passent.');
process.exit(t.echecs ? 1 : 0);
