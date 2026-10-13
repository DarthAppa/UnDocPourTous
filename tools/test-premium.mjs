// Teste le contenu Premium (albion-builder-tryhard.html + premium-page.js) et le bouton de paiement
// (albion-paiement.html + paiement.js) avec un faux Supabase et de fausses Edge Functions.
// Usage : node tools/test-premium.mjs   (HORS_LIGNE=1 dans un conteneur sans Internet ; captures dans shots/)
import { chromium } from 'playwright';
import { mkdirSync, readFileSync } from 'node:fs';
import { demarrer } from './serveur.mjs';
import { preparer, SESSION, compteur, VUES, texteDebordement } from './faux-supabase.mjs';

const serveur = await demarrer();
const browser = await chromium.launch();
mkdirSync('shots', { recursive: true });
const t = compteur();

const PIEGE = `<h2>Guide du tryhard</h2><p class="intro">Contenu réservé.</p>
<script>window.__pirate = 'script'</script>
<img src="x" onerror="window.__pirate = 'onerror'" alt="">
<a href="javascript:window.__pirate='lien'" id="lien-piege">lien piégé</a>
<a href=" JaVa&#x09;ScRiPt:window.__pirate='lien2'" id="lien-piege2">lien piégé 2</a>
<iframe src="https://example.com"></iframe><object data="x"></object><embed src="x">
<svg><script>window.__pirate='svg'</script><a xlink:href="javascript:alert(1)"><text>svg</text></a></svg>
<style>body{display:none}</style><p style="position:fixed;inset:0" id="maquillage">voile</p>
<form action="https://evil.example/x"><input name="mdp"></form><img srcset="https://evil.example/x.png 1x" alt="">
<a href="albion.html" target="_blank" id="lien-sain">lien sain</a>`;

async function ouvrir(vp, url, { session = SESSION, contenus = [], fonctions = {} } = {}) {
    const p = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
    p.setDefaultTimeout(10000);
    const erreurs = [];
    p.on('pageerror', (e) => erreurs.push(e.message));
    let alerte = false;
    p.on('dialog', (d) => {
        alerte = true;
        d.dismiss();
    });
    const outils = await preparer(p, { serveurUrl: serveur.url, faux: { session, tables: { contenus } }, fonctions });
    await p.goto(serveur.url + url);
    return { p, erreurs, alerte: () => alerte, ...outils };
}
const zoneChargee = (p) => p.waitForFunction(() => !document.getElementById('premium-zone').hasAttribute('aria-busy'));

