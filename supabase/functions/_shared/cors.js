// CORS des Edge Functions : seules les origines de SITE_ORIGINS reçoivent
// Access-Control-Allow-Origin. Logique pure (aucune API Deno), testée par tools/test-fonctions.mjs.

const EN_TETES_AUTORISES = 'authorization, content-type, apikey, x-client-info';

// "https://a.com, http://127.0.0.1:5500/" → ['https://a.com', 'http://127.0.0.1:5500']
export function lireOrigines(texte) {
    return String(texte ?? '')
        .split(',')
        .map((o) => o.trim().replace(/\/+$/, ''))
        .filter((o) => /^https?:\/\/[^/\s]+$/.test(o));
}

export function origineAutorisee(origine, origines) {
    return typeof origine === 'string' && origine !== '' && origines.includes(origine);
}

// Décide quoi faire d'une requête selon son en-tête Origin.
// - Origin absente (appel serveur à serveur, curl) : acceptée, sans en-tête CORS.
// - Origin autorisée : acceptée, en-têtes CORS pour cette origine seulement.
// - Origin non autorisée : refusée (403), sans Access-Control-Allow-Origin.
export function decisionCors(origine, origines) {
    const base = { Vary: 'Origin' };
    if (origine === null || origine === undefined || origine === '') return { autorise: true, enTetes: base };
    if (!origineAutorisee(origine, origines)) return { autorise: false, enTetes: base };
    return {
        autorise: true,
        enTetes: {
            ...base,
            'Access-Control-Allow-Origin': origine,
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': EN_TETES_AUTORISES,
            'Access-Control-Max-Age': '600',
        },
    };
}
