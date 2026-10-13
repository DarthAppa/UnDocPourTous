// Règles des contenus protégés, partagées entre la base (contrainte SQL identique),
// l'outil tools/publier-contenu.mjs et les tests.

export const NIVEAUX = ['premium', 'pts'];

export function slugValide(slug) {
    return typeof slug === 'string' && slug.length >= 1 && slug.length <= 100 && /^[a-z0-9-]+$/.test(slug);
}

export function niveauValide(niveau) {
    return NIVEAUX.includes(niveau);
}

export function titreValide(titre) {
    return typeof titre === 'string' && titre.trim().length >= 1 && titre.length <= 200;
}
