// stripe-webhook : reçoit les événements Stripe et tient la table abonnements à jour.
// verify_jwt = false (Stripe n'a pas de JWT Supabase) : la sécurité repose sur la signature
// Stripe, vérifiée sur le corps BRUT avec STRIPE_WEBHOOK_SECRET. Pas de CORS : jamais appelé
// par un navigateur.
// Idempotent : on relit l'abonnement chez Stripe (état à jour, peu importe l'ordre ou le
// nombre de livraisons) puis on fait un upsert. Événements inconnus : 200, ignorés.
import { clientAdmin, env, json } from '../_shared/http.ts';
import { clientStripe, Stripe } from '../_shared/stripe.ts';
import {
    abonnementDeLEvenement,
    doitAppliquer,
    evenementTraite,
    ligneAbonnement,
    userIdDeLEvenement,
    userIdDesMetadonnees,
} from '../_shared/stripe-logique.js';

const TAILLE_MAX = 512_000;
const fournisseurCrypto = Stripe.createSubtleCryptoProvider();

Deno.serve(async (req) => {
    if (req.method !== 'POST') return json(405, { erreur: 'Méthode non autorisée' }, { Allow: 'POST' });

    const stripe = clientStripe();
    const secret = env('STRIPE_WEBHOOK_SECRET');
    if (!stripe || !secret) {
        console.error('stripe-webhook : configuration Stripe incomplète');
        return json(503, { erreur: 'Indisponible' });
    }

    const signature = req.headers.get('Stripe-Signature');
    if (!signature) return json(400, { erreur: 'Signature manquante' });
    if (Number(req.headers.get('Content-Length') ?? '0') > TAILLE_MAX) return json(413, { erreur: 'Trop gros' });

    // Corps brut : le moindre changement (re-sérialisation JSON) casserait la signature.
    const brut = await req.text();
    let evenement: Stripe.Event;
    try {
        evenement = await stripe.webhooks.constructEventAsync(brut, signature, secret, undefined, fournisseurCrypto);
    } catch {
        return json(400, { erreur: 'Signature invalide' });
    }

    if (!evenementTraite(evenement.type)) return json(200, { recu: true, ignore: true });

    const idAbonnement = abonnementDeLEvenement(evenement);
    if (!idAbonnement) return json(200, { recu: true, ignore: true });

    try {
        const admin = clientAdmin();
        // État actuel chez Stripe (et non celui, peut-être périmé, contenu dans l'événement).
        const abonnement = await stripe.subscriptions.retrieve(idAbonnement);
        const customerId = typeof abonnement.customer === 'string' ? abonnement.customer : abonnement.customer.id;

        // Qui est l'utilisateur ? 1) l'événement (checkout), 2) les métadonnées de l'abonnement,
        // 3) une ligne déjà connue pour cet abonnement ou ce client.
        let userId: string | null = userIdDeLEvenement(evenement) ?? userIdDesMetadonnees(abonnement);
        for (const [colonne, valeur] of [
            ['stripe_subscription_id', abonnement.id],
            ['stripe_customer_id', customerId],
        ]) {
            if (userId) break;
            const { data, error } = await admin.from('abonnements').select('user_id').eq(colonne, valeur).maybeSingle();
            if (error) throw new Error('lecture abonnements');
            userId = data?.user_id ?? null;
        }
        if (!userId) {
            console.warn('stripe-webhook : abonnement sans utilisateur connu, ignoré', evenement.id);
            return json(200, { recu: true, ignore: true });
        }

        const nouvelle = ligneAbonnement(abonnement, userId);
        const { data: existante, error: erreurLecture } = await admin
            .from('abonnements')
            .select('statut, fin, stripe_subscription_id')
            .eq('user_id', userId)
            .maybeSingle();
        if (erreurLecture) throw new Error('lecture abonnements');
        if (!doitAppliquer(existante, nouvelle)) return json(200, { recu: true, ignore: true });

        const { error } = await admin.from('abonnements').upsert(nouvelle, { onConflict: 'user_id' });
        if (error) {
            // Utilisateur supprimé entre-temps (clé étrangère) : rien à mettre à jour.
            if (error.code === '23503') return json(200, { recu: true, ignore: true });
            throw new Error(`écriture abonnements ${error.code}`);
        }
        return json(200, { recu: true });
    } catch (e) {
        // 500 → Stripe relivrera l'événement plus tard.
        console.error('stripe-webhook : traitement impossible', evenement.id, (e as Error)?.message);
        return json(500, { erreur: 'Erreur interne' });
    }
});
