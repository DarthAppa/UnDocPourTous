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

// Éditeur du site (mentions légales). À la création de la micro-entreprise : remplir siret et adresse
// (adresse de domiciliation possible) ; ils s'affichent alors automatiquement dans les pages légales.
export const EDITEUR = {
    nom: 'Cyril Bellucci',
    statut: 'Particulier (micro-entreprise en cours de création)',
    siret: '',
    adresse: '',
    contact: 'contact@undocpourtous.com',
};

// Hébergeur du site (pages HTML)
export const HEBERGEUR = {
    nom: 'GitHub, Inc. (service GitHub Pages)',
    adresse: '88 Colin P. Kelly Jr. Street, San Francisco, CA 94107, États-Unis',
    site: 'https://github.com',
};

// Date de dernière mise à jour des pages légales
export const MAJ_LEGAL = '14 octobre 2026';