try {
    // 0. La page publique ne contient aucun contenu payant
    const source = readFileSync('albion-builder-tryhard.html', 'utf8');
    t.verif(
        !/Guide du tryhard/.test(source) && /data-slug="albion-builder-tryhard"/.test(source),
        'albion-builder-tryhard.html : gabarit seul, aucun contenu payant dans le fichier',
    );
    const premium = readFileSync('albion-premium.html', 'utf8');
    t.verif(
        /href="albion-builder-tryhard\.html"\s+class="tool-card card-link/.test(premium),
        'albion-premium.html : la carte Builder Tryhard mène à albion-builder-tryhard.html',
    );

    for (const vp of VUES) {
        console.log(`\n[${vp.nom}]`);

        // 1. Non connecté : carte « Réservé aux abonnés Premium » + connexion
        {
            const { p, erreurs, debordement } = await ouvrir(vp, 'albion-builder-tryhard.html', { session: null });
            await zoneChargee(p);
            const liens = await p.$$eval('#premium-zone a', (as) =>
                as.map((a) => ({ href: a.getAttribute('href'), classe: a.className, txt: a.textContent })),
            );
            t.verif(
                liens.length === 1 &&
                    liens[0].href === 'connexion-pts.html?retour=albion-builder-tryhard.html' &&
                    liens[0].classe.includes('card-link') &&
                    liens[0].txt.includes('Réservé aux abonnés Premium') &&
                    (await p.$$('#premium-zone .card-hint')).length === 1,
                'non connecté : carte « Réservé aux abonnés Premium » (un seul lien) vers la connexion',
            );
            const d = await debordement(vp.width);
            t.verif(d.ok, texteDebordement(d));
            await p.screenshot({ path: `shots/premium-non-connecte-${vp.nom}.png`, fullPage: true });
            t.verif(!erreurs.length, `aucune erreur JS ${erreurs.join(' | ')}`);
            await p.close();
        }

        // 2. Connecté sans accès (la base ne renvoie aucune ligne) : carte vers le paiement
        {
            const { p, erreurs } = await ouvrir(vp, 'albion-builder-tryhard.html');
            await zoneChargee(p);
            const href = await p.$$eval('#premium-zone a', (as) => as.map((a) => a.getAttribute('href')));
            const lu = await p.evaluate(() =>
                globalThis.__APPELS__.find(
                    (a) => a.table === 'contenus' && a.filtres.slug === 'albion-builder-tryhard',
                ),
            );
            t.verif(
                href.length === 1 && href[0] === 'albion-paiement.html' && !!lu,
                'connecté sans accès : contenus lu (slug) → aucune ligne → carte vers albion-paiement.html',
            );
            t.verif(!erreurs.length, `aucune erreur JS ${erreurs.join(' | ')}`);
            await p.close();
        }

        // 3. Accès Premium : contenu injecté et nettoyé
        {
            const { p, erreurs, alerte, debordement } = await ouvrir(vp, 'albion-builder-tryhard.html', {
                contenus: [{ slug: 'albion-builder-tryhard', titre: 'Builder Tryhard', html: PIEGE }],
            });
            await zoneChargee(p);
            await p.waitForTimeout(400);
            t.verif(
                (await p.textContent('#premium-zone h2')) === 'Guide du tryhard' &&
                    (await p.isVisible('#premium-zone p.intro')),
                'avec accès : contenu affiché dans la zone',
            );
            const r = await p.evaluate(() => {
                const z = document.getElementById('premium-zone');
                const attrs = [...z.querySelectorAll('*')].flatMap((e) => [...e.attributes].map((a) => a.name));
                return {
                    interdits: z.querySelectorAll('script, iframe, object, embed').length,
                    on: attrs.filter((n) => n.startsWith('on')).length,
                    img: z.querySelectorAll('img').length,
                    piege: document.getElementById('lien-piege')?.hasAttribute('href'),
                    piege2: document.getElementById('lien-piege2')?.hasAttribute('href'),
                    svgHref: [...z.querySelectorAll('svg a')].some(
                        (a) => a.getAttribute('xlink:href') || a.getAttribute('href'),
                    ),
                    sain: document.getElementById('lien-sain')?.getAttribute('href'),
                    rel: document.getElementById('lien-sain')?.getAttribute('rel'),
                    maquillage: z.querySelectorAll('style, form, [style], [srcset], [ping]').length,
                };
            });
            t.verif(r.interdits === 0, 'nettoyage : <script>, <iframe>, <object>, <embed> supprimés (SVG compris)');
            t.verif(r.maquillage === 0, 'nettoyage : <style>, <form>, style=, srcset et ping retirés');
            t.verif(r.on === 0 && r.img === 2, 'nettoyage : attributs on* retirés (l’image reste, sans onerror)');
            t.verif(
                r.piege === false && r.piege2 === false && !r.svgHref,
                'nettoyage : href javascript: retirés (casse, tabulation et SVG compris)',
            );
            t.verif(r.sain === 'albion.html' && r.rel === 'noopener noreferrer', 'lien sain conservé (+ rel noopener)');
            await p.click('#lien-piege');
            await p.waitForTimeout(200);
            t.verif(
                (await p.evaluate(() => window.__pirate)) === undefined && !alerte(),
                'aucun script du contenu exécuté (script, onerror, javascript:)',
            );
            const d = await debordement(vp.width);
            t.verif(d.ok, texteDebordement(d));
            await p.screenshot({ path: `shots/premium-acces-${vp.nom}.png`, fullPage: true });
            t.verif(!erreurs.length, `aucune erreur JS ${erreurs.join(' | ')}`);
            await p.close();
        }

        // 4. Paiement, non connecté : vers la connexion
        {
            const { p, erreurs, appelsFonctions } = await ouvrir(vp, 'albion-paiement.html', { session: null });
            await p.click('#payer');
            await p.waitForURL(/connexion-pts\.html/, { timeout: 8000 }).catch(() => {});
            t.verif(
                p.url().endsWith('connexion-pts.html?retour=albion-paiement.html') && !appelsFonctions.length,
                'paiement non connecté : renvoi vers connexion-pts.html?retour=albion-paiement.html',
            );
            t.verif(!erreurs.length, `aucune erreur JS ${erreurs.join(' | ')}`);
            await p.close();
        }

        // 5. Paiement connecté : creer-paiement puis Stripe Checkout
        {
            const STRIPE = 'https://checkout.stripe.com/c/pay/cs_test_123';
            const { p, erreurs, appelsFonctions } = await ouvrir(vp, 'albion-paiement.html', {
                fonctions: { 'creer-paiement': { status: 200, body: { url: STRIPE } } },
            });
            const depart = p.waitForRequest((r) => r.url() === STRIPE, { timeout: 5000 }).catch(() => null);
            await p.click('#payer');
            const req = await depart;
            const a = appelsFonctions.find((x) => x.nom === 'creer-paiement');
            t.verif(
                !!a &&
                    a.corps?.offre === 'premium' &&
                    Object.keys(a.corps).length === 1 &&
                    a.headers.authorization === 'Bearer jwt-test',
                'paiement connecté : creer-paiement appelée avec {offre:"premium"} et le JWT',
            );
            t.verif(!!req, 'URL checkout.stripe.com renvoyée : redirection vers Stripe');
            t.verif(!erreurs.length, `aucune erreur JS ${erreurs.join(' | ')}`);
            await p.close();
        }

        // 6. URL non Stripe refusée ; fonction absente → « arrive bientôt »
        for (const [cas, rep] of [
            ['URL non Stripe', { status: 200, body: { url: 'https://checkout.stripe.com.evil.example/x' } }],
            ['fonction pas encore déployée', undefined],
        ]) {
            const { p, erreurs, requetesExternes } = await ouvrir(vp, 'albion-paiement.html', {
                fonctions: rep ? { 'creer-paiement': rep } : {},
            });
            await p.click('#payer');
            await p
                .waitForFunction(() => document.getElementById('paiement-msg').textContent.includes('arrive bientôt'))
                .catch(() => {});
            t.verif(
                (await p.textContent('#paiement-msg')).includes('Le paiement en ligne arrive bientôt') &&
                    p.url().endsWith('albion-paiement.html') &&
                    !requetesExternes.some((u) => u.includes('evil.example')) &&
                    !(await p.isDisabled('#payer')),
                `${cas} : pas de redirection, message « Le paiement en ligne arrive bientôt »`,
            );
            t.verif(!erreurs.length, `aucune erreur JS ${erreurs.join(' | ')}`);
            await p.close();
        }

        // 7. Retour de Stripe annulé
        {
            const { p, erreurs, debordement } = await ouvrir(vp, 'albion-paiement.html?paiement=annule');
            await p.waitForTimeout(300);
            t.verif(
                (await p.textContent('#paiement-msg')).includes('Paiement annulé'),
                '?paiement=annule : message affiché',
            );
            const d = await debordement(vp.width);
            t.verif(d.ok, texteDebordement(d));
            t.verif(!erreurs.length, `aucune erreur JS ${erreurs.join(' | ')}`);
            await p.close();
        }
    }
} catch (e) {
    console.error(`\n  ✗ test interrompu : ${e.message.split('\n')[0]}`);
    t.echecs++;
} finally {
    await browser.close();
    serveur.fermer();
}
console.log(t.echecs ? `\n${t.echecs} test(s) en échec.` : '\nTous les tests passent.');
process.exit(t.echecs ? 1 : 0);
