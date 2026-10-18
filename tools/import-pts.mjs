// Importe les outils Pack ta Small (Encyclopédie, Builder Ma collection) dans le site.
// Les sources sont des pages autonomes (anciennes artifacts) dans ../1_PTS/Encyclopedie.
// Usage : npm run import:pts   (ou node tools/import-pts.mjs [dossier_source])
// Relancer après chaque mise à jour des sources : les pages du site sont régénérées dans public/
// (copiées telles quelles par Astro ; la CSP finale est recalculée sur dist/ par npm run build).
//
// - SÉCURITÉ : les pages publiques (public/pts-*.html, dépôt PUBLIC) ne contiennent AUCUN contenu réservé.
//   Le texte, les données et le code de chaque outil vont dans contenus-prives/pts/ (ignoré par git), puis dans
//   la table Supabase « contenus » (niveau pts : lisible seulement par un membre vérifié du serveur, RLS) avec
//   npm run publier:pts. La page publique n'est qu'une coquille : public/assets/js/pts-outil.js lit le contenu
//   après la connexion et n'exécute le code que si son hachage figure dans la CSP de la page (data-csp-scripts).
//   Le slug contient une empreinte du contenu : publier une nouvelle version ne casse pas la page en ligne.
//   Après chaque import : npm run publier:pts AVANT de fusionner la pull request.
// - Encyclopédie (Partie 1) : sans le chapitre « GOAT & Légendes » (les données restent, elles servent aux
//   calculs), sans lien vers le builder, sans les compos et données de tournoi de l'auteur (inutilisées).
// - Builder Ma collection (Partie 3, builder 1 seulement) : la collection n'est PLUS écrite dans la page.
//   Chaque membre voit SES cartes, lues dans Supabase (envoyées par l'extension PTS Companion) par
//   pts-ma-collection.js, qui lance ensuite le builder. Le Builder Tournoi et le Builder général ne sont pas publiés.
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { appliquerCsp, gestionnairesInline, urlSupabase } from './csp.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = resolve(ROOT, process.argv[2] || '../1_PTS/Encyclopedie');
const SITE = { nom: 'UnDocPourTous' };
const PRIVE = resolve(ROOT, 'contenus-prives', 'pts'); // ignoré par git (contenus-prives/)
const TAILLE_PART = 1_000_000; // caractères par ligne de la table contenus (publier-contenu.mjs : 2 Mo max)

const OUTILS = [
    {
        source: 'Partie1_Encyclopedie.html',
        cible: 'public/pts-encyclopedie.html',
        slug: 'pts-encyclopedie',
        nom: 'Encyclopédie',
        titre: 'Encyclopédie Pack ta Small',
        description:
            'Encyclopédie complète de Pack ta Small : guide du jeu, armes, synergies, cartes spéciales, Callers, packs, maths des combats et collection complète des cartes.',
        transformer: encyclopedie,
    },
    {
        source: 'Partie3_Builders_tryhard.html',
        cible: 'public/pts-builder.html',
        slug: 'pts-builder',
        nom: 'Builder Ma collection',
        titre: 'Builder Ma collection Pack ta Small',
        description:
            'Builder Pack ta Small avec ta propre collection : compose ton équipe de 20, cible les synergies, calcule le Collectif et laisse l’optimiseur proposer 3 compos.',
        transformer: builderMaCollection,
        scripts: ['assets/js/pts-ma-collection.js'],
    },
];

const esc = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

// Remplace exactement une occurrence (sinon arrête l'import : la source a changé, il faut revoir ce script)
function remplacer(t, avant, apres, quoi) {
    const n =
        typeof avant === 'string' ? t.split(avant).length - 1 : (t.match(new RegExp(avant.source, 'g')) || []).length;
    if (n !== 1)
        throw new Error(
            `${quoi} : ${n} occurrence(s) trouvée(s) au lieu d'une. La source a changé : revoir tools/import-pts.mjs.`,
        );
    return t.replace(avant, apres);
}

// Retire un bloc de `debut` jusqu'à la fin de la première `fin` qui suit
function retirerBloc(t, debut, fin, quoi) {
    const a = t.indexOf(debut);
    if (a < 0 || t.indexOf(debut, a + 1) >= 0) throw new Error(`${quoi} : début introuvable ou en double`);
    const b = t.indexOf(fin, a);
    if (b < 0) throw new Error(`${quoi} : fin introuvable`);
    let c = b + fin.length;
    while (t[c] === '\r' || t[c] === '\n') c++;
    return t.slice(0, a) + t.slice(c);
}

