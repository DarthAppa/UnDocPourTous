// Petit serveur statique local (les modules JS ne marchent pas en file://).
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';

const TYPES = {
    '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.mjs': 'text/javascript',
    '.json': 'application/json', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.png': 'image/png',
    '.jpg': 'image/jpeg', '.ico': 'image/x-icon', '.woff2': 'font/woff2'
};

export function demarrer(racine = process.cwd()) {
    const base = resolve(racine);
    const srv = createServer(async (req, res) => {
        const chemin = decodeURIComponent(new URL(req.url, 'http://x').pathname);
        const fichier = resolve(base, '.' + (chemin.endsWith('/') ? chemin + 'index.html' : chemin));
        if (!fichier.startsWith(base + sep) && fichier !== base) { res.writeHead(403).end(); return; }
        try {
            const data = await readFile(fichier);
            res.writeHead(200, { 'Content-Type': TYPES[extname(fichier)] || 'application/octet-stream' }).end(data);
        } catch { res.writeHead(404).end(); }
    });
    return new Promise((ok) => srv.listen(0, '127.0.0.1', () => ok({ url: `http://127.0.0.1:${srv.address().port}/`, fermer: () => srv.close() })));
}
