// Builder Ma collection (pts-builder.html) : charge la collection DU JOUEUR CONNECTÉ, puis lance le builder.
// La collection est envoyée dans Supabase par l'extension PTS Companion (table collections, lisible
// seulement par son propriétaire grâce à la RLS). Rien n'est écrit dans la page publique.
// Format attendu par le builder (script #pts-coll) : [NOM, note, variante, [armes], valeur, [fills T,S,H,D]].
import { etat, maCollection } from './pts-auth.js';

const VARIANTES = [
    'economist',
    'reviewer',
    'joker',
    'recruiter',
    'guildmaster',
    'fillall',
    'caller',
    'goat',
    'legende',
    'epique',
];
// Noms du builder dont la clé du site diffère (pkey) ; FERHAT et CRAZORAK ont été renommés sur le site le 15/10/2026
const EXCEPTIONS = { RIMOVEE: 'rimove', HOLYBUDY: 'holybuddy', FERHAT: 'fehrat', CRAZORAK: 'crazorack' };
const cle = (n) =>
    EXCEPTIONS[n] ||
    String(n)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');

const json = (id, defaut) => {
    try {
        return JSON.parse(document.getElementById(id)?.textContent || '');
    } catch {
        return defaut;
    }
};

// Catalogue du builder : clé → { nom, armes, fills }
function catalogue() {
    const bd = json('pts-build', { P: [] });
    const parCle = new Map();
    for (const p of bd.P || []) {
        const fl = Array.isArray(p[4]) ? p[4].map((x) => (Number.isFinite(x) ? x : 50)) : [50, 50, 50, 50];
        parCle.set(cle(p[0]), {
            nom: p[0],
            armes: [p[2], p[3]].filter(Boolean).map((x) => String(x).toUpperCase()),
            fl,
        });
    }
    return parCle;
}

// Sépare « fannch-goat » en { base: 'fannch', variante: 'goat' }
function decouper(id) {
    const s = String(id || '').toLowerCase();
    for (const v of VARIANTES) if (s.endsWith(`-${v}`)) return { base: s.slice(0, -(v.length + 1)), variante: v };
    return { base: s, variante: 'base' };
}

const premier = (...valeurs) => valeurs.find((v) => v !== undefined && v !== null && v !== '');

function armesDe(c, wmap) {
    const brut = Array.isArray(c.weapons)
        ? c.weapons
        : [premier(c.weapon1, c.w1, c.primary, c.weapon), premier(c.weapon2, c.w2, c.secondary)];
    return brut
        .filter(Boolean)
        .map((w) => (typeof w === 'object' ? premier(w.id, w.key, w.name) : w))
        .map((w) => wmap[String(w).toLowerCase()] || String(w).toUpperCase())
        .filter(Boolean);
}

function fillsDe(c, meta) {
    const m = (meta && c.id != null && meta[c.id]) || {};
    const f = premier(c.fills, m.fills, typeof m.fill === 'object' ? m.fill : undefined);
    if (Array.isArray(f) && f.length === 4) return f.map((x) => (x <= 1 ? Math.round(x * 100) : Math.round(x)));
    if (f && typeof f === 'object') {
        const v = [f.tank ?? f.T, f.support ?? f.S, f.heal ?? f.H, f.dps ?? f.D];
        if (v.every((x) => Number.isFinite(x))) return v.map((x) => (x <= 1 ? Math.round(x * 100) : Math.round(x)));
    }
    return null;
}

