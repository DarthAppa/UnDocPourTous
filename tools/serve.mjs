// Site en local sur http://127.0.0.1:5500 (pour tester la connexion Discord avant mise en ligne).
// Usage : npm run serve   (Ctrl+C pour arrêter)
import { demarrer } from './serveur.mjs';

const port = Number(process.argv[2]) || 5500;
const s = await demarrer(process.cwd(), port);
console.log(`Site en local : ${s.url}pts.html`);
