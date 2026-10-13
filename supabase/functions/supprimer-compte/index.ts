// supprimer-compte : supprime le compte de l'utilisateur connecté (et tout ce qui en dépend, par cascade).
// Entrée : Authorization: Bearer <JWT>, corps { confirmation: 'SUPPRIMER' }. Sortie : { ok: true }.
// L'id supprimé vient UNIQUEMENT du JWT vérifié (jamais du corps de la requête).
import { clientAdmin, servir, utilisateurDuJwt } from '../_shared/http.ts';
import { clientStripe } from '../_shared/stripe.ts';
import { confirmationSuppressionValide } from '../_shared/requete.js';
import { aResilier, statutStripeResiliable } from '../_shared/stripe-logique.js';

servir('supprimer-compte', async (req, corps) => {
    if (!confirmationSuppressionValide(corps))
        return { statut: 400, corps: { erreur: 'Écris SUPPRIMER pour confirmer' } };

    const admin = clientAdmin();
    const utilisateur = await utilisateurDuJwt(req, admin);
    if (!utilisateur) return { statut: 401, corps: { erreur: 'Connexion requise' } };

    const { data: ligne, error } = await admin
        .from('abonnements')
        .select('statut, stripe_subscription_id')
        .eq('user_id', utilisateur.id)
        .maybeSingle();
    if (error) throw new Error('lecture abonnements');

    // 1. Résilier l'abonnement Stripe d'abord : pas de compte supprimé encore facturé.
    if (aResilier(ligne)) {
        const stripe = clientStripe();
        if (!stripe) {
            console.error('supprimer-compte : abonnement à résilier mais Stripe non configuré');
            return { statut: 503, corps: { erreur: 'Suppression impossible pour le moment, contacte-nous' } };
        }
        try {
            const abonnement = await stripe.subscriptions.retrieve(ligne!.stripe_subscription_id);
            if (statutStripeResiliable(abonnement.status)) await stripe.subscriptions.cancel(abonnement.id);
        } catch (e) {
            // Abonnement introuvable chez Stripe : rien à résilier. Toute autre erreur : on s'arrête.
            if ((e as { code?: string })?.code !== 'resource_missing') {
                console.error('supprimer-compte : résiliation Stripe impossible', (e as { type?: string })?.type);
                return { statut: 502, corps: { erreur: 'Résiliation impossible pour le moment, réessaie plus tard' } };
            }
        }
    }

    // 2. Supprimer l'utilisateur : profils, abonnements, membres_pts suivent (on delete cascade).
    const { error: erreurSuppression } = await admin.auth.admin.deleteUser(utilisateur.id);
    if (erreurSuppression) {
        console.error('supprimer-compte : suppression impossible', erreurSuppression.status);
        return { statut: 500, corps: { erreur: 'Suppression impossible pour le moment, contacte-nous' } };
    }
    return { statut: 200, corps: { ok: true } };
});
