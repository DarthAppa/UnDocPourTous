// Lecture prudente des requêtes (logique pure, testée par tools/test-fonctions.mjs).

export const TAILLE_MAX_CORPS = 10_000; // octets ; nos corps JSON font quelques dizaines d'octets

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function estUuid(valeur) {
    return typeof valeur === 'string' && UUID.test(valeur);
}

// "Bearer xxx" → "xxx" (null si absent ou mal formé).
export function jetonBearer(enTete) {
    const m = /^Bearer\s+([A-Za-z0-9._~+/=-]+)$/.exec(String(enTete ?? '').trim());
    return m ? m[1] : null;
}

// Corps JSON attendu : un objet. Renvoie { ok, valeur } sans jamais lever d'exception.
export function analyserCorps(texte, max = TAILLE_MAX_CORPS) {
    if (typeof texte !== 'string' || texte.length > max) return { ok: false };
    try {
        const valeur = JSON.parse(texte);
        if (valeur === null || typeof valeur !== 'object' || Array.isArray(valeur)) return { ok: false };
        return { ok: true, valeur };
    } catch {
        return { ok: false };
    }
}

// SITE_URL → base sans « / » final. Seul https est accepté, sauf en local (127.0.0.1 / localhost).
export function baseSite(siteUrl) {
    const base = String(siteUrl ?? '')
        .trim()
        .replace(/\/+$/, '');
    if (/^https:\/\/[a-z0-9.-]+(:\d+)?(\/[A-Za-z0-9._~/-]*)?$/i.test(base)) return base;
    if (/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?(\/[A-Za-z0-9._~/-]*)?$/i.test(base)) return base;
    return null;
}

// Suppression de compte : la confirmation doit être exactement « SUPPRIMER ».
export function confirmationSuppressionValide(corps) {
    return corps !== null && typeof corps === 'object' && corps.confirmation === 'SUPPRIMER';
}
