// Politique de sécurité du contenu (CSP) de chaque page *.html de la racine.
// Écrit (ou remplace) juste après <meta charset> :
//   <meta http-equiv="Content-Security-Policy" content="…">  et  <meta name="referrer" content="strict-origin-when-cross-origin">
// Les scripts inline (pages Pack ta Small générées) sont autorisés un par un par leur hachage sha256 :
// aucun 'unsafe-inline' pour les scripts. Les gestionnaires inline (onclick="…", href="javascript:…")
// seraient bloqués : ils sont signalés comme erreurs (les réécrire en addEventListener).
// Usage : npm run csp                  (met à jour les pages ; idempotent)
//         node tools/csp.mjs --check   (code 1 si une page n'a pas la bonne CSP)
// À relancer après toute modification d'un script inline (import:pts le fait déjà).
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const REFERRER = 'strict-origin-when-cross-origin';

// Projet Supabase lu dans pts-config.js (une seule source de vérité)
export function urlSupabase(racine = RACINE) {
    const conf = readFileSync(join(racine, 'pts-config.js'), 'utf8');
    const m = conf.match(/SUPABASE_URL\s*:\s*'(https:\/\/[a-z0-9-]+\.supabase\.co)'/);
    if (!m) throw new Error('SUPABASE_URL introuvable (ou invalide) dans pts-config.js');
    return m[1];
}

// Scripts exécutables écrits dans la page (pas les blocs de données type="application/json")
const TYPES_JS = /^(|module|text\/javascript|application\/javascript|text\/ecmascript)$/i;
function scriptsInline(html) {
    const liste = [];
    for (const m of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script[^>]*>/gi)) {
        const attrs = m[1];
        if (/\bsrc\s*=/i.test(attrs)) continue;
        const type = (attrs.match(/\btype\s*=\s*["']?([^"'\s>]*)/i)?.[1] ?? '').trim();
        if (TYPES_JS.test(type) || /^importmap$/i.test(type)) liste.push(m[2]);
    }
    return liste;
}

// Le navigateur hache le texte du script après normalisation des fins de ligne (CRLF → LF) :
// même résultat que le fichier soit extrait en CRLF (Windows) ou en LF (GitHub Pages).
const hachage = (code) =>
    `'sha256-${createHash('sha256').update(code.replace(/\r\n?/g, '\n'), 'utf8').digest('base64')}'`;

// Anti-robot Cloudflare Turnstile : autorisé seulement sur les pages qui le déclarent
// (<meta name="undoc-captcha" content="turnstile">), c'est-à-dire la page de connexion.
const TURNSTILE = 'https://challenges.cloudflare.com';
const avecCaptcha = (html) => /<meta\s+name\s*=\s*"undoc-captcha"\s+content\s*=\s*"turnstile"/i.test(html);

export function politique(html, supabase) {
    const hote = new URL(supabase).host;
    const hachages = [...new Set(scriptsInline(html).map(hachage))];
    const captcha = avecCaptcha(html);
    return [
        "default-src 'self'",
        ["script-src 'self'", ...hachages, ...(captcha ? [TURNSTILE] : [])].join(' '),
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "font-src 'self' https://fonts.gstatic.com",
        "img-src 'self' data: https://cdn.discordapp.com",
        `connect-src 'self' https://${hote} wss://${hote}${captcha ? ` ${TURNSTILE}` : ''}`,
        captcha ? `frame-src ${TURNSTILE}` : "frame-src 'none'",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
        'upgrade-insecure-requests',
    ].join('; ');
}

// Gestionnaires inline et URL javascript: (bloqués par la CSP) — hors contenu des <script>/<style>
export function gestionnairesInline(html) {
    const balisage = html.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1[^>]*>/gi, '').replace(/<!--[\s\S]*?-->/g, '');
    const trouves = [];
    for (const m of balisage.matchAll(/<[a-z][^>]*>/gi)) {
        for (const a of m[0].matchAll(/\s(on[a-z]+)\s*=/gi)) trouves.push(`${a[1]}= dans ${m[0].slice(0, 80)}`);
        if (/\s(?:href|src|action|formaction)\s*=\s*["']?\s*javascript:/i.test(m[0]))
            trouves.push(`URL javascript: dans ${m[0].slice(0, 80)}`);
    }
    return trouves;
}

const RE_CSP = /[ \t]*<meta\s+http-equiv\s*=\s*"Content-Security-Policy"\s+content\s*=\s*"([^"]*)"\s*\/?>[ \t]*\r?\n?/i;
const RE_REF = /[ \t]*<meta\s+name\s*=\s*"referrer"\s+content\s*=\s*"([^"]*)"\s*\/?>[ \t]*\r?\n?/i;
const normaliser = (csp) => csp.replace(/\s+/g, ' ').trim();

// État de la page : { ok, attendue } ; ok = CSP et referrer déjà corrects
export function etat(html, supabase) {
    const attendue = politique(html, supabase);
    const csp = html.match(RE_CSP)?.[1];
    const ref = html.match(RE_REF)?.[1];
    return { attendue, ok: csp != null && normaliser(csp) === attendue && ref === REFERRER };
}

// Renvoie la page avec la bonne CSP (inchangée si elle l'a déjà : idempotent, ne casse pas la mise en forme)
export function appliquerCsp(html, supabase) {
    const { ok, attendue } = etat(html, supabase);
    if (ok) return html;
    const propre = html.replace(RE_CSP, '').replace(RE_REF, '');
    const charset = propre.match(/^([ \t]*)<meta\s+charset\s*=[^>]*?(\s*\/)?>[ \t]*(\r?\n)/im);
    if (!charset) throw new Error('<meta charset> introuvable');
    const [ligne, retrait, fermeture, fin] = charset;
    const f = fermeture ? ' />' : '>';
    const ajout =
        `${retrait}<meta http-equiv="Content-Security-Policy" content="${attendue}"${f}${fin}` +
        `${retrait}<meta name="referrer" content="${REFERRER}"${f}${fin}`;
    return propre.replace(ligne, ligne + ajout);
}

// Ligne de commande
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    const verifier = process.argv.includes('--check');
    const supabase = urlSupabase();
    const pages = readdirSync(RACINE).filter((f) => f.endsWith('.html'));
    let erreurs = 0;
    let modifiees = 0;
    for (const p of pages) {
        const chemin = join(RACINE, p);
        const html = readFileSync(chemin, 'utf8');
        for (const g of gestionnairesInline(html)) {
            console.error(`✗ ${p} : ${g} → bloqué par la CSP, réécrire en addEventListener`);
            erreurs++;
        }
        if (verifier) {
            if (!etat(html, supabase).ok) {
                console.error(`✗ ${p} : CSP absente ou pas à jour → npm run csp`);
                erreurs++;
            }
            continue;
        }
        const nouveau = appliquerCsp(html, supabase);
        if (nouveau !== html) {
            writeFileSync(chemin, nouveau);
            modifiees++;
            console.log(`  ${p} : CSP mise à jour`);
        }
    }
    if (erreurs) process.exit(1);
    console.log(
        verifier
            ? `✓ CSP à jour sur ${pages.length} pages.`
            : `CSP : ${modifiees} page(s) mise(s) à jour sur ${pages.length}.`,
    );
}
