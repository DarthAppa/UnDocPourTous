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

    /* ---------- Contenu des écrans holographiques ---------- */
    const table = document.getElementById('holo-table');
    if (table) {
        for (let i = 0; i < 9; i++) {
            const row = document.createElement('div');
            row.className = 'holo-row' + (i === 2 || i === 6 ? ' hl' : '');
            row.innerHTML = '<b></b><b></b><b></b><b></b>';
            row.children[1].style.width = 55 + Math.random() * 45 + '%';
            row.children[2].style.width = 40 + Math.random() * 60 + '%';
            table.appendChild(row);
        }
    }

    const inventory = document.getElementById('inventory');
    if (inventory) {
        const colors = ['#ff7a1a', '#5ee7ff', '#2ec4a6', '#b06cff', '#ffd27a', 'transparent'];
        for (let i = 0; i < 16; i++) {
            const slot = document.createElement('div');
            slot.className = 'inv-slot';
            slot.style.setProperty('--c', colors[Math.floor(Math.random() * colors.length)]);
            inventory.appendChild(slot);
        }
    }

    const bars = document.getElementById('bars');
    const barEls = [];
    if (bars) {
        for (let i = 0; i < 7; i++) {
            const b = document.createElement('i');
            b.style.height = 20 + Math.random() * 80 + '%';
            bars.appendChild(b);
            barEls.push(b);
        }
    }

    const donut = document.querySelector('.donut');

    // Animation "données live"
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!reduced) {
        setInterval(() => {
            barEls.forEach(b => (b.style.height = 20 + Math.random() * 80 + '%'));
            donut?.style.setProperty('--p', 55 + Math.round(Math.random() * 25) + '%');
        }, 2200);
    }

    /* ---------- Parallaxe des écrans à la souris ---------- */
    const hero = document.getElementById('hero');
    const screens = document.querySelectorAll('.holo-screen');
    if (hero && !reduced && window.matchMedia('(pointer: fine)').matches) {
        hero.addEventListener('mousemove', e => {
            const r = hero.getBoundingClientRect();
            const x = (e.clientX - r.left) / r.width - 0.5;
            const y = (e.clientY - r.top) / r.height - 0.5;
            screens.forEach(s => {
                const d = Number(s.dataset.depth) || 10;
                s.style.setProperty('--px', `${-x * d}px`);
                s.style.setProperty('--py', `${-y * d}px`);
            });
        });
        hero.addEventListener('mouseleave', () => screens.forEach(s => {
            s.style.setProperty('--px', '0px');
            s.style.setProperty('--py', '0px');
        }));
    }

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
