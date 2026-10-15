// ==========================================
//   UnDocPourTous — Script principal
// ==========================================
document.documentElement.classList.replace('no-js', 'js');

document.addEventListener('DOMContentLoaded', () => {
    /* ---------- Lien de la page en cours (aria-current) ---------- */
    // En ligne, l'adresse est « /albion » (adresse.js) : on remet le .html pour comparer aux liens
    const dernier = location.pathname.split('/').pop() || 'index';
    const pageCourante = dernier.endsWith('.html') ? dernier : `${dernier}.html`;
    document.querySelectorAll('.nav-link').forEach((a) => {
        if (a.getAttribute('href') === pageCourante) a.setAttribute('aria-current', 'page');
    });

    /* ---------- Menu mobile ---------- */
    const burger = document.getElementById('burger');
    const mobileMenu = document.getElementById('mobile-menu');
    if (burger && mobileMenu) {
        const ouvrir = (ouvert) => {
            mobileMenu.classList.toggle('hidden', !ouvert);
            burger.setAttribute('aria-expanded', String(ouvert));
        };
        burger.addEventListener('click', () => ouvrir(mobileMenu.classList.contains('hidden')));
        // Fermer au clic sur un lien (ex. « Jeux » qui reste sur la même page) et avec Échap
        mobileMenu.addEventListener('click', (e) => {
            if (e.target.closest('a')) ouvrir(false);
        });
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && !mobileMenu.classList.contains('hidden')) {
                ouvrir(false);
                burger.focus();
            }
        });
    }

    /* ---------- Paiement : rappel de la formule choisie ---------- */
    const choisie = document.getElementById('formule-choisie');
    document.querySelectorAll('input[name="formule"]').forEach((radio) => {
        radio.addEventListener('change', () => {
            if (choisie && radio.checked) choisie.textContent = radio.value;
        });
    });

    /* ---------- Apparition au scroll ---------- */
    const blocs = document.querySelectorAll('.reveal');
    if (!('IntersectionObserver' in window)) {
        // Navigateur trop ancien : on montre tout plutôt que de laisser des blocs invisibles
        blocs.forEach((el) => el.classList.remove('reveal'));
        return;
    }
    const io = new IntersectionObserver(
        (entries) => {
            entries.forEach((en) => {
                if (en.isIntersecting) {
                    const el = en.target;
                    el.classList.add('visible');
                    io.unobserve(el);
                    // L'apparition terminée, on retire .reveal : le survol des cartes n'est plus ralenti par le délai
                    const delay = parseFloat(getComputedStyle(el).getPropertyValue('--d')) || 0;
                    setTimeout(() => el.classList.remove('reveal', 'visible'), (delay + 0.7) * 1000);
                }
            });
        },
        { threshold: 0.15 },
    );
    blocs.forEach((el) => io.observe(el));
});
