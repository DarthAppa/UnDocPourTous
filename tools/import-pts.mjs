// Importe les outils Pack ta Small (Encyclopédie, Builder général) dans le site.
// Les sources sont des pages autonomes (anciennes artifacts) dans ../1_PTS/Encyclopedie.
// Usage : npm run import:pts   (ou node tools/import-pts.mjs [dossier_source])
// Relancer après chaque mise à jour des sources : les pages du site sont régénérées.
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { appliquerCsp, gestionnairesInline, urlSupabase } from './csp.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = resolve(ROOT, process.argv[2] || '../1_PTS/Encyclopedie');
const SITE = { nom: 'UnDocPourTous' };

// Les outils PTS publiés sur le site (Partie 3 = Builder Tryhard, premium : pas encore publié)
const OUTILS = [
    {
        source: 'Partie1_Encyclopedie.html',
        cible: 'pts-encyclopedie.html',
        nom: 'Encyclopédie',
        titre: 'Encyclopédie Pack ta Small',
        description:
            'Encyclopédie complète de Pack ta Small : guide du jeu, armes, synergies, cartes spéciales, Callers, packs, maths des combats et collection complète des cartes.',
    },
    {
        source: 'Partie2_Builder_general.html',
        cible: 'pts-builder.html',
        nom: 'Builder général',
        titre: 'Builder général Pack ta Small',
        description:
            'Builder Pack ta Small : compose ton équipe de 20, cible les synergies, calcule le Collectif et laisse l’optimiseur proposer 3 compos.',
    },
];

const esc = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

function navParties(courant) {
    const liens = OUTILS.map((o) =>
        o.cible === courant
            ? `<a href="${o.cible}" aria-current="page"><span>Pack ta Small</span><b>${o.nom}</b></a>`
            : `<a href="${o.cible}"><span>Pack ta Small</span><b>${o.nom}</b></a>`,
    ).join('');
    return `<nav class="parts" aria-label="Outils Pack ta Small">${liens}</nav>`;
}

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
`;

for (const outil of OUTILS) {
    let t = readFileSync(resolve(SRC, outil.source), 'utf8');

    // 1. Titre d'origine retiré (remplacé dans le <head>)
    t = t.replace(/<title>[\s\S]*?<\/title>\s*/, '');

    // 2. Navigation entre les parties : liens du site au lieu des artifacts claude.ai
    const avant = t.length;
    t = t.replace(/<nav class="parts"[\s\S]*?<\/nav>/, navParties(outil.cible));
    if (t.length === avant) console.warn(`  ! navigation des parties introuvable dans ${outil.source}`);
    if (/claude\.ai\/artifact/.test(t)) console.warn(`  ! lien claude.ai restant dans ${outil.source}`);

    // Sur-titre : plus de numéro de partie (« Pack ta Small · Partie 1 · … »)
    t = t.replace(/(Pack ta Small) · Partie \d · /, '$1 · ');

    // 3. Séparation <head> / <body> : tout jusqu'à la fin du <style> va dans le <head>
    const fin = t.indexOf('</style>') + '</style>'.length;
    const tete = t.slice(0, fin).replace('</style>', CSS_BARRE + '</style>');
    const corps = t.slice(fin);

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
<!-- Généré par tools/import-pts.mjs depuis ${outil.source} : ne pas modifier à la main -->
<!-- Verrou : page affichée seulement si connecté avec Discord et membre du serveur Pack ta Small (pts-auth.js) -->
<script>document.documentElement.classList.add('pts-attente');</script>
<style>html.pts-attente body{visibility:hidden}</style>
<noscript><style>html.pts-attente body{visibility:visible}</style></noscript>
<script type="module">import { garde } from './pts-auth.js'; garde();</script>
${tete}
</head>
<body>
${barreSite(outil)}
${corps.trim()}
</body>
</html>
`;
    // CSP : scripts inline autorisés par hachage, rien d'autre (voir tools/csp.mjs)
    for (const g of gestionnairesInline(page))
        console.warn(`  ! ${outil.source} : ${g} → bloqué par la CSP, à réécrire en addEventListener`);
    writeFileSync(resolve(ROOT, outil.cible), appliquerCsp(page, urlSupabase(ROOT)));
    console.log(`${outil.source} -> ${outil.cible} (${Math.round(page.length / 1024)} Ko)`);
}
