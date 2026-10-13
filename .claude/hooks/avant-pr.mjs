// Hook Claude Code (PreToolUse sur Bash) : bloque `gh pr create` / `gh pr merge`
// tant que `npm run verif` n'est pas vert, et interdit de contourner le hook git pre-push.
// Code 2 = commande refusée ; le message sur stderr est renvoyé à Claude.
import { spawnSync } from 'node:child_process';

let entree = '';
for await (const morceau of process.stdin) entree += morceau;

let commande = '';
try {
    commande = JSON.parse(entree)?.tool_input?.command ?? '';
} catch {
    process.exit(0);
}

const estPR = /\bgh\s+pr\s+(create|merge)\b/.test(commande);
const estPush = /\bgit\s+push\b/.test(commande);
if (!estPR && !estPush) process.exit(0);

if (/--no-verify\b|SKIP_SIMPLE_GIT_HOOKS/.test(commande)) {
    console.error('Refusé : interdit de contourner la vérification (--no-verify / SKIP_SIMPLE_GIT_HOOKS).');
    process.exit(2);
}

// Le push est déjà vérifié par le hook git pre-push : on ne relance pas deux fois.
if (!estPR) process.exit(0);

const dossier = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const r = spawnSync('npm run verif', { cwd: dossier, shell: true, encoding: 'utf8' });
if (r.status === 0) process.exit(0);

const sortie = `${r.stdout ?? ''}\n${r.stderr ?? ''}`.trim().split('\n').slice(-60).join('\n');
console.error(
    'Pull request bloquée : `npm run verif` échoue.\n' +
        'Corrige les points ci-dessous (skill verif-code), relance `npm run verif`, puis recrée la PR.\n\n' +
        sortie,
);
process.exit(2);
