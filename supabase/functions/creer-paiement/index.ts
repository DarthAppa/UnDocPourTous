// creer-paiement : crée une session Stripe Checkout (abonnement premium) pour l'utilisateur connecté.
// Entrée : Authorization: Bearer <JWT>, corps { offre: 'premium' }. Sortie : { url }.
// Le prix (STRIPE_PRICE_PREMIUM) et les URLs de retour (SITE_URL) sont décidés ici, jamais par le client.
import { clientAdmin, env, servir, utilisateurDuJwt } from '../_shared/http.ts';
import { clientStripe } from '../_shared/stripe.ts';
import { baseSite } from '../_shared/requete.js';
import { donneAcces, OFFRES, parametresCheckout } from '../_shared/stripe-logique.js';

servir('creer-paiement', async (req, corps) => {
    if (!OFFRES.includes(corps.offre as string)) return { statut: 400, corps: { erreur: 'Offre inconnue' } };

    const stripe = clientStripe();
    const priceId = env('STRIPE_PRICE_PREMIUM');
    const base = baseSite(env('SITE_URL'));
    if (!stripe || !/^price_[A-Za-z0-9]+$/.test(priceId) || !base) {
        console.error('creer-paiement : configuration Stripe incomplète');
        return { statut: 503, corps: { erreur: 'Paiement indisponible pour le moment' } };
    }

    const admin = clientAdmin();
    const utilisateur = await utilisateurDuJwt(req, admin);
    if (!utilisateur) return { statut: 401, corps: { erreur: 'Connexion requise' } };

    const { data: ligne, error } = await admin
        .from('abonnements')
        .select('statut, fin, stripe_customer_id')
        .eq('user_id', utilisateur.id)
        .maybeSingle();
    if (error) throw new Error('lecture abonnements');
    if (ligne && donneAcces(ligne.statut, ligne.fin))
        return { statut: 409, corps: { erreur: 'Tu as déjà un abonnement actif : gère-le depuis ton profil' } };

    // Le webhook n'est peut-être pas encore passé (deux onglets, double clic, paiement en cours) :
    // on demande à Stripe s'il existe déjà un abonnement vivant pour ce compte, et on réutilise son client.
    let customerId: string | null = ligne?.stripe_customer_id ?? null;
    for await (const s of stripe.subscriptions.search({
        query: `metadata['user_id']:'${utilisateur.id}'`,
        limit: 100,
    })) {
        if (['active', 'trialing', 'past_due', 'unpaid', 'incomplete', 'paused'].includes(s.status))
            return {
                statut: 409,
                corps: { erreur: 'Un abonnement existe déjà pour ton compte : gère-le depuis ton profil' },
            };
        customerId ??= typeof s.customer === 'string' ? s.customer : s.customer.id;
    }

    const session = await stripe.checkout.sessions.create(
        parametresCheckout({
            userId: utilisateur.id,
            email: utilisateur.email ?? null,
            customerId,
            priceId,
            base,
        }),
    );
    if (!session.url) throw new Error('session sans url');
    return { statut: 200, corps: { url: session.url } };
});
