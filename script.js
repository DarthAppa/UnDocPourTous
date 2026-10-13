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
            if (en.isIntersecting) { en.target.classList.add('visible'); io.unobserve(en.target); }
        });
    }, { threshold: 0.15 });
    document.querySelectorAll('.reveal').forEach(el => io.observe(el));
});
