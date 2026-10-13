// Règles maison du site (CLAUDE.md) vérifiées automatiquement.
// Usage : node tools/regles.mjs   → code 1 s'il reste une erreur.
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { dirname, posix } from 'node:path';
import { execSync } from 'node:child_process';

const NOM = 'UnDocPourTous';
const GENEREES = new Set(['pts-encyclopedie.html', 'pts-builder.html']);
const erreurs = [];
const alertes = [];
const err = (f, m) => erreurs.push(`${f} : ${m}`);
const warn = (f, m) => alertes.push(`${f} : ${m}`);

// Fichiers suivis par git (ou nouveaux non ignorés) : évite node_modules, docs-prives, .env…
function fichiersSuivis() {
    try {
        const out = execSync('git ls-files --cached --others --exclude-standard', { encoding: 'utf8' });
        return out
            .split('\n')
            .filter(Boolean)
            .filter((f) => existsSync(f) && statSync(f).isFile());
    } catch {
        return readdirSync('.').filter((f) => statSync(f).isFile());
    }
}
const fichiers = fichiersSuivis();
const texte = fichiers.filter((f) => /\.(html|js|mjs|css|md|json|yml|yaml|txt)$/i.test(f) && f !== 'package-lock.json');
const pages = fichiers.filter((f) => !f.includes('/') && f.endsWith('.html'));

// 1. Pas de secrets dans le code
const SECRETS = [
    [/sk_(live|test)_[0-9a-zA-Z]{10,}/, 'clé Stripe secrète'],
    [/rk_(live|test)_[0-9a-zA-Z]{10,}/, 'clé Stripe restreinte'],
    [/whsec_[0-9a-zA-Z]{10,}/, 'secret webhook Stripe'],
    [/gh[pousr]_[0-9A-Za-z]{30,}/, 'token GitHub'],
    [/xox[abpr]-[0-9A-Za-z-]{10,}/, 'token Slack'],
    // (?<![A-Za-z0-9+/]) : ignore les faux positifs au milieu d'une image en base64
    [/(?<![A-Za-z0-9+/])AIza[0-9A-Za-z_-]{35}(?![A-Za-z0-9+/])/, 'clé API Google'],
    [/-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----/, 'clé privée'],
    [/(?<![A-Za-z0-9+/])[MN][A-Za-z\d]{23,25}\.[\w-]{6}\.[\w-]{27,}/, 'token de bot Discord'],
    // JWT Supabase dont le contenu contient "role":"service_role" (base64)
    [
        /eyJ[\w-]+\.[\w-]*InJvbGUiOiJzZXJ2aWNlX3JvbGUi[\w-]*\.[\w-]+/,
        'clé Supabase service_role (jamais côté navigateur)',
    ],
];
for (const f of texte) {
    if (f.startsWith('tools/regles.mjs')) continue;
    const c = readFileSync(f, 'utf8');
    for (const [re, quoi] of SECRETS) if (re.test(c)) err(f, `${quoi} trouvé(e) dans le code → déplacer dans .env`);
}
if (fichiers.some((f) => /(^|\/)\.env(\.|$)/.test(f) && !f.endsWith('.env.example')))
    err('.env', 'un fichier .env est suivi par git');

// 2. Nom du site : jamais « UnDocPourTout » (sans s)
for (const f of texte) {
    if (f === 'tools/regles.mjs' || f === 'CLAUDE.md') continue;
    readFileSync(f, 'utf8')
        .split('\n')
        .forEach((l, i) => {
            if (/UnDocPourTout(?!s)/i.test(l) && !/github\.com|undocpourtout\.(fr|com)/i.test(l))
                err(`${f}:${i + 1}`, '« UnDocPourTout » → écrire « UnDocPourTous »');
        });
}

