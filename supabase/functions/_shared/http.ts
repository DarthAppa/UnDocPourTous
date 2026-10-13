// Outils communs des Edge Functions (Deno) : CORS, réponses JSON, clients, utilisateur du JWT.
// La logique testable vit dans les fichiers .js voisins.
import { createClient, type SupabaseClient, type User } from 'npm:@supabase/supabase-js@2';
import { decisionCors, lireOrigines } from './cors.js';
import { analyserCorps, jetonBearer, TAILLE_MAX_CORPS } from './requete.js';

export type Corps = Record<string, unknown>;

export function env(nom: string): string {
    return (Deno.env.get(nom) ?? '').trim();
}

export function json(statut: number, corps: unknown, enTetes: Record<string, string> = {}): Response {
    return new Response(JSON.stringify(corps), {
        status: statut,
        headers: { ...enTetes, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
    });
}

// Client service_role : contourne la RLS, ne sort JAMAIS de la fonction.
export function clientAdmin(): SupabaseClient {
    return createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), {
        auth: { persistSession: false, autoRefreshToken: false },
    });
}

// Utilisateur désigné par le JWT « Authorization: Bearer … » (vérifié par Supabase Auth).
export async function utilisateurDuJwt(req: Request, admin: SupabaseClient): Promise<User | null> {
    const jwt = jetonBearer(req.headers.get('Authorization'));
    if (!jwt) return null;
    const { data, error } = await admin.auth.getUser(jwt);
    if (error || !data?.user) return null;
    return data.user;
}

type Gestionnaire = (req: Request, corps: Corps) => Promise<{ statut: number; corps: unknown }>;

// Enveloppe commune : CORS limité à SITE_ORIGINS, POST seulement, corps JSON borné,
// erreurs génériques (aucun détail interne renvoyé au navigateur).
export function servir(nom: string, gestionnaire: Gestionnaire): void {
    Deno.serve(async (req) => {
        const cors = decisionCors(req.headers.get('Origin'), lireOrigines(env('SITE_ORIGINS')));
        if (!cors.autorise) return json(403, { erreur: 'Origine non autorisée' }, cors.enTetes);
        if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors.enTetes });
        if (req.method !== 'POST')
            return json(405, { erreur: 'Méthode non autorisée' }, { ...cors.enTetes, Allow: 'POST, OPTIONS' });

        const longueur = Number(req.headers.get('Content-Length') ?? '0');
        if (longueur > TAILLE_MAX_CORPS) return json(413, { erreur: 'Requête trop grosse' }, cors.enTetes);
        let texte = '';
        try {
            texte = await req.text();
        } catch {
            return json(400, { erreur: 'Requête invalide' }, cors.enTetes);
        }
        const corps = texte.trim() === '' ? { ok: true, valeur: {} } : analyserCorps(texte);
        if (!corps.ok) return json(400, { erreur: 'Requête invalide' }, cors.enTetes);

        try {
            const r = await gestionnaire(req, corps.valeur as Corps);
            return json(r.statut, r.corps, cors.enTetes);
        } catch (e) {
            // Seulement le type d'erreur : jamais de jeton, de clé ni de corps de requête dans les journaux.
            console.error(`${nom} : erreur interne`, (e as { name?: string })?.name ?? 'inconnue');
            return json(500, { erreur: 'Erreur interne, réessaie plus tard' }, cors.enTetes);
        }
    });
}
