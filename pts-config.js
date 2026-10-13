// Réglages de la connexion Discord des outils Pack ta Small.
// Même projet Supabase que l'extension PTS Companion (un seul compte pour les deux).
// SUPABASE_URL et SUPABASE_ANON_KEY : Supabase › Project Settings › API.
// La clé « anon public » est faite pour être visible dans le navigateur (elle est protégée
// par les règles RLS de la base). Ne JAMAIS mettre ici la clé « service_role ».
export const PTS_CONFIG = {
    SUPABASE_URL: 'https://REMPLACER.supabase.co',
    SUPABASE_ANON_KEY: 'REMPLACER_PAR_LA_CLE_ANON',

    // Serveur Discord « PACK TA SMALL » : il faut en être membre pour débloquer les outils.
    // Mettre '' pour débloquer avec n'importe quel compte Discord.
    GUILD_ID: '1329053478743572480',
    INVITATION: 'https://discord.gg/packtasmall',

    // Au-delà, on redemande une connexion pour revérifier l'appartenance au serveur.
    VERIF_JOURS: 30,

    // Déconnexion automatique après ce temps sans activité (souris, clavier, défilement, toucher).
    // Un avertissement s'affiche 1 minute avant.
    INACTIVITE_MINUTES: 30
};
