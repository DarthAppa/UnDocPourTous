// Adresse propre dans la barre du navigateur (demande de Cyril, 15/10/2026) :
// - en ligne, « /pts-encyclopedie.html » devient « /pts-encyclopedie » (et « /index.html » devient « / ») ;
//   GitHub Pages sert ces adresses sans .html : F5, favoris et liens partagés marchent toujours ;
// - partout, les ancres internes (#ch21…) ne s'affichent plus : le clic fait défiler sans changer l'adresse.
// Script classique chargé dans le <head> (pas de defer) : l'adresse est nettoyée avant les autres scripts.
// Les paramètres (?code=, ?retour=…) et les fragments techniques (#error=…) ne sont jamais touchés.
(function () {
    'use strict';
    const hote = location.hostname;
    const enLigne = hote === 'undocpourtous.com' || hote === 'www.undocpourtous.com';
    const ancre = /^#[A-Za-z][\w-]*$/;

    // 1. Chemin sans .html (en ligne seulement : les serveurs de test locaux ne servent pas ces adresses)
    const chemin = location.pathname;
    const propre = chemin.replace(/\/index\.html$/, '/').replace(/\.html$/, '');
    if (enLigne && propre !== chemin) {
        history.replaceState(history.state, '', propre + location.search + location.hash);
    }

    // 2. Ancre à l'arrivée (lien partagé « …#ch10 ») : on retire le # et on garde la section visée à l'écran.
    //    Les pages PTS reçoivent leur contenu après la vérification du compte (pts-outil.js) :
    //    on recale donc le défilement tant que la mise en page bouge (voir plus bas).
    const visee = ancre.test(location.hash) ? location.hash.slice(1) : '';
    if (visee) {
        const recaler = function () {
            const el = document.getElementById(visee);
            if (el) el.scrollIntoView({ block: 'start', behavior: 'instant' }); // « auto » suivrait scroll-behavior: smooth
        };
        window.addEventListener('load', function () {
            history.replaceState(history.state, '', location.pathname + location.search);
            recaler();
            // La page peut encore bouger (dévoilement PTS, polices, contenu construit en JS) : on recale à
            // chaque changement de mise en page pendant 6 s, sauf si la personne fait défiler elle-même.
            const racine = document.documentElement;
            const suivi = [];
            const arreter = function () {
                suivi.forEach(function (f) {
                    f();
                });
                suivi.length = 0;
            };
            const obsClasse = new MutationObserver(function () {
                if (!racine.classList.contains('pts-attente')) requestAnimationFrame(recaler);
            });
            obsClasse.observe(racine, { attributes: true, attributeFilter: ['class'] });
            suivi.push(function () {
                obsClasse.disconnect();
            });
            if (window.ResizeObserver) {
                const obsTaille = new ResizeObserver(function () {
                    requestAnimationFrame(recaler);
                });
                obsTaille.observe(document.body);
                suivi.push(function () {
                    obsTaille.disconnect();
                });
            }
            ['wheel', 'touchstart', 'keydown', 'pointerdown'].forEach(function (type) {
                window.addEventListener(type, arreter, { once: true, passive: true });
                suivi.push(function () {
                    window.removeEventListener(type, arreter);
                });
            });
            setTimeout(arreter, 6000);
        });
    }

    // 3. Clic sur un lien interne « #section » : défilement sans # dans l'adresse
    document.addEventListener('click', function (e) {
        if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        const lien = e.target.closest && e.target.closest('a[href^="#"]');
        if (!lien) return;
        const href = lien.getAttribute('href');
        if (!ancre.test(href)) return;
        const cible = document.getElementById(href.slice(1));
        if (!cible) return;
        e.preventDefault();
        const doux = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        cible.scrollIntoView({ block: 'start', behavior: doux ? 'smooth' : 'instant' });
        // Clavier et lecteurs d'écran : le focus suit le défilement
        if (!cible.hasAttribute('tabindex') && !/^(A|BUTTON|INPUT|SELECT|TEXTAREA)$/.test(cible.tagName)) {
            cible.setAttribute('tabindex', '-1');
        }
        cible.focus({ preventScroll: true });
    });
})();
