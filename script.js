
// ==========================================
//   UnDocPourTout.com — Script Principal JS
// ==========================================

document.addEventListener('DOMContentLoaded', () => {
    console.log("UnDocPourTout.com — Environnement JS & Dashboards initialisé.");

    // Exemple d'interactivité fluide au clic sur les ancres
    const links = document.querySelectorAll('a[href^="#"]');
    links.forEach(link => {
        link.addEventListener('click', function(e) {
            const targetId = this.getAttribute('href');
            if (targetId === '#') return;
            
            const targetElement = document.querySelector(targetId);
            if (targetElement) {
                e.preventDefault();
                targetElement.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });
});
