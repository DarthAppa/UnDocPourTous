// portail-abonnement : ouvre le portail de facturation Stripe du client connecté.
// Entrée : Authorization: Bearer <JWT>. Sortie : { url }. Retour fixe vers SITE_URL/profil.html.
import { clientAdmin, env, servir, utilisateurDuJwt } from '../_shared/http.ts';
import { clientStripe } from '../_shared/stripe.ts';
import { baseSite } from '../_shared/requete.js';

servir('portail-abonnement', async (req) => {
    const stripe = clientStripe();
    const base = baseSite(env('SITE_URL'));
    if (!stripe || !base) {
        console.error('portail-abonnement : configuration Stripe incomplète');
        return { statut: 503, corps: { erreur: 'Portail indisponible pour le moment' } };
    }

    const admin = clientAdmin();
    const utilisateur = await utilisateurDuJwt(req, admin);
    if (!utilisateur) return { statut: 401, corps: { erreur: 'Connexion requise' } };

    const { data: ligne, error } = await admin
        .from('abonnements')
        .select('stripe_customer_id')
        .eq('user_id', utilisateur.id)
        .maybeSingle();
    if (error) throw new Error('lecture abonnements');
    if (!ligne?.stripe_customer_id) return { statut: 404, corps: { erreur: 'Aucun abonnement à gérer' } };

    const portail = await stripe.billingPortal.sessions.create({
        customer: ligne.stripe_customer_id,
        return_url: `${base}/profil.html`,
    });
    return { statut: 200, corps: { url: portail.url } };
});
