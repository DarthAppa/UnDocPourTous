// Client Stripe pour Deno (clé secrète lue dans les secrets Supabase, jamais dans le dépôt).
import Stripe from 'npm:stripe@17';
import { env } from './http.ts';

export { Stripe };

export function clientStripe(): Stripe | null {
    const cle = env('STRIPE_SECRET_KEY');
    if (!cle) return null;
    return new Stripe(cle, { httpClient: Stripe.createFetchHttpClient() });
}
