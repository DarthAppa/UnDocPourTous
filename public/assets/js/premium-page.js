// Page d'un contenu Premium (ex. albion-builder-tryhard.html).
// La page publique ne contient AUCUN contenu payant : il est lu dans la base (table contenus),
// qui ne le renvoie qu'aux comptes ayant accès (RLS). Le navigateur ne décide de rien.
import { etat, chargerContenu, surveillerInactivite } from './pts-auth.js';

const zone = document.getElementById('premium-zone');
const statut = document.getElementById('premium-statut');
const slug = zone?.dataset.slug || '';
const dernier = location.pathname.split('/').pop() || '';
const page = !dernier || dernier.endsWith('.html') ? dernier : `${dernier}.html`; // en ligne : « /albion-builder-tryhard »
const ici = /^[a-z0-9-]+\.html$/.test(page) ? page : 'albion-premium.html';

const dire = (t, ton = '') => {
    if (!statut) return;
    statut.textContent = t;
    statut.dataset.ton = ton;
};

// ---------- Nettoyage du HTML (par prudence, même si l'admin l'a rédigé) ----------
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
    'set',
    'animate',
    'style', // maquillage de la page (position:fixed…) : le contenu garde le style du site
    'form', // formulaires vers l'extérieur (déjà bloqués par la CSP form-action, double sécurité)
]);
const ATTRIBUTS_URL = new Set(['href', 'xlink:href', 'src', 'action', 'formaction', 'poster', 'data', 'background']);

// Valeur d'URL sans espaces ni caractères de contrôle, en minuscules (« java\tscript: » compris)
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

function nettoyer(html) {
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
                nom === 'style' ||
                nom === 'srcset' ||
                nom === 'ping' ||
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

// ---------- Affichage ----------
// Carte = un seul lien sur toute sa surface (.card-link), indice en texte (.card-hint)
function carte(titre, texte, indice, href) {
    const a = document.createElement('a');
    a.className = 'invite card-link';
    a.href = href;
    const bloc = document.createElement('span');
    bloc.className = 'flex flex-col gap-2';
    const t = document.createElement('span');
    t.className = 'text-lg';
    t.textContent = titre;
    const p = document.createElement('span');
    p.className = 'text-[13px] text-textMuted';
    p.textContent = texte;
    bloc.append(t, p);
    const h = document.createElement('span');
    h.className = 'card-hint text-sm font-semibold';
    h.textContent = indice;
    a.append(bloc, h);
    zone.replaceChildren(a);
}

async function afficher() {
    if (!zone || !slug) return;
    zone.setAttribute('aria-busy', 'true');
    dire('Chargement du contenu…');
    try {
        const e = await etat();
        if (!e.connecte) {
            dire('Contenu réservé aux abonnés Premium.');
            carte(
                'Réservé aux abonnés Premium',
                'Connecte-toi pour y accéder si tu es abonné, ou pour t’abonner.',
                'Se connecter →',
                `connexion-pts.html?retour=${ici}`,
            );
            return;
        }
        const contenu = await chargerContenu(slug);
        if (!contenu) {
            dire('Contenu réservé aux abonnés Premium.');
            carte(
                'Réservé aux abonnés Premium',
                'Ton compte n’a pas encore d’abonnement Premium actif.',
                'Débloquer avec Premium →',
                'albion-paiement.html',
            );
            return;
        }
        const article = document.createElement('article');
        article.className = 'contenu-premium panneau';
        article.append(nettoyer(contenu.html));
        zone.replaceChildren(article);
        dire('');
        surveillerInactivite(`connexion-pts.html?retour=${ici}&inactif=1`);
    } catch {
        dire('Impossible de charger le contenu pour le moment. Réessaie dans un instant.', 'erreur');
    } finally {
        zone.removeAttribute('aria-busy');
    }
}

afficher();
