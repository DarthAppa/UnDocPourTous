// Teste la fenêtre de connexion / inscription (auth-modal.js, ouverte par « Connexion » dans l'en-tête)
// avec un faux Supabase : onglets, inscription, connexion, erreurs, mot de passe oublié, retour ?code=….
// Usage : npm run build puis node tools/test-connexion.mjs   (HORS_LIGNE=1 dans un conteneur sans Internet)
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { demarrer } from './serveur.mjs';
import { preparer, SESSION, compteur, VUES } from './faux-supabase.mjs';
import { PTS_CONFIG } from '../public/assets/js/pts-config.js';

const serveur = await demarrer();
const browser = await chromium.launch();
mkdirSync('shots', { recursive: true });
const t = compteur();
const MIN = PTS_CONFIG.MDP_MIN;

async function ouvrir(vp, { url = 'index.html', session = null, auth = {} } = {}) {
    const p = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
    p.setDefaultTimeout(8000);
    const erreurs = [];
    p.on('pageerror', (e) => erreurs.push(e.message));
    const sorties = [];
    p.on('request', (r) => sorties.push(r.url()));
    await preparer(p, { serveurUrl: serveur.url, cleStockee: !!session, faux: { session, auth } });
    await p.goto(serveur.url + url);
    const appels = () => p.evaluate(() => globalThis.__APPELS__ || []);
    return { p, erreurs, sorties, appels };
}
const modale = (p) => p.locator('dialog.auth-modal');
const ouverte = (p) => p.evaluate(() => !!document.querySelector('dialog.auth-modal')?.open);
const message = (p) => p.locator('[data-msg]').textContent();