const retirerLigne = (t, re, quoi) => remplacer(t, new RegExp(`[ \\t]*${re.source}[^\\n]*\\r?\\n`), '', quoi);
const retirerNavParties = (t) =>
    remplacer(t, /<nav class="parts"[\s\S]*?<\/nav>\r?\n?/, '', 'navigation entre les parties');

function encyclopedie(t) {
    t = retirerNavParties(t);
    t = retirerLigne(t, /<a class="lc" href="#pouvoirs">/, 'sommaire GOAT & Légendes');
    t = retirerBloc(t, '<section id="pouvoirs">', '</section>', 'chapitre GOAT & Légendes');
    // Compos de l'auteur et données de tournoi : jamais lues par l'encyclopédie, retirées
    for (const id of ['pts-comps', 'pts-tcomps', 'pts-tour'])
        t = retirerBloc(t, `<script type="application/json" id="${id}">`, '</script>', `données ${id}`);
    if (/pts-comps|pts-tcomps|pts-tour/.test(t))
        throw new Error('compos ou tournoi encore utilisés par l’encyclopédie');
    return t;
}

function builderMaCollection(t) {
    t = retirerNavParties(t);
    t = remplacer(t, /<h1>Les Builders, <em>tryhard<\/em><\/h1>/, '<h1>Builder <em>Ma collection</em></h1>', 'titre');
    t = remplacer(
        t,
        /<p class="lede">Deux builders[\s\S]*?<\/p>/,
        '<p class="lede">Le builder qui ne travaille qu’avec <b>tes</b> cartes : ta collection est lue dans ton compte, envoyée par l’extension PTS Companion. Il utilise les maths mesurées sur les replays (contrôles, rendement des armes, structure).</p>',
        'chapeau',
    );

    // Builder Tournoi : sommaire, section HTML, données et code retirés
    t = retirerLigne(t, /<a class="lc" href="#ch23">/, 'sommaire Builder Tournoi');
    t = retirerBloc(t, '<section id="ch23"', '</section>', 'section Builder Tournoi');
    t = retirerBloc(t, '<script type="application/json" id="pts-tour">', '</script>', 'données du tournoi');
    t = retirerBloc(t, '<script type="application/json" id="pts-tcomps">', '</script>', 'compos du tournoi');

    // Collection et compos de l'auteur retirées : remplies par pts-ma-collection.js pour le joueur connecté
    t = remplacer(
        t,
        /<script type="application\/json" id="pts-coll">[\s\S]*?<\/script>/,
        '<script type="application/json" id="pts-coll">[]</script>',
        'collection de l’auteur',
    );
    t = remplacer(
        t,
        /<script type="application\/json" id="pts-comps">[\s\S]*?<\/script>/,
        '<script type="application/json" id="pts-comps">{"active":"","comps":[],"map":{}}</script>',
        'compos de l’auteur',
    );

    // Table des armes (identifiants du site → noms du builder) pour convertir la collection
    const wmap = t.match(/const WMAP=(\{[^}]*\});/);
    if (!wmap) throw new Error('table WMAP introuvable');
    const table = new Function(`return ${wmap[1]}`)();
    t = t.replace(
        '<script type="application/json" id="pts-coll">',
        `<script type="application/json" id="pts-wmap">${JSON.stringify(table)}</script>\n<script type="application/json" id="pts-coll">`,
    );

    // Compos du site (non synchronisées) et export « via Claude » masqués
    t = remplacer(t, '<div class="b-box qc">', '<div class="b-box qc" style="display:none">', 'choix des compos');
    t = remplacer(
        t,
        '<div class="b-box qx" id="qxbox">',
        '<div class="b-box qx" id="qxbox" style="display:none">',
        'export',
    );
    t = remplacer(t, 'Builder 1 · uniquement tes cartes', 'Uniquement tes cartes', 'sur-titre du builder');
    t = remplacer(
        t,
        /Ta collection relevée le [^:]*sur ton compte : /,
        'Ta collection synchronisée par PTS Companion : ',
        'résumé de la collection',
    );
    t = remplacer(
        t,
        ' Les compos de ta draft du site se chargent avec le menu ci-dessus.',
        '',
        'phrase sur les compos du site',
    );

    // Le builder attend la collection : affiché et lancé par pts-ma-collection.js
    t = remplacer(
        t,
        '<div id="qbuilder" style="display:flex;flex-direction:column;gap:16px">',
        '<p id="pts-coll-etat" class="b-lede" role="status" aria-live="polite">Chargement de ta collection…</p>\n  <div id="qbuilder" style="display:none;flex-direction:column;gap:16px">',
        'zone du builder',
    );

    // Code : Builder Tournoi retiré, puis tout le code mis en attente (window.__ptsLancer)
    const i23 = t.indexOf('// ================= Chapitre 23');
    if (i23 < 0) throw new Error('code du Builder Tournoi introuvable');
    const finScript = t.indexOf('</script>', i23);
    const fermeture = t.lastIndexOf('})();', finScript); // fermeture du script principal
    t = t.slice(0, i23) + t.slice(fermeture);
    const debut = t.lastIndexOf('<script>', i23);
    if (t.slice(debut, debut + 30) !== '<script>(function(){\nconst W={'.slice(0, 30))
        throw new Error('début du script principal inattendu');
    t =
        t.slice(0, debut) +
        '<script>window.__ptsLancer=function(){(function(){' +
        t.slice(debut + '<script>(function(){'.length);
    const fin2 = t.indexOf('</script>', debut);
    const f2 = t.lastIndexOf('})();', fin2);
    t = t.slice(0, f2) + '})();};' + t.slice(f2 + '})();'.length);
    if (/Builder Tournoi|pts-tcomps|rbuilder/.test(t)) throw new Error('reste du Builder Tournoi dans la page');
    if (/window\.claude/.test(t)) throw new Error('appel window.claude restant');
    return t;
}

