// Config Tailwind du site (compilée par tools/build-css.mjs → assets/css/tailwind.css).
// Chaque couleur a son équivalent --var dans style.css : à modifier aux deux endroits,
// puis lancer `npm run build:css` et committer assets/css/tailwind.css (GitHub Pages ne compile rien).
module.exports = {
    // Pages faites à la main + scripts du site. Les pages Pack ta Small générées
    // (pts-encyclopedie.html, pts-builder.html) ont leur propre CSS et n'utilisent pas Tailwind.
    content: ['./*.html', './*.js', '!./pts-encyclopedie.html', '!./pts-builder.html'],
    theme: {
        extend: {
            colors: {
                darkBg: '#0B0F17', // fond de page
                footerBg: '#080C12', // pied de page, zones creuses
                cardBg: '#141B26', // cartes, panneaux
                cardBorder: '#293340', // bordures
                iconBg: '#1A2330', // fond de l'emblème
                textLight: '#F5F5F0', // texte principal
                textMuted: '#9BA7B6', // texte secondaire
                textFaint: '#7C8A9C', // légendes, séparateurs
                mintFree: '#72E5BB', // gratuit (accent principal)
                mintDeep: '#152D29', // fond badge / bouton gratuit
                mintLine: '#345D50', // bordure carte gratuite
                mintText: '#C6D8D2', // sous-titre sur carte gratuite
                brandOrange: '#F5A065', // premium
                brandOrangeHover: '#F7B27C',
                premiumDeep: '#30231E', // fond badge / formule premium
                holo: '#5EE7FF',
                ptsInk: '#070909', // Pack ta Small : fond
                ptsGold: '#D9A64F', // Pack ta Small : or vif
                ptsGoldPale: '#D8C091', // Pack ta Small : or pâle (texte)
            },
            fontFamily: {
                sans: ['Inter', 'sans-serif'],
                mono: ['"IBM Plex Mono"', 'monospace'],
                serif: ['Lora', 'serif'],
                pts: ['Cinzel', 'Georgia', 'serif'],
            },
        },
    },
    plugins: [],
};
