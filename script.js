// ==========================================
//   UnDocPourTout — Script principal
// ==========================================
document.documentElement.classList.replace('no-js', 'js');

document.addEventListener('DOMContentLoaded', () => {

    /* ---------- Défilement doux sur les ancres ---------- */
    document.querySelectorAll('a[href^="#"]').forEach(link => {
        link.addEventListener('click', e => {
            const id = link.getAttribute('href');
            if (id.length < 2) return;
            const target = document.querySelector(id);
            if (target) {
                e.preventDefault();
                target.scrollIntoView({ behavior: 'smooth', block: 'start' });
                mobileMenu?.classList.add('hidden');
            }
        });
    });

    /* ---------- Dropdowns (clic, utile sur tactile) ---------- */
    const dropdowns = document.querySelectorAll('.dropdown');
    dropdowns.forEach(dd => {
        dd.querySelector('.dropdown-toggle').addEventListener('click', e => {
            e.stopPropagation();
            const open = !dd.classList.contains('open');
            dropdowns.forEach(d => d.classList.remove('open'));
            dd.classList.toggle('open', open);
            e.currentTarget.setAttribute('aria-expanded', open);
        });
    });
    document.addEventListener('click', () => dropdowns.forEach(d => d.classList.remove('open')));

    /* ---------- Menu mobile ---------- */
    const burger = document.getElementById('burger');
    const mobileMenu = document.getElementById('mobile-menu');
    burger?.addEventListener('click', () => mobileMenu.classList.toggle('hidden'));

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;


    /* ---------- Sparkline Market Tracker ---------- */
    const spark = document.getElementById('spark');
    if (spark) {
        let pts = Array.from({ length: 24 }, () => 14);
        const draw = () => {
            spark.setAttribute('points', pts.map((v, i) => `${(i / (pts.length - 1)) * 120},${v}`).join(' '));
        };
        const step = () => {
            const last = pts[pts.length - 1];
            pts = [...pts.slice(1), Math.max(3, Math.min(25, last + (Math.random() - 0.48) * 6))];
            draw();
        };
        for (let i = 0; i < 24; i++) step();
        if (!reduced) setInterval(step, 1200);
    }

    /* ---------- Apparition au scroll ---------- */
    const io = new IntersectionObserver(entries => {
        entries.forEach(en => {
            if (en.isIntersecting) { en.target.classList.add('visible'); io.unobserve(en.target); }
        });
    }, { threshold: 0.15 });
    document.querySelectorAll('.reveal').forEach(el => io.observe(el));
});
