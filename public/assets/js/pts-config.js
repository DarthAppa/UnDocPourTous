// Réglages de la connexion Discord des outils Pack ta Small.
// Même projet Supabase que l'extension PTS Companion (un seul compte pour les deux).
// SUPABASE_URL et SUPABASE_ANON_KEY : Supabase › Project Settings › API.
// La clé « anon public » est faite pour être visible dans le navigateur (elle est protégée
// par les règles RLS de la base). Ne JAMAIS mettre ici la clé « service_role ».
export const PTS_CONFIG = {
    SUPABASE_URL: 'https://wibfiqtuqfddijjlfscs.supabase.co',
    SUPABASE_ANON_KEY:
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndpYmZpcXR1cWZkZGlqamxmc2NzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE4NTAwNjIsImV4cCI6MjEwNzQyNjA2Mn0.qAzmjV3jlSREIXY7Nrc0-lWMm5h1XK3DM51z6PFiFUc',

    // Connexions rapides actives dans la fenêtre de connexion. N'ajouter un fournisseur ici
    // qu'après l'avoir activé dans Supabase › Authentication › Providers (google, apple, twitch…).
    FOURNISSEURS: ['discord', 'google', 'twitch'],

    // Longueur minimale des mots de passe : même valeur que Supabase › Authentication › Policies.
    MDP_MIN: 10,

    // Serveur Discord « PACK TA SMALL » : il faut en être membre pour débloquer les outils.
    // Mettre '' pour débloquer avec n'importe quel compte Discord.
    GUILD_ID: '1329053478743572480',
    INVITATION: 'https://discord.gg/packtasmall',

    // Au-delà, on redemande une connexion pour revérifier l'appartenance au serveur.
    VERIF_JOURS: 30,

    // Déconnexion automatique après ce temps sans activité (souris, clavier, défilement, toucher).
    // Un avertissement s'affiche 1 minute avant.
    INACTIVITE_MINUTES: 30,
};