// Sépare le corps de la page : balisage, blocs de données (JSON) et code (scripts inline)
function separer(corps) {
    const donnees = {};
    const scripts = [];
    const balisage = corps.replace(/<script\b([^>]*)>([\s\S]*?)<\/script>\n?/g, (_, attrs, code) => {
        const json = attrs.match(/^\s*type="application\/json"\s+id="(pts-[a-z]+)"\s*$/);
        if (json) {
            if (json[1] in donnees) throw new Error(`bloc de données ${json[1]} en double`);
            donnees[json[1]] = code;
        } else if (attrs.trim() === '') scripts.push(code);
        else throw new Error(`script inattendu dans la page : <script${attrs}>`);
        return '';
    });
    if (/<script/i.test(balisage)) throw new Error('script restant dans le balisage');
    return { balisage: balisage.trim(), donnees, scripts };
}

const sha256 = (texte, format) => createHash('sha256').update(texte, 'utf8').digest(format);

function barreSite(outil) {
    return `<nav class="udpt-bar" aria-label="Fil d’Ariane">
  <a href="index.html" class="udpt-home">${SITE.nom}</a><span aria-hidden="true">/</span>
  <a href="albion.html">Albion Online</a><span aria-hidden="true">/</span>
  <a href="pts.html">Pack ta Small</a><span aria-hidden="true">/</span>
  <span aria-current="page">${outil.nom}</span>
</nav>`;
}

const CSS_BARRE = `
/* Barre UnDocPourTous (ajoutée par tools/import-pts.mjs) */
.udpt-bar{max-width:1180px;margin:0 auto;padding:14px 0 0;display:flex;flex-wrap:wrap;align-items:center;gap:8px;font:500 13px/1.4 var(--mono);color:var(--muted)}
.udpt-bar a{color:var(--muted);text-decoration:none}
.udpt-bar a:hover,.udpt-bar a:focus-visible{color:var(--ink);text-decoration:underline}
.udpt-bar .udpt-home{font-weight:700;color:var(--ink)}
.udpt-bar [aria-current]{color:var(--ink)}
/* Correctif : case « Inclure les GOAT et Légendes » écrasée par la règle générale des champs */
.glt input[type="checkbox"]{width:auto;flex:0 0 auto;padding:0;margin:0;accent-color:var(--blood)}
#pts-coll-etat a{color:var(--ink);text-decoration:underline}
/* Coquille publique (contenu chargé après la connexion par pts-outil.js) */
#pts-outil{display:contents}
.udpt-etat{max-width:1180px;margin:24px auto;padding:0 16px;font:500 15px/1.5 var(--body);color:var(--muted)}
.udpt-etat:empty{display:none}
.udpt-etat a{color:var(--ink);text-decoration:underline}
`;

rmSync(PRIVE, { recursive: true, force: true });
mkdirSync(PRIVE, { recursive: true });
const manifeste = [];

