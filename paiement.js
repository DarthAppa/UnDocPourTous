// Page de paiement Premium : « Payer et accéder ».
// - Non connecté : connexion d'abord, retour ici ensuite.
// - Connecté : le serveur crée la session Stripe Checkout (prix décidé côté serveur), on n'y va
//   que si l'adresse renvoyée est bien celle de Stripe Checkout.
import { appelerFonction, etat } from './pts-auth.js';

const STRIPE = 'https://checkout.stripe.com/';
const CONNEXION = 'connexion.html?retour=albion-paiement.html';
const btn = document.getElementById('payer');
const msg = document.getElementById('paiement-msg');

const dire = (t, ton = '') => {
    if (!msg) return;
    msg.textContent = t;
    msg.dataset.ton = ton;
};
const BIENTOT = 'Le paiement en ligne arrive bientôt. Merci de ta patience !';

if (new URLSearchParams(location.search).get('paiement') === 'annule')
    dire('Paiement annulé : aucun montant n’a été débité. Tu peux réessayer quand tu veux.');

btn?.addEventListener('click', async () => {
    btn.disabled = true;
    dire('Préparation du paiement…');
    try {
        const e = await etat();
        if (!e.connecte) {
            location.assign(CONNEXION);
            return;
        }
        const { url } = await appelerFonction('creer-paiement', { offre: 'premium' });
        if (typeof url === 'string' && url.startsWith(STRIPE)) {
            dire('Redirection vers la page de paiement sécurisée…');
            location.assign(url);
            return;
        }
        dire(BIENTOT, 'erreur');
    } catch (err) {
        if (err?.code === 'non-connecte') {
            location.assign(CONNEXION);
            return;
        }
        dire(BIENTOT, 'erreur');
    }
    btn.disabled = false;
});