// 3. Règles par page HTML
const CONFIG_TW = 'tailwind.config.cjs';
const TOKENS = existsSync(CONFIG_TW)
    ? [...readFileSync(CONFIG_TW, 'utf8').matchAll(/(\w+)\s*:\s*'#/g)].map((m) => m[1])
    : [];
for (const p of pages) {
    const html = readFileSync(p, 'utf8');
    const head = (html.match(/<head[\s\S]*?<\/head>/i) || [''])[0];

    if ((html.match(/<head[\s>]/gi) || []).length !== 1) err(p, 'il faut exactement un <head>');
    if ((html.match(/<html[\s>]/gi) || []).length !== 1) err(p, 'il faut exactement un <html> (contenu dupliqué ?)');
    if (!/<html[^>]*\slang="fr"/i.test(html)) err(p, '<html lang="fr"> manquant');
    if (!/<meta[^>]+name="viewport"/i.test(head)) err(p, 'meta viewport manquante');

    const titre = (head.match(/<title>([\s\S]*?)<\/title>/i) || [])[1]?.trim();
    if (!titre) err(p, '<title> manquant');
    else if (p !== 'index.html' && !new RegExp(`\\s[—-]\\s${NOM}$`).test(titre))
        err(p, `<title> doit finir par « — ${NOM} » (actuel : « ${titre} »)`);

    if (
        !new RegExp(`property="og:site_name"\\s+content="${NOM}"|content="${NOM}"\\s+property="og:site_name"`).test(
            head,
        )
    )
        err(p, `og:site_name="${NOM}" manquant`);
    if (!/<meta[^>]+name="description"/i.test(head)) warn(p, 'meta description manquante');

    if (GENEREES.has(p)) continue; // pages générées : seules les règles de base ci-dessus

    if (!/<script[^>]+src="script\.js"[^>]*\bdefer\b/i.test(head))
        err(p, 'script.js doit être chargé dans le <head> avec defer');
    if (!/<link[^>]+href="assets\/css\/tailwind\.css"/i.test(head)) err(p, 'assets/css/tailwind.css non chargé');
    if (
        [...html.matchAll(/\b(?:src|href)="(https:[^"]+)"/g)].some((m) => {
            try {
                return new URL(m[1]).hostname === 'cdn.tailwindcss.com';
            } catch {
                return false;
            }
        })
    )
        err(p, 'CDN Tailwind → utiliser assets/css/tailwind.css (npm run build:css)');
    if (!/<link[^>]+href="style\.css"/i.test(head)) err(p, 'style.css non chargé dans le <head>');
    if (!/class="[^"]*\bno-js\b/.test(html.match(/<html[^>]*>/i)?.[0] || ''))
        warn(p, '<html> sans classe no-js (contenu .reveal sans JS ?)');
    if ((html.match(/<h1[\s>]/gi) || []).length !== 1) err(p, 'il faut exactement un <h1>');

    // Couleurs : uniquement les tokens (pas de bg-[#hex], text-[rgb(...)] etc.)
    for (const m of html.matchAll(
        /\b(?:bg|text|border|from|to|via|ring|fill|stroke|shadow|outline|decoration)-\[(#|rgb|hsl)[^\]]*\]/g,
    ))
        err(p, `couleur en dur « ${m[0]} » → utiliser un token (${TOKENS.join(', ')})`);

    // Cartes : un seul lien, pas de bouton dedans
    for (const m of html.matchAll(/<a\b[^>]*class="[^"]*\bcard-link\b[^"]*"[^>]*>([\s\S]*?)<\/a>/g))
        if (/<(button|a)\b/i.test(m[1])) err(p, 'une .card-link contient un bouton ou un autre lien');
    for (const m of html.matchAll(/<a\b[^>]*class="[^"]*\bcard-soon\b[^"]*"[^>]*\bhref=/g))
        err(p, `carte « Bientôt » cliquable : ${m[0].slice(0, 60)}…`);

    // Liens et images locaux qui pointent vers rien
    for (const m of html.matchAll(/\b(?:src|href)="([^"#?]+)(?:[#?][^"]*)?"/g)) {
        const url = m[1];
        if (/^(https?:|mailto:|tel:|data:|javascript:|\/\/)/i.test(url) || url === '') continue;
        const chemin = url.startsWith('/') ? url.slice(1) : posix.join(dirname(p), url);
        if (!existsSync(decodeURI(chemin))) err(p, `fichier introuvable : ${url}`);
    }
    // Ancres internes
    for (const m of html.matchAll(/href="#([^"]+)"/g))
        if (!new RegExp(`id="${m[1].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`).test(html))
            err(p, `ancre #${m[1]} sans id correspondant`);
    if (/href="#"/.test(html)) warn(p, 'lien href="#" vide');

    // Images : alt obligatoire, pas d'image hors assets/img
    for (const m of html.matchAll(/<img\b[^>]*>/gi)) {
        if (!/\balt=/.test(m[0])) err(p, `image sans alt : ${m[0].slice(0, 70)}…`);
        const src = m[0].match(/src="([^"]+)"/)?.[1];
        if (src && !/^(https?:|data:)/.test(src) && !src.startsWith('assets/')) warn(p, `image hors assets/ : ${src}`);
    }
    // Textes en anglais oubliés (indices fréquents)
    if (/>\s*(Read more|Learn more|Sign in|Log in|Sign up|Coming soon|Download)\s*</i.test(html))
        warn(p, 'texte en anglais détecté');
}

// 4. Tokens de couleur : tailwind.config.cjs et style.css doivent rester alignés
if (existsSync(CONFIG_TW) && existsSync('style.css')) {
    const tw = readFileSync(CONFIG_TW, 'utf8');
    const vars = new Set(
        [...readFileSync('style.css', 'utf8').matchAll(/--[\w-]+\s*:\s*(#[0-9a-f]{3,8})/gi)].map((m) =>
            m[1].toLowerCase(),
        ),
    );
    for (const [, nom, hex] of tw.matchAll(/(\w+)\s*:\s*'(#[0-9a-fA-F]{3,8})'/g))
        if (!vars.has(hex.toLowerCase()))
            err('style.css', `token ${nom} (${hex}) sans variable --xxx équivalente dans style.css`);
}

// Rapport
for (const a of alertes) console.log(`  ⚠ ${a}`);
for (const e of erreurs) console.log(`  ✗ ${e}`);
console.log(
    erreurs.length
        ? `\nRègles maison : ${erreurs.length} erreur(s), ${alertes.length} alerte(s).`
        : `\nRègles maison : OK (${pages.length} pages, ${alertes.length} alerte(s)).`,
);
process.exit(erreurs.length ? 1 : 0);
