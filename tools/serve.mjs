// Site construit (dist/) en local sur http://127.0.0.1:5500 (pour tester la connexion Discord avant mise en ligne).
// Usage : npm run build puis npm run serve   (Ctrl+C pour arrêter). Pour modifier les pages : npm run dev.
import { demarrer } from './serveur.mjs';

const port = Number(process.argv[2]) || 5500;
const s = await demarrer('dist', port);
console.log(`Site en local : ${s.url}pts.html`);
