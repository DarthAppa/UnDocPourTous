// Teste les 2 outils Pack ta Small publiés (pages générées par npm run import:pts) :
// - Sécurité : les pages publiques sont des coquilles vides (aucun texte, donnée ou code réservé) ;
//   le contenu vient de la table contenus et seul le code dont le hachage est dans la CSP s'exécute.
// - Encyclopédie : sans chapitre GOAT & Légendes, sans lien vers le builder, aucune erreur JS.
// - Builder Ma collection : lancé avec la collection DU JOUEUR (lue dans Supabase), jamais celle de l'auteur ;
//   sans collection, un message explique comment l'envoyer (extension PTS Companion).
// Usage : npm run test:outils   (captures dans shots/)
import { chromium } from 'playwright';
import { mkdirSync, readFileSync } from 'node:fs';
import { demarrer } from './serveur.mjs';
import { preparer, SESSION, compteur, VUES, texteDebordement, contenusPts } from './faux-supabase.mjs';

const serveur = await demarrer();
const browser = await chromium.launch();
mkdirSync('shots', { recursive: true });
const t = compteur();

const maintenant = new Date().toISOString();
const MEMBRE = { user_id: 'u1', membre: true, verifie_le: maintenant };
// Collection telle que l'extension la lit sur packtasmall.fr (identifiants et armes du site)
const COLLECTION = {
    player_id: '123456',
    updated_at: '2026-10-14T08:00:00Z',
    meta: {},
    roster: [
        { id: 'fannch', role: 'dps', weapon1: 'brim', weapon2: 'hellfire', overall: 87 },
        {
            id: 'carumba',
            playerKey: 'carumba',
            variant: 'base',
            role: 'heal',
            weapon: 'sancti',
            weapon2: 'damnation',
            overall: 86,
        },
        {
            id: 'heisty-joker',
            playerKey: 'heisty',
            variant: 'joker',
            role: 'tank',
            weapon: 'heavy_mace',
            weapon2: 'realm',
            overall: 81,
            jokerCollectif: 1,
        },
        { id: 'friix', role: 'tank', weapon1: 'greathammer', weapon2: 'heavy_mace', overall: 85 },
        { id: 'simonlemalicieux', role: 'support', weapon1: 'ent', weapon2: 'rift', overall: 85 },
        { id: 'arobass-fillall', role: 'tank', overall: 86 },
        { id: 'mamouth-caller', role: 'caller', weapon1: 'hoj', weapon2: 'golem', overall: 84 },
        { id: 'carte-inconnue-xyz', role: 'dps', overall: 70 },
    ],
};

// Contenu réservé préparé par npm run import:pts (contenus-prives/, absent en CI : tests fonctionnels ignorés)
const CONTENUS = contenusPts();
const coquille = (page) => {
    const html = readFileSync(`dist/${page}`, 'utf8');
    const m = html.match(/<div id="pts-outil" data-slug="([^"]+)" data-parts="(\d+)" data-csp-scripts="([^"]*)">/);
    return { html, slug: m?.[1], parts: Number(m?.[2]), hachages: m?.[3].split(' ').filter(Boolean) ?? [] };
};
const charge = (c) => {
    const lignes = Array.from({ length: c.parts }, (_, i) => CONTENUS.find((x) => x.slug === `${c.slug}-${i + 1}`));
    return lignes.every(Boolean) ? JSON.parse(lignes.map((l) => l.html).join('')) : null;
};

