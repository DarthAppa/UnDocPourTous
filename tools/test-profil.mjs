// Teste la page « Mon profil » (profil.html + profil.js) avec un faux Supabase.
// Usage : node tools/test-profil.mjs   (HORS_LIGNE=1 dans un conteneur sans Internet ; captures dans shots/)
import { chromium } from 'playwright';
import { mkdirSync, readFileSync } from 'node:fs';
import { demarrer } from './serveur.mjs';
import { preparer, SESSION, compteur, VUES, texteDebordement } from './faux-supabase.mjs';

const serveur = await demarrer();
const browser = await chromium.launch();
mkdirSync('shots', { recursive: true });
const t = compteur();

const PROFIL = {
    id: 'u1',
    pseudo: 'Apparance',
    avatar_url: 'https://cdn.discordapp.com/avatars/1/abc.png',
    cree_le: '2026-01-02T10:00:00Z',
};
const ACTIF = [
    {
        premium: true,
        premium_statut: 'actif',
        premium_fin: '2026-12-01T00:00:00Z',
        pts: true,
        pts_verifie_le: '2026-10-10T00:00:00Z',
    },
];
const INACTIF = [{ premium: false, premium_statut: null, premium_fin: null, pts: false, pts_verifie_le: null }];

async function ouvrir(
    vp,
    { profil = PROFIL, acces = ACTIF, fonctions = {}, url = 'profil.html', session = SESSION } = {},
) {
    const p = await browser.newPage({ viewport: { width: vp.width, height: vp.height }, acceptDownloads: true });
    p.setDefaultTimeout(10000);
    const erreurs = [];
    p.on('pageerror', (e) => erreurs.push(e.message));
    let alerte = false;
    p.on('dialog', (d) => {
        alerte = true;
        d.dismiss();
    });
    const outils = await preparer(p, {
        serveurUrl: serveur.url,
        cleStockee: !!session,
        faux: {
            session,
            tables: {
                profils: profil,
                membres_pts: { user_id: 'u1', membre: true, verifie_le: new Date().toISOString() },
                collections: [{ player_id: '1', n_cards: 308, updated_at: '2026-10-12T10:00:00Z' }],
                pts_accounts: [{ player_id: '1', username: 'Apparance' }],
                replay_uploads: [{ match_id: 'a' }, { match_id: 'b' }],
            },
            rpc: { mon_acces: acces },
        },
        fonctions,
    });
    await p.goto(serveur.url + url);
    return { p, erreurs, alerte: () => alerte, ...outils };
}
const pret = (p) => p.waitForFunction(() => !document.getElementById('profil-contenu').hidden);

