// Pages outils Pack ta Small (pts-encyclopedie.html, pts-builder.html), générées par tools/import-pts.mjs.
// La page publique est une coquille VIDE : texte, données et code de l'outil sont dans la table Supabase
// « contenus » (niveau pts), que la base ne renvoie qu'à un membre vérifié du serveur (RLS, fonction a_acces).
// Le code reçu n'est exécuté que si son hachage figure dans la CSP de la page (data-csp-scripts) :
// une ligne modifiée dans la base ne peut rien exécuter d'autre.
// Exporte `pret` : promesse résolue à true quand l'outil est affiché (false si renvoi vers pts.html).
import { etat, chargerContenu, surveillerInactivite } from './pts-auth.js';

const VERROU = 'pts.html?verrou=1';
const zone = document.getElementById('pts-outil');
const statut = document.getElementById('pts-outil-etat');
const dire = (t) => {
    if (statut) statut.textContent = t;
};

// ---------- Nettoyage du balisage (par prudence : seul l'admin écrit dans la table contenus) ----------
const BALISES_INTERDITES = new Set([
    'script',
    'iframe',
    'object',
    'embed',
    'frame',
    'frameset',
    'base',
    'link',
    'meta',
    'template',
    'form',
]);
const ATTRIBUTS_URL = new Set(['href', 'xlink:href', 'src', 'action', 'formaction', 'poster', 'data', 'background']);
const urlNormalisee = (v) =>
    Array.from(v)
        .filter((c) => {
            const n = c.codePointAt(0);
            return n > 32 && !(n >= 127 && n <= 159);
        })
        .join('')
        .toLowerCase();
function urlDangereuse(nom, valeur, balise) {
    const v = urlNormalisee(valeur);
    if (v.startsWith('javascript:') || v.startsWith('vbscript:')) return true;
    if (v.startsWith('data:')) return !(nom === 'src' && balise === 'img' && v.startsWith('data:image/'));
    return false;
}
export function nettoyer(html) {
    const doc = new DOMParser().parseFromString(String(html), 'text/html');
    for (const el of [...doc.body.querySelectorAll('*')]) {
        const balise = el.localName.toLowerCase();
        if (BALISES_INTERDITES.has(balise)) {
            el.remove();
            continue;
        }
        for (const { name } of [...el.attributes]) {
            const nom = name.toLowerCase();
            const valeur = el.getAttribute(name) ?? '';
            if (
                nom.startsWith('on') ||
                nom === 'srcdoc' ||
                (ATTRIBUTS_URL.has(nom) && urlDangereuse(nom, valeur, balise))
            )
                el.removeAttribute(name);
        }
        if (balise === 'a' && el.getAttribute('target')) el.setAttribute('rel', 'noopener noreferrer');
    }
    const fragment = document.createDocumentFragment();
    fragment.append(...doc.body.childNodes);
    return fragment;
}

async function empreinte(code) {
    const octets = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(code)));
    let binaire = '';
    for (const o of octets) binaire += String.fromCharCode(o);
    return `sha256-${btoa(binaire)}`;
}

async function charger() {
    const slug = zone?.dataset.slug ?? '';
    const parts = Number(zone?.dataset.parts);
    const autorises = new Set((zone?.dataset.cspScripts ?? '').split(/\s+/).filter(Boolean));
    if (!/^pts-[a-z0-9-]+$/.test(slug) || !Number.isInteger(parts) || parts < 1 || parts > 20)
        throw new Error('page mal formée');

    const e = await etat();
    if (!e.debloque) {
        location.replace(VERROU);
        return false;
    }
    dire('Chargement de l’outil…');
    const lignes = await Promise.all(Array.from({ length: parts }, (_, i) => chargerContenu(`${slug}-${i + 1}`)));
    if (lignes.some((l) => !l)) {
        // Pas (ou plus) membre vérifié : la base ne renvoie rien
        location.replace(VERROU);
        return false;
    }
    const outil = JSON.parse(lignes.map((l) => l.html).join(''));
    if (outil?.v !== 1 || typeof outil.balisage !== 'string' || !Array.isArray(outil.scripts))
        throw new Error('contenu illisible');

    // Code : uniquement celui dont le hachage est dans la page (et donc dans sa CSP)
    for (const code of outil.scripts) {
        if (typeof code !== 'string' || !autorises.has(await empreinte(code))) throw new Error('code non autorisé');
    }

    // Données (blocs JSON lus par le code de l'outil) : éléments inertes, remplis en texte
    for (const [id, texte] of Object.entries(outil.donnees || {})) {
        if (!/^pts-[a-z]+$/.test(id) || typeof texte !== 'string') continue;
        const bloc = document.createElement('script');
        bloc.type = 'application/json';
        bloc.id = id;
        bloc.textContent = texte;
        zone.append(bloc);
    }
    zone.append(nettoyer(outil.balisage));
    for (const code of outil.scripts) {
        const s = document.createElement('script');
        s.textContent = code;
        document.body.append(s);
    }
    dire('');
    surveillerInactivite();
    return true;
}

export const pret = charger().catch(() => {
    dire('Impossible de charger l’outil pour le moment. Recharge la page dans un instant.');
    return false;
});