try {
    console.log('\n[pages publiques : aucun contenu réservé]');
    for (const page of ['pts-encyclopedie.html', 'pts-builder.html']) {
        const c = coquille(page);
        t.verif(
            Boolean(c.slug && c.parts >= 1),
            `${page} : coquille avec slug versionné (${c.slug}, ${c.parts} partie(s))`,
        );
        t.verif(c.html.length < 120_000, `${page} : page légère (${Math.round(c.html.length / 1024)} Ko)`);
        t.verif(!/type="application\/json"/.test(c.html), `${page} : aucun bloc de données dans la page`);
        const corps = c.html.slice(c.html.indexOf('<body>'));
        t.verif(!/<script/i.test(corps), `${page} : aucun script dans le corps de la page`);
        t.verif(
            !/SEBASTIEN|FANNCH|7V3N|AHOUAHOU|Maths des combats|Meta Recruteur/.test(c.html),
            `${page} : aucun nom de carte, compo ou chapitre`,
        );
        const csp = c.html.match(/Content-Security-Policy" content="([^"]+)"/)?.[1] ?? '';
        t.verif(
            c.hachages.length > 0 && c.hachages.every((h) => csp.includes(`'${h}'`)),
            `${page} : le code autorisé (${c.hachages.length} script(s)) est dans la CSP`,
        );
        t.verif(
            !/script-src[^;]*unsafe-(inline|eval)/.test(csp),
            `${page} : CSP sans unsafe-inline ni unsafe-eval pour les scripts`,
        );
    }

    const avecContenu = CONTENUS.length > 0;
    if (!avecContenu) console.log('  - contenu réservé absent (CI) : tests fonctionnels des outils ignorés');
    const encyclo = charge(coquille('pts-encyclopedie.html'));
    const builder = charge(coquille('pts-builder.html'));
    if (avecContenu) {
        console.log('\n[contenu réservé (contenus-prives/pts)]');
        t.verif(
            Boolean(encyclo && builder),
            'contenu réservé à jour pour les deux pages (même version que les coquilles)',
        );
        const e = JSON.stringify(encyclo ?? {});
        t.verif(
            !/id=\\"pouvoirs\\"|href=\\"#pouvoirs\\"/.test(e),
            'chapitre GOAT & Légendes retiré (section et sommaire)',
        );
        t.verif(Boolean(encyclo?.donnees?.['pts-gl']), 'données GOAT et Légendes gardées (calculs)');
        t.verif(
            !['pts-comps', 'pts-tcomps', 'pts-tour'].some((id) => id in (encyclo?.donnees ?? {})),
            'encyclopédie : compos de l’auteur et données de tournoi retirées',
        );
        t.verif(!/class=\\"parts\\"|href=\\"pts-builder\.html\\"/.test(e), 'aucun lien vers le builder');
        const b = JSON.stringify(builder ?? {});
        t.verif(!/Builder Tournoi|pts-tcomps|rbuilder/.test(b), 'Builder Tournoi retiré');
        t.verif(
            builder?.donnees?.['pts-coll'] === '[]' && !/SEBASTIEN\\",98,\\"economist/.test(b),
            'collection de l’auteur absente',
        );
        t.verif(!/window\.claude/.test(b), 'plus d’appel à window.claude');
    }

    console.log('\n[accès]');
    {
        // Membre vérifié mais contenu modifié dans la base avec du code non prévu : rien ne s'exécute
        const c = coquille('pts-encyclopedie.html');
        const piege = JSON.stringify({
            v: 1,
            balisage: '<p id="piege">x</p>',
            donnees: {},
            scripts: ['window.__pirate=1'],
        });
        const p = await browser.newPage();
        p.setDefaultTimeout(15000);
        await preparer(p, {
            serveurUrl: serveur.url,
            faux: {
                session: SESSION,
                tables: {
                    membres_pts: MEMBRE,
                    contenus: Array.from({ length: c.parts }, (_, i) => ({
                        slug: `${c.slug}-${i + 1}`,
                        html: i ? '' : piege,
                    })),
                },
            },
        });
        await p.goto(serveur.url + 'pts-encyclopedie.html', { waitUntil: 'networkidle' });
        await p.waitForFunction(() => document.getElementById('pts-outil-etat').textContent.includes('Impossible'));
        t.verif(
            !(await p.evaluate(() => window.__pirate)) && !(await p.$('#piege')),
            'code absent de la CSP refusé : rien n’est exécuté ni affiché',
        );
        await p.close();
    }
    {
        // Connecté, membre « périmé » côté navigateur mais la base ne renvoie rien : renvoi vers pts.html
        const p = await browser.newPage();
        await preparer(p, { serveurUrl: serveur.url, faux: { session: SESSION, tables: { membres_pts: MEMBRE } } });
        await p.goto(serveur.url + 'pts-builder.html');
        await p.waitForURL(/pts\.html\?verrou=1/, { timeout: 10000 }).catch(() => {});
        t.verif(p.url().endsWith('pts.html?verrou=1'), 'base sans contenu pour ce compte : renvoi vers pts.html');
        await p.close();
    }

    if (!avecContenu) throw new Error('FIN');

    for (const vp of VUES) {
        console.log(`\n[${vp.nom}]`);
        const ouvrir = async (page, tables) => {
            const p = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
            p.setDefaultTimeout(15000);
            const erreurs = [];
            p.on('pageerror', (e) => erreurs.push(e.message));
            const outils = await preparer(p, {
                serveurUrl: serveur.url,
                faux: { session: SESSION, tables: { contenus: CONTENUS, ...tables } },
            });
            await p.goto(serveur.url + page, { waitUntil: 'networkidle' });
            return { p, erreurs, ...outils };
        };

        // Encyclopédie, membre vérifié
        {
            const { p, erreurs, debordement } = await ouvrir('pts-encyclopedie.html', { membres_pts: MEMBRE });
            await p.waitForFunction(() => document.querySelector('#pts-outil .p1'));
            t.verif(p.url().endsWith('pts-encyclopedie.html'), 'encyclopédie ouverte pour un membre vérifié');
            t.verif(!(await p.$('#pouvoirs')), 'encyclopédie : pas de chapitre GOAT & Légendes');
            const d = await debordement(vp.width);
            t.verif(d.ok, `encyclopédie : ${texteDebordement(d)}`);
            t.verif(!erreurs.length, `encyclopédie : aucune erreur JS ${erreurs.join(' | ')}`);
            await p.screenshot({ path: `shots/pts-encyclopedie-${vp.nom}.png` });
            await p.close();
        }

        // Builder avec la collection du joueur
        {
            const { p, erreurs, debordement } = await ouvrir('pts-builder.html', {
                membres_pts: MEMBRE,
                collections: COLLECTION,
            });
            await p.waitForFunction(() =>
                document.getElementById('pts-coll-etat').textContent.includes('Ta collection'),
            );
            const etat = await p.textContent('#pts-coll-etat');
            t.verif(
                etat.includes('7 cartes') && etat.includes('1 carte(s)'),
                `builder : collection du joueur chargée (7 cartes reconnues, 1 ignorée) — « ${etat.trim()} »`,
            );
            t.verif(await p.isVisible('#qbuilder'), 'builder : affiché une fois la collection chargée');
            const coll = await p.evaluate(() => JSON.parse(document.getElementById('pts-coll').textContent));
            t.verif(
                coll.some((c) => c[0] === 'FANNCH' && c[1] === 87 && c[3].join() === 'BRIMSTONE,HELLFIRE') &&
                    coll.some((c) => c[0] === 'AROBASS' && c[2] === 'fillall') &&
                    coll.some(
                        (c) =>
                            c[0] === 'HEISTY' &&
                            c[2] === 'joker' &&
                            c[4] === 1 &&
                            c[3].join() === 'HEAVY MACE,REALMBREAKER',
                    ),
                'builder : cartes converties (nom, note, variante, armes du site)',
            );
            await p.click('#qbopt');
            await p.waitForFunction(() => document.getElementById('qbprop').textContent.trim().length > 0, null, {
                timeout: 30000,
            });
            t.verif(true, 'builder : l’optimiseur propose des compos avec la collection du joueur');
            const d = await debordement(vp.width);
            t.verif(d.ok, `builder : ${texteDebordement(d)}`);
            t.verif(!erreurs.length, `builder : aucune erreur JS ${erreurs.join(' | ')}`);
            await p.screenshot({ path: `shots/pts-builder-${vp.nom}.png`, fullPage: false });
            await p.close();
        }

        // Builder sans collection synchronisée
        {
            const { p, erreurs } = await ouvrir('pts-builder.html', { membres_pts: MEMBRE });
            await p.waitForFunction(() =>
                document.getElementById('pts-coll-etat').textContent.includes('PTS Companion'),
            );
            t.verif(
                !(await p.isVisible('#qbuilder')),
                'sans collection : builder masqué, message PTS Companion affiché',
            );
            t.verif(!erreurs.length, `sans collection : aucune erreur JS ${erreurs.join(' | ')}`);
            await p.close();
        }
    }
} catch (e) {
    if (e.message !== 'FIN') t.verif(false, `test interrompu : ${e.message.split('\n')[0]}`);
} finally {
    await browser.close();
    serveur.fermer();
}
console.log(t.echecs ? `\n${t.echecs} test(s) en échec.` : '\nTous les tests passent.');
process.exit(t.echecs ? 1 : 0);