try {
    for (const vp of VUES) {
        console.log(`\n[${vp.nom}]`);

        // 1. Non connecté : renvoi vers la connexion, retour sur le profil
        {
            const { p, erreurs } = await ouvrir(vp, { session: null });
            await p.waitForURL(/connexion\.html\?retour=profil\.html/, { timeout: 8000 }).catch(() => {});
            t.verif(
                p.url().endsWith('connexion.html?retour=profil.html'),
                'non connecté : redirection vers connexion.html?retour=profil.html',
            );
            await p.waitForTimeout(300);
            t.verif(
                (await p.title()) === 'Connexion — UnDocPourTous' &&
                    (await p.isVisible('#form-connexion')) &&
                    !(await p.isVisible('#pts-go')),
                'page de connexion du site (e-mail / Google), pas la page Discord PTS',
            );
            t.verif(!erreurs.length, `aucune erreur JS ${erreurs.join(' | ')}`);
            await p.close();
        }

        // 2. Connecté, Premium actif : affichage complet
        {
            const { p, erreurs, debordement } = await ouvrir(vp);
            await pret(p);
            await p.waitForFunction(() =>
                document.querySelector('[data-champ="pts-donnees"]').textContent.includes('cartes'),
            );
            const txt = (n) => p.textContent(`[data-champ="${n}"]`);
            t.verif((await txt('pseudo')) === 'Apparance', 'pseudo affiché');
            t.verif(
                (await p.getAttribute('#profil-avatar img', 'src')) === PROFIL.avatar_url,
                'avatar Discord affiché (cdn.discordapp.com)',
            );
            t.verif(
                (await txt('email')) === 'joueur@example.com' &&
                    (await txt('fournisseur')) === 'E-mail, Discord' &&
                    (await txt('cree')).includes('2026'),
                'e-mail, fournisseur et date de création affichés',
            );
            t.verif(
                (await p.textContent('#btn-discord')).includes('Revérifier avec Discord') &&
                    (await p.isVisible('#btn-delier-discord')),
                'Discord relié : « Revérifier avec Discord » et « Délier mon Discord » (un autre moyen de connexion existe)',
            );
            await p
                .waitForFunction(() => document.querySelector('[data-champ="mfa-statut"]').textContent.length > 0)
                .catch(() => {});
            t.verif(
                (await p.isVisible('#btn-mfa-activer')) && (await p.isVisible('#form-mdp')),
                'mot de passe modifiable et double authentification proposée',
            );
            t.verif(
                (await txt('premium-statut')) === 'Actif' &&
                    (await txt('premium-fin')).includes('2026') &&
                    (await p.isVisible('#btn-portail')) &&
                    !(await p.isVisible('#lien-premium')),
                'Premium actif : statut, date de fin, bouton « Gérer mon abonnement »',
            );
            t.verif((await txt('pts-statut')).startsWith('Membre vérifié'), 'Pack ta Small : membre vérifié le …');
            t.verif(
                (await txt('pts-donnees')).includes('308 cartes') && (await txt('pts-donnees')).includes('Replays : 2'),
                'Mes données PTS : collection et replays',
            );
            t.verif(
                (await p.textContent('.btn-login')).includes('Mon profil') &&
                    (await p.getAttribute('.btn-login', 'href')) === 'profil.html' &&
                    (await p.getAttribute('.btn-login', 'aria-label')) === 'Mon profil',
                'entete.js : bouton d’en-tête « Mon profil » (session présente)',
            );
            const d = await debordement(vp.width);
            t.verif(d.ok, texteDebordement(d));
            await p.screenshot({ path: `shots/profil-${vp.nom}.png`, fullPage: true });

            // Modification du pseudo
            await p.fill('#champ-pseudo', 'a');
            await p.click('#form-pseudo button[type="submit"]');
            t.verif(
                (await p.textContent('#pseudo-msg')).includes('entre 2 et 32') &&
                    (await p.getAttribute('#champ-pseudo', 'aria-invalid')) === 'true',
                'pseudo trop court refusé (message d’erreur)',
            );
            await p.fill('#champ-pseudo', '  Nouveau pseudo  ');
            await p.click('#form-pseudo button[type="submit"]');
            await p.waitForFunction(() => document.getElementById('pseudo-msg').textContent.includes('enregistré'));
            const maj = await p.evaluate(() =>
                globalThis.__APPELS__.filter((a) => a.table === 'profils' && a.op === 'update'),
            );
            t.verif(
                maj.length === 1 &&
                    maj[0].valeurs.pseudo === 'Nouveau pseudo' &&
                    Object.keys(maj[0].valeurs).length === 1 &&
                    maj[0].filtres.id === 'u1' &&
                    (await txt('pseudo')) === 'Nouveau pseudo',
                'modification du pseudo : update(pseudo) sur sa ligne, nettoyé, message de succès',
            );

            // Export JSON
            const telechargement = p.waitForEvent('download', { timeout: 5000 }).catch(() => null);
            await p.click('#btn-export');
            const dl = await telechargement;
            let json = null;
            try {
                json = JSON.parse(readFileSync(await dl.path(), 'utf8'));
            } catch {
                json = null;
            }
            t.verif(
                !!dl &&
                    /^undocpourtous-mes-donnees-\d{4}-\d{2}-\d{2}\.json$/.test(dl.suggestedFilename()) &&
                    json?.profil?.pseudo === 'Nouveau pseudo' &&
                    json?.abonnement?.premiumStatut === 'actif' &&
                    json?.membres_pts?.membre === true &&
                    json?.pts?.nbCartes === 308,
                'export : téléchargement d’un JSON (profil, abonnement, membres_pts, données PTS)',
            );

            // Gérer l'abonnement : fonction pas encore déployée → message
            await p.click('#btn-portail');
            await p
                .waitForFunction(() => document.getElementById('premium-msg').textContent.includes('indisponible'))
                .catch(() => {});
            t.verif(
                (await p.textContent('#premium-msg')).includes('indisponible') && p.url().endsWith('profil.html'),
                'portail-abonnement pas encore déployé : message affiché, pas de redirection',
            );
            t.verif(!erreurs.length, `aucune erreur JS ${erreurs.join(' | ')}`);
            await p.close();
        }

        // 3. Pseudo hostile et avatar hors Discord : affichés en texte, rien d'injecté
        {
            const { p, erreurs, alerte } = await ouvrir(vp, {
                profil: { ...PROFIL, pseudo: '<img src=x onerror=alert(1)>', avatar_url: 'https://evil.example/a.png' },
                acces: INACTIF,
            });
            await pret(p);
            await p.waitForTimeout(500);
            t.verif(
                (await p.textContent('[data-champ="pseudo"]')) === '<img src=x onerror=alert(1)>' &&
                    (await p.$$('main img[src="x"]')).length === 0 &&
                    !alerte(),
                'pseudo « <img src=x onerror=…> » affiché en texte, aucun élément img créé, aucune alerte',
            );
            t.verif(
                (await p.$$('#profil-avatar img')).length === 0 && (await p.textContent('#profil-avatar')) === '<',
                'avatar hors cdn.discordapp.com refusé : initiale à la place',
            );
            t.verif(
                (await p.textContent('[data-champ="premium-statut"]')) === 'Aucun abonnement' &&
                    !(await p.isVisible('#btn-portail')) &&
                    (await p.getAttribute('#lien-premium', 'href')) === 'albion-premium.html' &&
                    (await p.isVisible('#lien-premium')),
                'sans abonnement : « Aucun abonnement » et lien vers albion-premium.html',
            );
            t.verif(
                (await p.textContent('[data-champ="pts-statut"]')).includes('pas encore vérifiée'),
                'Pack ta Small : non vérifié',
            );
            await p.screenshot({ path: `shots/profil-sans-premium-${vp.nom}.png`, fullPage: true });
            t.verif(!erreurs.length, `aucune erreur JS ${erreurs.join(' | ')}`);
            await p.close();
        }

        // 4. Suppression du compte : il faut taper SUPPRIMER
        {
            const { p, erreurs, appelsFonctions } = await ouvrir(vp, {
                fonctions: { 'supprimer-compte': { status: 200, body: { ok: true } } },
            });
            await pret(p);
            await p.click('#btn-suppression');
            t.verif(
                await p.evaluate(() => document.getElementById('dialogue-suppression').open),
                'dialogue de suppression ouvert',
            );
            t.verif(
                await p.evaluate(() => document.activeElement?.id === 'champ-confirmation'),
                'focus placé dans le champ de confirmation',
            );
            const desactive = await p.isDisabled('#btn-confirmer-suppression');
            await p.fill('#champ-confirmation', 'SUPPRIME');
            const toujours = await p.isDisabled('#btn-confirmer-suppression');
            await p.screenshot({ path: `shots/profil-suppression-${vp.nom}.png` });
            t.verif(desactive && toujours, 'bouton désactivé tant que « SUPPRIMER » n’est pas tapé');
            await p.keyboard.press('Escape');
            t.verif(
                !(await p.evaluate(() => document.getElementById('dialogue-suppression').open)) &&
                    (await p.evaluate(() => document.activeElement?.id === 'btn-suppression')),
                'Échap ferme le dialogue, le focus revient sur le bouton',
            );
            t.verif(!appelsFonctions.length, 'aucun appel tant que la suppression n’est pas confirmée');
            await p.click('#btn-suppression');
            await p.fill('#champ-confirmation', 'SUPPRIMER');
            t.verif(!(await p.isDisabled('#btn-confirmer-suppression')), 'bouton activé après « SUPPRIMER »');
            await p.click('#btn-confirmer-suppression');
            await p.waitForURL(/index\.html$/, { timeout: 8000 }).catch(() => {});
            const s = appelsFonctions.find((a) => a.nom === 'supprimer-compte');
            t.verif(
                !!s &&
                    s.corps?.confirmation === 'SUPPRIMER' &&
                    s.headers.authorization === 'Bearer jwt-test' &&
                    p.url().endsWith('index.html'),
                'appel supprimer-compte ({confirmation:"SUPPRIMER"}, JWT) puis retour à l’accueil',
            );
            t.verif(!erreurs.length, `aucune erreur JS ${erreurs.join(' | ')}`);
            await p.close();
        }

        // 5. Déconnexion de tous les appareils : signOut global
        {
            const { p, erreurs } = await ouvrir(vp);
            await pret(p);
            await p.click('#btn-deconnexion-partout');
            await p.waitForURL(/index\.html$/, { timeout: 8000 }).catch(() => {});
            const scope = await p.evaluate(() => sessionStorage.getItem('__faux_signOut'));
            t.verif(
                scope === 'global' && p.url().endsWith('index.html'),
                'déconnexion de tous les appareils : signOut({scope:"global"}) puis accueil',
            );
            t.verif(!erreurs.length, `aucune erreur JS ${erreurs.join(' | ')}`);
            await p.close();
        }

        // 6. Retour de Stripe (?paiement=ok) : message puis accès rafraîchi
        {
            const { p, erreurs } = await ouvrir(vp, { acces: INACTIF, url: 'profil.html?paiement=ok' });
            await pret(p);
            t.verif(
                (await p.textContent('#profil-statut')).includes('quelques secondes') &&
                    !p.url().includes('paiement=ok'),
                '?paiement=ok : « l’accès peut prendre quelques secondes », paramètre retiré de l’adresse',
            );
            await p.evaluate(() => {
                globalThis.__FAUX__.rpc.mon_acces = [
                    { premium: true, premium_statut: 'actif', premium_fin: null, pts: false, pts_verifie_le: null },
                ];
            });
            await p
                .waitForFunction(
                    () => document.getElementById('profil-statut').textContent.includes('est actif'),
                    null,
                    {
                        timeout: 8000,
                    },
                )
                .catch(() => {});
            const n = await p.evaluate(
                () => globalThis.__APPELS__.filter((a) => a.type === 'rpc' && a.nom === 'mon_acces').length,
            );
            t.verif(
                n >= 2 && (await p.textContent('[data-champ="premium-statut"]')) === 'Actif',
                `monAcces rafraîchi (${n} lectures) jusqu’à l’activation du Premium`,
            );
            t.verif(!erreurs.length, `aucune erreur JS ${erreurs.join(' | ')}`);
            await p.close();
        }
    }

    // 7. Sans JS : rien de personnel, message explicite
    {
        const p = await browser.newPage({ javaScriptEnabled: false });
        await preparer(p, { serveurUrl: serveur.url });
        await p.goto(serveur.url + 'profil.html');
        const texte = await p.textContent('main');
        t.verif(
            texte.includes('besoin de JavaScript') && (await p.$$('#profil-contenu:not([hidden])')).length === 0,
            'sans JS : message « besoin de JavaScript », aucun bloc de compte affiché',
        );
        await p.close();
    }
} catch (e) {
    console.error(`\n  ✗ test interrompu : ${e.message.split('\n')[0]}`);
    t.echecs++;
} finally {
    await browser.close();
    serveur.fermer();
}
const echecs = t.echecs;
console.log(echecs ? `\n${echecs} test(s) en échec.` : '\nTous les tests passent.');
process.exit(echecs ? 1 : 0);