for (const vp of VUES) {
    console.log(`\n[${vp.nom} ${vp.width}px]`);

    // 1. Ouverture, onglets, fermeture
    {
        const { p, erreurs } = await ouvrir(vp);
        await p.click('a.btn-login');
        await modale(p).waitFor();
        t.verif(await ouverte(p), 'clic sur « Connexion » : la fenêtre s’ouvre (pas de changement de page)');
        t.verif(p.url().endsWith('index.html'), 'on reste sur la page');
        const boutons = await p
            .locator('[data-fournisseur]')
            .evaluateAll((b) => b.map((x) => [x.dataset.fournisseur, x.disabled]));
        t.verif(
            JSON.stringify(boutons) ===
                JSON.stringify([
                    ['google', false],
                    ['discord', false],
                    ['twitch', false],
                ]),
            `connexions rapides actives : ${boutons.map((b) => b[0]).join(', ')}`,
        );
        await p.click('#auth-t-inscription');
        t.verif(
            (await p.isVisible('#auth-p-inscription')) && !(await p.isVisible('#auth-p-connexion')),
            'onglet « S’inscrire » affiché',
        );
        t.verif(
            (await p.getAttribute('#auth-p-inscription [name="mdp"]', 'minlength')) === String(MIN),
            `mot de passe : ${MIN} caractères minimum (comme Supabase)`,
        );
        t.verif(
            (await p.getAttribute('#auth-t-inscription', 'aria-selected')) === 'true',
            'onglet « S’inscrire » marqué sélectionné',
        );
        await p.waitForTimeout(400); // fin de la transition des onglets
        await p.screenshot({ path: `shots/connexion-modale-${vp.nom}.png` });
        await p.keyboard.press('Escape');
        t.verif(!(await ouverte(p)), 'Échap ferme la fenêtre');
        const largeur = await p.evaluate(() => document.documentElement.scrollWidth);
        t.verif(largeur <= vp.width, `pas de débordement horizontal (${largeur}px)`);
        t.verif(!erreurs.length, `aucune erreur JS ${erreurs.join(' | ')}`);
        await p.close();
    }

    // 2. Inscription (e-mail à confirmer) puis compte déjà existant
    {
        const { p, appels } = await ouvrir(vp);
        await p.click('a.btn-login');
        await p.click('#auth-t-inscription');
        await p.fill('#auth-p-inscription [name="pseudo"]', 'Apparance');
        await p.fill('#auth-p-inscription [name="email"]', 'joueur@example.com');
        await p.fill('#auth-p-inscription [name="mdp"]', 'court');
        await p.check('#auth-p-inscription [name="cgu"]');
        await p.click('#auth-p-inscription button[type="submit"]');
        t.verif(
            !(await appels()).some((a) => a.type === 'signUp'),
            'mot de passe trop court : rien n’est envoyé (validation du formulaire)',
        );
        await p.fill('#auth-p-inscription [name="mdp"]', 'unbonmotdepasse');
        await p.click('#auth-p-inscription button[type="submit"]');
        await p.waitForFunction(() => document.querySelector('[data-msg]').textContent.includes('boîte mail'));
        const signUp = (await appels()).find((a) => a.type === 'signUp');
        t.verif(
            signUp?.pseudo === 'Apparance' && signUp.redirection === serveur.url + 'index.html',
            'inscription : pseudo envoyé, lien de confirmation vers la page (sans paramètres)',
        );
        t.verif((await message(p)).includes('Vérifie ta boîte mail'), 'message « Vérifie ta boîte mail »');
        await p.close();
    }
    {
        const { p } = await ouvrir(vp, { auth: { inscription: 'existe' } });
        await p.click('a.btn-login');
        await p.click('#auth-t-inscription');
        await p.fill('#auth-p-inscription [name="pseudo"]', 'Apparance');
        await p.fill('#auth-p-inscription [name="email"]', 'joueur@example.com');
        await p.fill('#auth-p-inscription [name="mdp"]', 'unbonmotdepasse');
        await p.check('#auth-p-inscription [name="cgu"]');
        await p.click('#auth-p-inscription button[type="submit"]');
        await p.waitForFunction(() => document.querySelector('[data-msg]').textContent.length > 0);
        t.verif((await message(p)).includes('existe déjà'), 'e-mail déjà inscrit : « Un compte existe déjà »');
        await p.close();
    }

    // 3. Connexion : refusée puis réussie (l'en-tête passe à « Mon profil » à la fermeture)
    {
        const { p } = await ouvrir(vp, { auth: { connexion: 'refus' } });
        await p.click('a.btn-login');
        await p.fill('#auth-p-connexion [name="email"]', 'joueur@example.com');
        await p.fill('#auth-p-connexion [name="mdp"]', 'mauvaismotdepasse');
        await p.click('#auth-p-connexion button[type="submit"]');
        await p.waitForFunction(() => document.querySelector('[data-msg]').textContent.length > 0);
        t.verif(
            (await message(p)).includes('incorrect'),
            'mauvais mot de passe : « E-mail ou mot de passe incorrect »',
        );
        await p.close();
    }
    {
        const { p, erreurs } = await ouvrir(vp);
        await p.click('a.btn-login');
        await p.fill('#auth-p-connexion [name="email"]', 'joueur@example.com');
        await p.fill('#auth-p-connexion [name="mdp"]', 'unbonmotdepasse');
        await p.click('#auth-p-connexion button[type="submit"]');
        await p.waitForFunction(() => document.querySelector('[data-msg]').textContent.includes('réussie'));
        t.verif(await p.isVisible('[data-vue="connecte"]'), 'connexion réussie : « Connecté en tant que … »');
        await Promise.all([p.waitForEvent('load'), p.click('[data-fermer]')]);
        t.verif(
            (await p.locator('a.btn-login').getAttribute('href')) === 'profil.html',
            'après fermeture : la page se recharge et l’en-tête affiche « Mon profil »',
        );
        t.verif(!erreurs.length, `aucune erreur JS ${erreurs.join(' | ')}`);
        await p.close();
    }

    // 4. Connexion rapide Google : redirection vers Supabase avec retour sur la page
    {
        const { p, sorties } = await ouvrir(vp, { url: 'albion.html?x=1' });
        await p.click('a.btn-login');
        await p.click('[data-fournisseur="google"]');
        await p.waitForTimeout(500);
        const auth = sorties.find((u) => u.includes('/auth/v1/authorize'));
        const retour = auth && new URL(auth).searchParams.get('redirect_to');
        t.verif(
            !!auth && new URL(auth).searchParams.get('provider') === 'google' && retour === serveur.url + 'albion.html',
            'Google : vers Supabase, retour sur la page sans paramètres',
        );
        await p.close();
    }

    // 5. Mot de passe oublié
    {
        const { p, appels } = await ouvrir(vp);
        await p.click('a.btn-login');
        await p.click('[data-oublie]');
        t.verif((await message(p)).includes('Saisis ton e-mail'), 'mot de passe oublié sans e-mail : demande l’e-mail');
        await p.fill('#auth-p-connexion [name="email"]', 'joueur@example.com');
        await p.click('[data-oublie]');
        await p.waitForFunction(() => document.querySelector('[data-msg]').textContent.includes('réinitialisation'));
        const r = (await appels()).find((a) => a.type === 'resetPasswordForEmail');
        t.verif(
            r?.redirection === serveur.url + 'index.html?reinit=1',
            'mot de passe oublié : lien de retour vers la page avec ?reinit=1',
        );
        await p.close();
    }

    // 6. Retours par lien (?code=…)
    {
        // Le vrai client enregistre la session pendant l'échange du code : simulé ici par la clé déjà présente
        const { p, erreurs } = await ouvrir(vp, { url: 'albion.html?code=abc', session: SESSION });
        await p.waitForURL((u) => !u.search.includes('code'));
        // la page se recharge sur l'adresse propre : on attend l'en-tête à jour (attente qui survit au rechargement)
        await p
            .locator('a.btn-login[href="profil.html"]')
            .waitFor()
            .catch(() => {});
        t.verif(
            p.url() === serveur.url + 'albion.html',
            'retour Google/confirmation : adresse nettoyée (plus de ?code)',
        );
        t.verif(
            (await p.locator('a.btn-login').getAttribute('href')) === 'profil.html',
            'retour avec session : en-tête « Mon profil »',
        );
        t.verif(!erreurs.length, `aucune erreur JS ${erreurs.join(' | ')}`);
        await p.close();
    }
    {
        const { p, appels } = await ouvrir(vp, { url: 'index.html?code=abc&reinit=1', session: SESSION });
        await p.locator('[data-vue="nouveau-mdp"]').waitFor();
        t.verif(
            (await ouverte(p)) && p.url() === serveur.url + 'index.html',
            'lien de réinitialisation : fenêtre « nouveau mot de passe », adresse nettoyée',
        );
        await p.fill('[data-vue="nouveau-mdp"] [name="mdp"]', 'nouveaumotdepasse');
        await p.fill('[data-vue="nouveau-mdp"] [name="mdp2"]', 'autrechosequececi');
        await p.click('[data-vue="nouveau-mdp"] button[type="submit"]');
        await p.waitForFunction(() => document.querySelector('[data-msg]').textContent.length > 0);
        t.verif((await message(p)).includes('pas identiques'), 'confirmation différente : refusée');
        await p.fill('[data-vue="nouveau-mdp"] [name="mdp2"]', 'nouveaumotdepasse');
        await p.click('[data-vue="nouveau-mdp"] button[type="submit"]');
        await p.waitForFunction(() => document.querySelector('[data-msg]').textContent.includes('enregistré'));
        t.verif(
            (await appels()).some((a) => a.type === 'updateUser' && a.motDePasse),
            'nouveau mot de passe enregistré (updateUser)',
        );
        await p.close();
    }
    {
        const { p } = await ouvrir(vp, { url: 'index.html?error=access_denied&error_description=refus' });
        await modale(p).waitFor();
        t.verif(
            (await ouverte(p)) && (await message(p)).includes('Connexion impossible'),
            'retour en erreur : fenêtre ouverte avec « Connexion impossible »',
        );
        t.verif(p.url() === serveur.url + 'index.html', 'adresse nettoyée');
        await p.close();
    }

    // 7. Déjà connecté : « Mon profil » est un lien normal (pas de fenêtre)
    {
        const { p } = await ouvrir(vp, { session: SESSION });
        t.verif(
            (await p.locator('a.btn-login').getAttribute('href')) === 'profil.html' &&
                !(await p.evaluate(() => !!document.querySelector('dialog.auth-modal'))),
            'connecté : « Mon profil » mène au profil, pas de fenêtre',
        );
        await p.close();
    }
}

await browser.close();
serveur.fermer();
console.log(t.echecs ? `\n${t.echecs} échec(s).` : '\nTous les tests passent.');
process.exit(t.echecs ? 1 : 0);
