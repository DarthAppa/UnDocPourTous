// ==========================================
//   UnDocPourTous — Script principal
// ==========================================
document.documentElement.classList.replace('no-js', 'js');

document.addEventListener('DOMContentLoaded', () => {

    /* ---------- Menu mobile ---------- */
    const burger = document.getElementById('burger');
    const mobileMenu = document.getElementById('mobile-menu');
    burger?.addEventListener('click', () => {
        const hidden = mobileMenu.classList.toggle('hidden');
        burger.setAttribute('aria-expanded', String(!hidden));
    });

    /* ---------- Paiement : rappel de la formule choisie ---------- */
    const choisie = document.getElementById('formule-choisie');
    document.querySelectorAll('input[name="formule"]').forEach(radio => {
        radio.addEventListener('change', () => { if (choisie && radio.checked) choisie.textContent = radio.value; });
    });

    /* ---------- Apparition au scroll ---------- */
    const io = new IntersectionObserver(entries => {
        entries.forEach(en => {
            if (en.isIntersecting) {
                const el = en.target;
                el.classList.add('visible');
                io.unobserve(el);
                // L'apparition terminée, on retire .reveal : le survol des cartes n'est plus ralenti par le délai
                const delay = parseFloat(getComputedStyle(el).getPropertyValue('--d')) || 0;
                setTimeout(() => el.classList.remove('reveal', 'visible'), (delay + 0.7) * 1000);
            }
        });
    }, { threshold: 0.15 });
    document.querySelectorAll('.reveal').forEach(el => io.observe(el));
});
