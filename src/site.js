// Données du site définies UNE seule fois (CLAUDE.md) : réutilisées par le gabarit et les composants.
export const SITE = {
    nom: 'UnDocPourTous',
    url: 'https://undocpourtous.com',
    langue: 'fr',
    locale: 'fr_FR',
};

// Polices Google (Inter, IBM Plex Mono, Lora ; Cinzel en plus sur les pages Pack ta Small)
const FAMILLES = 'family=IBM+Plex+Mono:wght@400;500;600&family=Inter:wght@400;500;600;700&family=Lora:wght@700';
export const polices = (cinzel = false) =>
    `https://fonts.googleapis.com/css2?${FAMILLES}${cinzel ? '&family=Cinzel:wght@600;700' : ''}&display=swap`;