for (const outil of OUTILS) {
    let t = readFileSync(resolve(SRC, outil.source), 'utf8').replace(/\r\n/g, '\n');

    // 1. Titre d'origine retiré (remplacé dans le <head>)
    t = t.replace(/<title>[\s\S]*?<\/title>\s*/, '');

    // 2. Retouches propres à l'outil (navigation claude.ai, chapitres retirés…)
    t = outil.transformer(t);
    if (/claude\.ai\/artifact/.test(t)) throw new Error(`lien claude.ai restant dans ${outil.source}`);

    // Sur-titre : plus de numéro de partie (« Pack ta Small · Partie 1 · … »)
    t = t.replace(/(Pack ta Small) · Partie \d · /, '$1 · ');

    // 3. Séparation <head> / <body> : tout jusqu'à la fin du <style> va dans le <head> (mise en page seulement)
    const fin = t.indexOf('</style>') + '</style>'.length;
    const tete = t.slice(0, fin).replace('</style>', CSS_BARRE + '</style>');
    if (/<script/i.test(tete)) throw new Error(`script dans le <head> de ${outil.source}`);

    // 4. Corps réservé : balisage + données + code, écrits dans contenus-prives/pts/ (jamais dans la page publique)
    const { balisage, donnees, scripts } = separer(t.slice(fin));
    const charge = JSON.stringify({ v: 1, balisage, donnees, scripts });
    const version = sha256(charge, 'hex').slice(0, 12);
    const slug = `${outil.slug}-${version}`;
    const parts = Math.ceil(charge.length / TAILLE_PART);
    for (let i = 0; i < parts; i++) {
        const fichier = `${slug}-${i + 1}.json`;
        writeFileSync(resolve(PRIVE, fichier), charge.slice(i * TAILLE_PART, (i + 1) * TAILLE_PART));
        manifeste.push({ slug: `${slug}-${i + 1}`, fichier, titre: `${outil.titre} (${i + 1}/${parts})` });
    }
    // Hachages du code, ajoutés à la CSP de la page par tools/csp.mjs (seul ce code-là pourra s'exécuter)
    const hachages = scripts.map((c) => `sha256-${sha256(c, 'base64')}`).join(' ');

    const extra = (outil.scripts || []).map((s) => `<script type="module" src="${s}"></script>\n`).join('');
    const titre = `${outil.titre} — ${SITE.nom}`;
    const page = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(titre)}</title>
<meta name="description" content="${esc(outil.description)}">
<meta property="og:site_name" content="${SITE.nom}">
<meta property="og:title" content="${esc(titre)}">
<meta property="og:description" content="${esc(outil.description)}">
<meta property="og:type" content="website">
<meta property="og:locale" content="fr_FR">
<meta name="robots" content="noindex">
<!-- Généré par tools/import-pts.mjs depuis ${outil.source} : ne pas modifier à la main -->
<!-- Page vide : le contenu est réservé aux membres vérifiés du serveur Pack ta Small (table contenus, RLS) -->
<script src="assets/js/adresse.js"></script>
<script type="module" src="assets/js/entete.js"></script>
<script type="module" src="assets/js/pts-outil.js"></script>
${extra}${tete}
</head>
<body>
${barreSite(outil)}
<p id="pts-outil-etat" class="udpt-etat" role="status" aria-live="polite">Chargement de l’outil…</p>
<noscript><p class="udpt-etat">Cet outil est réservé aux membres du serveur Pack ta Small : active JavaScript, puis <a href="pts.html">connecte-toi avec Discord</a>.</p></noscript>
<div id="pts-outil" data-slug="${slug}" data-parts="${parts}" data-csp-scripts="${hachages}"></div>
</body>
</html>
`;
    // CSP : scripts inline autorisés par hachage, rien d'autre (voir tools/csp.mjs)
    for (const g of gestionnairesInline(page + balisage))
        console.warn(`  ! ${outil.source} : ${g} → bloqué par la CSP, à réécrire en addEventListener`);
    writeFileSync(resolve(ROOT, outil.cible), appliquerCsp(page, urlSupabase(ROOT)));
    console.log(
        `${outil.source} -> ${outil.cible} (${Math.round(page.length / 1024)} Ko publics) + ${slug} ` +
            `(${Math.round(charge.length / 1024)} Ko réservés, ${parts} partie(s))`,
    );
}
writeFileSync(resolve(PRIVE, 'manifeste.json'), JSON.stringify(manifeste, null, 2));
const restants = readdirSync(PRIVE).length - 1;
console.log(`\n${restants} fichier(s) réservé(s) dans contenus-prives/pts/ → npm run publier:pts avant de fusionner.`);
