// Teste les 2 outils Pack ta Small publiés (pages générées par npm run import:pts) :
// - Encyclopédie : sans chapitre GOAT & Légendes, sans lien vers le builder, aucune erreur JS.
// - Builder Ma collection : lancé avec la collection DU JOUEUR (lue dans Supabase), jamais celle de l'auteur ;
//   sans collection, un message explique comment l'envoyer (extension PTS Companion).
// Usage : npm run test:outils   (captures dans shots/)
import { chromium } from 'playwright';
import { mkdirSync, readFileSync } from 'node:fs';
import { demarrer } from './serveur.mjs';
import { preparer, SESSION, compteur, VUES, texteDebordement } from './faux-supabase.mjs';

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

try {
    const html = readFileSync('pts-encyclopedie.html', 'utf8');
    console.log('\n[encyclopédie : contenu]');
    t.verif(
        !/id="pouvoirs"/.test(html) && !/href="#pouvoirs"/.test(html),
        'chapitre GOAT & Légendes retiré (section et sommaire)',
    );
    t.verif(/id="pts-gl"/.test(html), 'données GOAT et Légendes gardées dans la page');
    t.verif(!/class="parts"/.test(html) && !/href="pts-builder\.html"/.test(html), 'aucun lien vers le builder');

    const b = readFileSync('pts-builder.html', 'utf8');
    console.log('\n[builder : contenu]');
    t.verif(!/Builder Tournoi|pts-tcomps|id="rbuilder"/.test(b), 'Builder Tournoi retiré');
    t.verif(
        /<script type="application\/json" id="pts-coll">\[\]<\/script>/.test(b) && !/SEBASTIEN",98,"economist/.test(b),
        'collection de l’auteur absente de la page publique',
    );
    t.verif(!/window\.claude/.test(b), 'plus d’appel à window.claude');

    for (const vp of VUES) {
        console.log(`\n[${vp.nom}]`);
        const ouvrir = async (page, tables) => {
            const p = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
            p.setDefaultTimeout(15000);
            const erreurs = [];
            p.on('pageerror', (e) => erreurs.push(e.message));
            const outils = await preparer(p, { serveurUrl: serveur.url, faux: { session: SESSION, tables } });
            await p.goto(serveur.url + page, { waitUntil: 'networkidle' });
            return { p, erreurs, ...outils };
        };

        // Encyclopédie, membre vérifié
        {
            const { p, erreurs, debordement } = await ouvrir('pts-encyclopedie.html', { membres_pts: MEMBRE });
            await p.waitForFunction(() => !document.documentElement.classList.contains('pts-attente'));
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
    t.verif(false, `test interrompu : ${e.message.split('\n')[0]}`);
} finally {
    await browser.close();
    serveur.fermer();
}
console.log(t.echecs ? `\n${t.echecs} test(s) en échec.` : '\nTous les tests passent.');
process.exit(t.echecs ? 1 : 0);
