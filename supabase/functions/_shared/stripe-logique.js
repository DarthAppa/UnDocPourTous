// Logique Stripe pure (sans SDK ni réseau), testée par tools/test-fonctions.mjs.
import { estUuid } from './requete.js';

export const OFFRES = ['premium'];

// Événements traités par le webhook ; tout le reste est ignoré (réponse 200).
export const EVENEMENTS_TRAITES = [
    'checkout.session.completed',
    'customer.subscription.created',
    'customer.subscription.updated',
    'customer.subscription.deleted',
    'invoice.payment_failed',
];

export function evenementTraite(type) {
    return EVENEMENTS_TRAITES.includes(type);
}

// Statut Stripe → statut maison. Inconnu → 'expire' (aucun accès plutôt qu'un accès indu).
const STATUTS = {
    active: 'actif',
    trialing: 'essai',
    past_due: 'impaye',
    unpaid: 'impaye',
    incomplete: 'impaye', // premier paiement pas encore réussi : pas d'accès
    canceled: 'annule',
    incomplete_expired: 'expire',
    paused: 'expire',
};
export function statutMaison(statutStripe) {
    return STATUTS[statutStripe] ?? 'expire';
}

export function donneAcces(statut, fin, maintenant = Date.now()) {
    return (statut === 'actif' || statut === 'essai') && (fin === null || new Date(fin).getTime() > maintenant);
}

const idStripe = (v) => (typeof v === 'string' ? v : typeof v?.id === 'string' ? v.id : null);

// Fin de période : current_period_end (API Stripe ≤ 2025-02) ou, plus récent, sur les items.
export function finDePeriode(abonnement) {
    let secondes = abonnement?.current_period_end;
    if (typeof secondes !== 'number') {
        const items = abonnement?.items?.data ?? [];
        const fins = items.map((i) => i?.current_period_end).filter((n) => typeof n === 'number');
        secondes = fins.length ? Math.max(...fins) : null;
    }
    if (abonnement?.status === 'canceled' && typeof abonnement?.ended_at === 'number') secondes = abonnement.ended_at;
    return typeof secondes === 'number' ? new Date(secondes * 1000).toISOString() : null;
}

// Ligne de la table abonnements à partir d'un abonnement Stripe (objet relu chez Stripe).
export function ligneAbonnement(abonnement, userId, maintenant = new Date()) {
    return {
        user_id: userId,
        offre: 'premium',
        statut: statutMaison(abonnement?.status),
        fin: finDePeriode(abonnement),
        stripe_customer_id: idStripe(abonnement?.customer),
        stripe_subscription_id: idStripe(abonnement),
        maj_le: maintenant.toISOString(),
    };
}

// Utilisateur Supabase désigné par les métadonnées posées à la création du paiement.
export function userIdDesMetadonnees(objet) {
    const id = objet?.metadata?.user_id;
    return estUuid(id) ? id : null;
}

// Id de l'abonnement Stripe concerné par un événement (null si l'événement n'en concerne pas).
export function abonnementDeLEvenement(evenement) {
    const o = evenement?.data?.object;
    switch (evenement?.type) {
        case 'checkout.session.completed':
            return o?.mode === 'subscription' ? idStripe(o.subscription) : null;
        case 'customer.subscription.created':
        case 'customer.subscription.updated':
        case 'customer.subscription.deleted':
            return idStripe(o);
        case 'invoice.payment_failed':
            return idStripe(o?.subscription) ?? idStripe(o?.parent?.subscription_details?.subscription);
        default:
            return null;
    }
}

// Utilisateur désigné directement par l'événement (checkout : client_reference_id).
export function userIdDeLEvenement(evenement) {
    const o = evenement?.data?.object;
    if (evenement?.type === 'checkout.session.completed') {
        const ref = o?.client_reference_id;
        if (estUuid(ref)) return ref;
    }
    return userIdDesMetadonnees(o);
}

// Faut-il écrire la nouvelle ligne ? Protège contre un vieil abonnement (annulé) dont un
// événement arriverait en retard et écraserait un abonnement plus récent encore valide.
export function doitAppliquer(existante, nouvelle, maintenant = Date.now()) {
    if (!existante) return true;
    if (!existante.stripe_subscription_id || existante.stripe_subscription_id === nouvelle.stripe_subscription_id)
        return true;
    if (donneAcces(nouvelle.statut, nouvelle.fin, maintenant)) return true;
    return !donneAcces(existante.statut, existante.fin, maintenant);
}

// Paramètres de la session Checkout : prix et URLs décidés côté serveur uniquement.
/**
 * @param {{ userId: string, email: string | null, customerId: string | null, priceId: string, base: string }} p
 * @returns {{ mode: 'subscription', line_items: { price: string, quantity: number }[], client_reference_id: string,
 *   metadata: Record<string, string>, subscription_data: { metadata: Record<string, string> },
 *   success_url: string, cancel_url: string, customer?: string, customer_email?: string }}
 */
export function parametresCheckout({ userId, email, customerId, priceId, base }) {
    /** @type {ReturnType<typeof parametresCheckout>} */
    const p = {
        mode: 'subscription',
        line_items: [{ price: priceId, quantity: 1 }],
        client_reference_id: userId,
        metadata: { user_id: userId, offre: 'premium' },
        subscription_data: { metadata: { user_id: userId, offre: 'premium' } },
        success_url: `${base}/profil.html?paiement=ok`,
        cancel_url: `${base}/albion-paiement.html?paiement=annule`,
    };
    if (customerId) p.customer = customerId;
    else if (email) p.customer_email = email;
    return p;
}

// Suppression de compte : faut-il aller voir chez Stripe ? (tout sauf un abonnement déjà annulé)
export function aResilier(ligne) {
    return Boolean(ligne?.stripe_subscription_id) && ligne?.statut !== 'annule';
}

// Statut Stripe d'un abonnement encore facturable (à résilier immédiatement).
export function statutStripeResiliable(statutStripe) {
    return !['canceled', 'incomplete_expired'].includes(statutStripe);
}