// Collection Supabase → format du builder. Les cartes inconnues du catalogue sont ignorées (et comptées).
export function convertir(collection, parCle, wmap) {
    const roster = Array.isArray(collection?.roster) ? collection.roster : [];
    const meta = collection?.meta && typeof collection.meta === 'object' ? collection.meta : {};
    const cartes = [];
    let inconnues = 0;
    for (const c of roster) {
        if (!c || typeof c !== 'object') continue;
        const parts = decouper(premier(c.id, c.cardId, c.slug));
        const base = premier(c.playerKey, parts.base);
        const variante = premier(c.variant, parts.variante);
        // Cartes ajoutées par l'équipe du site : identifiant « adm-<pseudo> »
        const sansAdm = String(base).replace(/^adm-/, '');
        const ref =
            parCle.get(base) ||
            parCle.get(parts.base) ||
            parCle.get(sansAdm) ||
            (c.name ? parCle.get(cle(c.name)) : null);
        const note = Number(premier(c.overall, c.ovr, c.note, c.rating));
        if (!ref || !Number.isFinite(note)) {
            inconnues++;
            continue;
        }
        const armes = armesDe(c, wmap);
        // Valeur des cartes passives : % d'or (Économiste), Collectif (Joker), bonus (GM)
        const valeur = premier(c.economistGoldPct, c.jokerCollectif, c.gmBonusPct, c.value, c.val, null);
        cartes.push([ref.nom, note, variante, armes.length ? armes : ref.armes, valeur, fillsDe(c, meta) || ref.fl]);
    }
    return { cartes, inconnues };
}

const dateFr = (d) => {
    const x = new Date(d);
    return Number.isNaN(x.getTime())
        ? ''
        : x.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
};

function lien(texte, href) {
    const a = document.createElement('a');
    a.href = href;
    a.textContent = texte;
    if (/^https?:/.test(href)) {
        a.target = '_blank';
        a.rel = 'noopener';
    }
    return a;
}

async function demarrer() {
    const statut = document.getElementById('pts-coll-etat');
    const zone = document.getElementById('qbuilder');
    if (!statut || !zone) return;
    const dire = (...morceaux) => statut.replaceChildren(...morceaux);
    try {
        const e = await etat();
        if (!e.debloque) return; // la garde de la page renvoie déjà vers pts.html
        const col = await maCollection();
        if (!col || !Array.isArray(col.roster) || !col.roster.length) {
            dire(
                'Ta collection n’est pas encore synchronisée. Installe l’extension PTS Companion (',
                lien('la télécharger', 'telechargements/pts-companion-0.2.0.zip'),
                '), connecte-la à ton compte, puis ouvre ',
                lien('packtasmall.fr', 'https://packtasmall.fr'),
                ' : tes cartes apparaîtront ici. Tu peux suivre la synchronisation depuis ',
                lien('ton profil', 'profil.html'),
                '.',
            );
            return;
        }
        const { cartes, inconnues } = convertir(col, catalogue(), json('pts-wmap', {}));
        if (!cartes.length) {
            dire(
                'Ta collection a été reçue, mais aucune carte n’a été reconnue. Réessaie plus tard ou préviens-nous sur le Discord.',
            );
            return;
        }
        // Le builder a besoin d'au moins un Caller (le pack de bienvenue en contient toujours un)
        const callers = new Set(json('pts-build', {}).callers?.map((c) => c[0]) || []);
        if (!cartes.some((c) => c[2] === 'caller' && callers.has(c[0]))) {
            dire(
                `Ta collection (${cartes.length} cartes) ne contient aucun Caller reconnu : le builder en a besoin pour composer une équipe. Ouvre packtasmall.fr pour resynchroniser ta collection.`,
            );
            return;
        }
        document.getElementById('pts-coll').textContent = JSON.stringify(cartes);
        if (typeof window.__ptsLancer !== 'function') throw new Error('builder absent');
        zone.style.display = 'flex';
        window.__ptsLancer();
        const maj = dateFr(col.updated_at);
        dire(
            `Ta collection : ${cartes.length} cartes${maj ? `, synchronisée le ${maj}` : ''}.` +
                (inconnues ? ` ${inconnues} carte(s) pas encore connue(s) du builder ont été ignorées.` : ''),
        );
    } catch {
        zone.style.display = 'none';
        dire('Impossible de charger ta collection pour le moment. Recharge la page dans un instant.');
    }
}

if (typeof document !== 'undefined') demarrer();
