// Construit le client Supabase local : assets/vendor/supabase.mjs (un seul fichier ESM minifié,
// exporte createClient). Remplace l'import depuis cdn.jsdelivr.net (pas de script tiers, CSP stricte).
// Usage : npm run vendor:supabase   (après une mise à jour de @supabase/supabase-js dans package.json,
//         version épinglée exactement), puis committer assets/vendor/supabase.mjs.
import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SORTIE = join(RACINE, 'assets', 'vendor', 'supabase.mjs');
const lirePkg = (nom) => JSON.parse(readFileSync(join(RACINE, 'node_modules', nom, 'package.json'), 'utf8'));
const { version } = lirePkg('@supabase/supabase-js');

const resultat = await build({
    stdin: { contents: "export { createClient } from '@supabase/supabase-js';", resolveDir: RACINE, loader: 'js' },
    bundle: true,
    format: 'esm',
    platform: 'browser',
    target: 'es2020',
    minify: true,
    legalComments: 'none', // licences regroupées dans l'en-tête ci-dessous
    // Dépendance facultative (traces OpenTelemetry) : non fournie, le client s'en passe.
    external: ['@opentelemetry/api'],
    metafile: true,
    write: false,
});

// Paquets réellement inclus dans le fichier, avec leur version et leur licence
const paquets = new Set();
for (const f of Object.keys(resultat.metafile.inputs)) {
    const m = f.match(/node_modules\/((?:@[^/]+\/)?[^/]+)\//);
    if (m) paquets.add(m[1]);
}
const liste = [...paquets]
    .sort()
    .map((nom) => {
        const p = lirePkg(nom);
        return ` *   ${nom}@${p.version} (${p.license})`;
    })
    .join('\n');

const entete = `/*!
 * Client Supabase pour le navigateur — @supabase/supabase-js ${version}
 * Licence MIT — Copyright (c) 2020 Supabase — https://github.com/supabase/supabase-js
 * Fichier GÉNÉRÉ par tools/vendor-supabase.mjs (esbuild) : ne pas modifier à la main.
 * Paquets inclus :
${liste}
 * Texte de la licence MIT : https://opensource.org/license/mit
 */
`;
mkdirSync(dirname(SORTIE), { recursive: true });
writeFileSync(SORTIE, entete + resultat.outputFiles[0].text);
console.log(
    `assets/vendor/supabase.mjs : supabase-js ${version}, ${Math.round(readFileSync(SORTIE).length / 1024)} Ko`,
);
