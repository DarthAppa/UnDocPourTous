// Teste la logique « si connecté avec Discord ET membre (table membres_pts) → outils débloqués » des pages Pack ta Small.
// Usage : npm run test:pts   (captures des états dans shots/)
import { chromium } from 'playwright';
import { mkdirSync, existsSync } from 'node:fs';
import { demarrer } from './serveur.mjs';
import { PTS_CONFIG } from '../public/assets/js/pts-config.js';
import { preparer, SESSION, texteDebordement } from './faux-supabase.mjs';

// Requête vers Discord ? (comparaison du nom d'hôte, pas d'une simple sous-chaîne)
const versDiscord = (u) => {
    try {
        const h = new URL(u).hostname;
        return h === 'discord.com' || h.endsWith('.discord.com');
    } catch {
        return false;
    }
};

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
        const { requetesExternes, debordement } = await preparer(p, { serveurUrl: serveur.url }); // visiteur sans session
        await p.addInitScript(() => {
            try {
                localStorage.setItem('pts-acces', '{"membre":true}'); // ancien cache : doit être purgé
            } catch {
                /* page d'erreur (départ vers Discord coupé) */
            }
        });
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
            await p.evaluate(() => localStorage.getItem('pts-acces') === null),
            'ancien cache local « pts-acces » purgé au chargement (plus de source de vérité locale)',
        );
        verif(
            (await p.getAttribute('#pts-login', 'href')) === 'connexion-pts.html',
            'le bouton mène à la page de connexion',
        );
        await p.screenshot({ path: `shots/pts-verrouille-${vp.nom}.png`, fullPage: true });

        // 2. Connecté mais pas membre du serveur
        await p.evaluate(async () =>
            (await import('/assets/js/pts-page.js')).appliquer({
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
            (await import('/assets/js/pts-page.js')).appliquer({
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
            (await import('/assets/js/pts-page.js')).appliquer({
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
            (await import('/assets/js/pts-page.js')).appliquer({
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
        const largeur = await debordement(vp.width);
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

        verif(largeur.ok, texteDebordement(largeur));
        verif(!erreurs.length, `aucune erreur JS ${erreurs.join(' | ')}`);
        verif(!requetesExternes.some(versDiscord), 'aucune requête du navigateur vers discord.com');
        await p.close();

        // 6. Appartenance lue dans membres_pts (source de vérité serveur)
        const maintenant = new Date().toISOString();
        const ilYa40j = new Date(Date.now() - 40 * 864e5).toISOString();
        for (const [cas, ligne, attendu] of [
            ['membre (membres_pts.membre = true)', { user_id: 'u1', membre: true, verifie_le: maintenant }, true],
            [
                'non membre (membres_pts.membre = false)',
                { user_id: 'u1', membre: false, verifie_le: maintenant },
                false,
            ],
            ['vérification de plus de 30 jours', { user_id: 'u1', membre: true, verifie_le: ilYa40j }, false],
            ['aucune ligne membres_pts', null, false],
        ]) {
            const q = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
            q.setDefaultTimeout(10000);
            const err = [];
            q.on('pageerror', (e) => err.push(e.message));
            const { appelsFonctions } = await preparer(q, {
                serveurUrl: serveur.url,
                faux: { session: SESSION, tables: ligne ? { membres_pts: ligne } : {} },
            });
            await q.goto(serveur.url + 'pts.html', { waitUntil: 'networkidle' });
            await q.waitForFunction(() => !document.getElementById('pts-compte').hidden);
            const cartes = await etatCartes(q);
            const lu = await q.evaluate(() =>
                globalThis.__APPELS__.some((a) => a.type === 'from' && a.table === 'membres_pts'),
            );
            verif(
                lu && cartes.every((x) => x.verrou === !attendu) && !appelsFonctions.length && !err.length,
                `session sans jeton Discord, ${cas} : outils ${attendu ? 'débloqués' : 'verrouillés'} (lu dans membres_pts, aucun appel serveur)`,
            );
            await q.close();
        }

        // 7. Retour de Discord (provider_token) : vérification par l'Edge Function, puis refreshSession
        for (const [cas, reponse] of [
            ['succès', { status: 200, body: { membre: true, verifie_le: maintenant } }],
            ['échec serveur', { status: 500, body: { erreur: 'interne' } }],
        ]) {
            const q = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
            q.setDefaultTimeout(10000);
            const err = [];
            q.on('pageerror', (e) => err.push(e.message));
            const ok = reponse.status === 200;
            const { appelsFonctions, requetesExternes: ext } = await preparer(q, {
                serveurUrl: serveur.url,
                faux: {
                    session: { ...SESSION, provider_token: 'discord-xyz' },
                    tables: ok ? { membres_pts: { user_id: 'u1', membre: true, verifie_le: maintenant } } : {},
                },
                fonctions: { 'verifier-guilde': reponse },
            });
            await q.goto(serveur.url + 'connexion-pts.html?code=abc&retour=pts.html');
            if (ok) {
                await q.waitForURL(/\/pts\.html$/, { timeout: 8000 }).catch(() => {});
                verif(q.url().endsWith('/pts.html'), 'retour de Discord, membre : redirection vers pts.html');
            } else {
                await q.waitForFunction(() => document.getElementById('pts-msg').textContent.includes('impossible'));
                verif(
                    (await q.textContent('#pts-msg')).includes('Vérification impossible pour le moment') &&
                        q.url().includes('connexion-pts.html') &&
                        !(await q.isDisabled('#pts-go')),
                    'retour de Discord, échec du serveur : « Vérification impossible pour le moment », pas de redirection',
                );
            }
            const v = appelsFonctions.filter((a) => a.nom === 'verifier-guilde');
            verif(
                v.length === 1 &&
                    v[0].methode === 'POST' &&
                    v[0].corps?.provider_token === 'discord-xyz' &&
                    Object.keys(v[0].corps).length === 1 &&
                    v[0].headers.authorization === 'Bearer jwt-test' &&
                    v[0].headers.apikey === PTS_CONFIG.SUPABASE_ANON_KEY,
                `${cas} : verifier-guilde appelée une fois (POST, {provider_token}, JWT et apikey)`,
            );
            if (!ok) {
                const refresh = await q.evaluate(() => globalThis.__APPELS__.some((a) => a.type === 'refresh'));
                verif(refresh, `${cas} : refreshSession appelé quand même (le jeton Discord quitte le stockage)`);
            }
            verif(!ext.some(versDiscord), `${cas} : aucune requête vers discord.com`);
            verif(!err.length, `${cas} : aucune erreur JS ${err.join(' | ')}`);
            await q.close();
        }

        // 8. Ordre exact sur une même page : verifier-guilde puis refreshSession (appel direct du module)
        {
            const q = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
            const { appelsFonctions } = await preparer(q, {
                serveurUrl: serveur.url,
                faux: {
                    session: { ...SESSION, provider_token: 'discord-xyz' },
                    tables: { membres_pts: { user_id: 'u1', membre: true, verifie_le: maintenant } },
                },
                fonctions: { 'verifier-guilde': { status: 200, body: { membre: true, verifie_le: maintenant } } },
            });
            await q.goto(serveur.url + 'index.html', { waitUntil: 'networkidle' });
            const r = await q.evaluate(async () => {
                const avant = globalThis.__APPELS__.length;
                const e = await (await import('/assets/js/pts-auth.js')).etat();
                const apres = globalThis.__APPELS__.slice(avant);
                const second = await (await import('/assets/js/pts-auth.js')).etat(); // jeton disparu : plus d'appel
                return {
                    e,
                    types: apres.map((a) => a.type),
                    second,
                    jeton: !!globalThis.__FAUX__.session.provider_token,
                };
            });
            verif(
                r.e.debloque &&
                    r.e.verification === 'ok' &&
                    r.types.includes('refresh') &&
                    !r.jeton &&
                    r.second.verification === null &&
                    appelsFonctions.length === 1,
                'etat() : verifier-guilde puis refreshSession, jeton Discord retiré, pas de 2e vérification',
            );
            await q.close();
        }
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
