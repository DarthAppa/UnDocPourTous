// Teste la logique « si connecté avec Discord → outils débloqués » des pages Pack ta Small.
// Usage : npm run test:pts   (captures des états dans shots/)
import { chromium } from 'playwright';
import { mkdirSync, existsSync } from 'node:fs';
import { demarrer } from './serveur.mjs';
import { PTS_CONFIG } from '../pts-config.js';

// Faux client Supabase : le test ne dépend ni du CDN jsDelivr ni du vrai projet Supabase.
const FAUX_SUPABASE = `export function createClient(url) {
  const vide = { data: [], error: null, count: 0 };
  const q = { select: () => q, eq: () => q, order: () => q, limit: () => Promise.resolve(vide), then: (r) => r(vide) };
  return { from: () => q, auth: {
    getSession: async () => ({ data: { session: null } }),
    signOut: async () => ({ error: null }),
    signInWithOAuth: async ({ provider, options }) => {
      location.assign(url + '/auth/v1/authorize?provider=' + provider + '&redirect_to=' + encodeURIComponent(options.redirectTo));
      return { data: {}, error: null };
    } } };
}`;

const serveur = await demarrer();
const browser = await chromium.launch();
mkdirSync('shots', { recursive: true });
let echecs = 0;
const verif = (ok, texte) => {
    console.log(`${ok ? '  ✓' : '  ✗'} ${texte}`);
    if (!ok) echecs++;
};
try {
    const INVIT = 'https://discord.gg/packtasmall';

    const etatCartes = (p) =>
        p.$$eval('[data-outil]', (as) =>
            as.map((a) => ({
                href: a.getAttribute('href'),
                verrou: a.classList.contains('is-locked'),
                badge: a.querySelector('.pts-lock-badge').textContent.trim(),
            })),
        );

    for (const vp of [
        { nom: 'desktop', width: 1280, height: 900 },
        { nom: 'mobile', width: 390, height: 844 },
    ]) {
        console.log(`\n[${vp.nom}]`);
        const p = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
        p.setDefaultTimeout(10000);
        // Faux client Supabase : ancien import CDN ou module local assets/vendor/supabase.mjs (autorisé par la CSP)
        for (const motif of [
            'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@*/**',
            '**/assets/vendor/supabase.mjs',
        ])
            await p.route(motif, (r) => r.fulfill({ contentType: 'text/javascript', body: FAUX_SUPABASE }));
        await p.route(`${PTS_CONFIG.SUPABASE_URL}/**`, (r) => r.abort()); // jamais de vrai départ vers Supabase/Discord
        const erreurs = [];
        p.on('pageerror', (e) => erreurs.push(e.message));

        // 1. Visiteur non connecté
        await p.goto(serveur.url + 'pts.html', { waitUntil: 'networkidle' });
        await p.evaluate(() => document.querySelectorAll('.reveal').forEach((e) => e.classList.add('visible')));
        let c = await etatCartes(p);
        verif(
            c.every((x) => x.href === INVIT && x.verrou),
            'non connecté : les 2 cartes sont verrouillées et mènent au Discord PTS',
        );
        verif(await p.isVisible('#pts-login'), 'non connecté : bouton « Se connecter avec Discord » visible');
        verif(
            (await p.getAttribute('#pts-login', 'href')) === 'connexion-pts.html',
            'le bouton mène à la page de connexion',
        );
        await p.screenshot({ path: `shots/pts-verrouille-${vp.nom}.png`, fullPage: true });

        // 2. Connecté mais pas membre du serveur
        await p.evaluate(async () =>
            (await import('/pts-page.js')).appliquer({
                connecte: true,
                membre: false,
                debloque: false,
                pseudo: 'Testeur',
            }),
        );
        c = await etatCartes(p);
        verif(
            c.every((x) => x.href === INVIT && x.verrou),
            'connecté non membre : cartes toujours verrouillées vers le Discord',
        );
        verif(
            (await p.isVisible('#pts-compte')) && !(await p.isVisible('#pts-login')),
            'connecté : zone compte affichée, bouton masqué',
        );

        // 3. Connecté et membre : débloqué
        await p.evaluate(async () =>
            (await import('/pts-page.js')).appliquer({
                connecte: true,
                membre: true,
                debloque: true,
                pseudo: 'Apparance',
            }),
        );
        c = await etatCartes(p);
        verif(
            c[0].href === 'pts-encyclopedie.html' &&
                c[1].href === 'pts-builder.html' &&
                c.every((x) => !x.verrou && x.badge === 'DÉBLOQUÉ'),
            'connecté et membre : cartes débloquées vers l’Encyclopédie et le Builder',
        );
        await p.screenshot({ path: `shots/pts-debloque-${vp.nom}.png`, fullPage: true });

        // 3b. Données PTS du joueur (collection + replays) affichées une fois connecté
        await p.evaluate(async () =>
            (await import('/pts-page.js')).appliquer({
                connecte: true,
                membre: true,
                debloque: true,
                pseudo: 'Apparance',
                donnees: {
                    comptes: [{ player_id: '1' }],
                    collections: [],
                    nbCartes: 308,
                    majCollection: '2026-10-12T10:00:00Z',
                    nbReplays: 59,
                },
            }),
        );
        await p.waitForTimeout(200);
        const donnees = await p.textContent('#pts-donnees');
        verif(
            (await p.isVisible('#pts-donnees')) && donnees.includes('308 cartes') && donnees.includes('Replays : 59'),
            'connecté : collection et replays du joueur affichés',
        );
        await p.screenshot({ path: `shots/pts-donnees-${vp.nom}.png`, fullPage: false });

        // 3b bis. Déconnexion volontaire : pas de faux « déconnecté pour inactivité » quelques secondes après
        await p.click('[data-deconnexion]');
        await p.waitForTimeout(6000);
        verif(
            !p.url().includes('inactif=1') && (await p.isVisible('#pts-login')),
            'déconnexion volontaire : pas de faux message d’inactivité',
        );
        c = await etatCartes(p);
        verif(
            c.every((x) => x.verrou && x.badge === 'VERROUILLÉ'),
            'déconnexion : badges revenus à « VERROUILLÉ »',
        );
        await p.evaluate(async () =>
            (await import('/pts-page.js')).appliquer({
                connecte: true,
                membre: true,
                debloque: true,
                pseudo: 'Apparance',
            }),
        );
        c = await etatCartes(p);
        verif(
            c.every((x) => !x.verrou),
            'reconnecté : cartes de nouveau débloquées',
        );

        // 3c. Déconnexion automatique : avertissement 1 min avant, puis déconnexion
        await p.evaluate(() => localStorage.setItem('pts-derniere-activite', String(Date.now() - 29.5 * 60e3)));
        await p
            .waitForFunction(
                () => document.getElementById('pts-avertissement')?.textContent.includes('déconnexion dans'),
                null,
                { timeout: 8000 },
            )
            .catch(() => {});
        verif(
            await p.evaluate(() =>
                document.getElementById('pts-avertissement')?.textContent.includes('déconnexion dans'),
            ),
            'inactif 29 min 30 : avertissement affiché',
        );
        await p.screenshot({ path: `shots/pts-inactif-avertissement-${vp.nom}.png`, fullPage: false });
        await p.evaluate(() => localStorage.setItem('pts-derniere-activite', String(Date.now() - 31 * 60e3)));
        await p.waitForURL(/inactif=1/, { timeout: 10000 }).catch(() => {});
        verif(p.url().includes('pts.html?inactif=1'), 'inactif plus de 30 min : déconnecté et renvoyé sur pts.html');
        await p.waitForTimeout(500);
        verif(
            (await p.textContent('#pts-verrou-note')).includes('inactivité'),
            'message « déconnecté après une période d’inactivité » affiché',
        );
        verif(
            await p.evaluate(() => localStorage.getItem('pts-derniere-activite') === null),
            'compteur d’inactivité remis à zéro',
        );

        // 4. Accès direct à un outil sans connexion : renvoi vers la page PTS
        if (!existsSync('pts-builder.html'))
            console.log('  - ignoré : pts-builder.html absent (lancer npm run import:pts)');
        else {
            await p.goto(serveur.url + 'pts-builder.html');
            await p.waitForURL(/pts\.html\?verrou=1/, { timeout: 10000 }).catch(() => {});
            verif(p.url().endsWith('pts.html?verrou=1'), 'outil ouvert sans connexion : renvoi vers pts.html');
        }

        // 5. Page de connexion (Supabase configuré) : le clic part vers l'autorisation Discord de Supabase
        await p.goto(serveur.url + 'connexion-pts.html', { waitUntil: 'networkidle' });
        await p.screenshot({ path: `shots/connexion-pts-${vp.nom}.png`, fullPage: true }); // avant le clic (la page est quittée ensuite)
        const largeur = await p.evaluate(() => document.documentElement.scrollWidth);
        const depart = p
            .waitForRequest((r) => r.url().startsWith(`${PTS_CONFIG.SUPABASE_URL}/auth/v1/authorize`), {
                timeout: 5000,
            })
            .catch(() => null);
        await p.click('#pts-go');
        const req = await depart;
        verif(
            !!req &&
                new URL(req.url()).searchParams.get('provider') === 'discord' &&
                new URL(new URL(req.url()).searchParams.get('redirect_to')).pathname.endsWith('/connexion-pts.html'),
            'connexion : le bouton lance l’autorisation Discord avec retour sur connexion-pts.html',
        );

        verif(largeur <= vp.width, `pas de débordement horizontal (${largeur}px)`);
        verif(!erreurs.length, `aucune erreur JS ${erreurs.join(' | ')}`);
        await p.close();
    }
} catch (e) {
    console.error(`\n  ✗ test interrompu : ${e.message.split('\n')[0]}`);
    echecs++;
} finally {
    await browser.close();
    serveur.fermer();
}
console.log(echecs ? `\n${echecs} test(s) en échec.` : '\nTous les tests passent.');
process.exit(echecs ? 1 : 0);
