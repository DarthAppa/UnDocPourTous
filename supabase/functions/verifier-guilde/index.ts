// verifier-guilde : enregistre si l'utilisateur connecté est membre du serveur Discord PTS.
// Entrée : Authorization: Bearer <JWT Supabase>, corps { provider_token }.
// Sortie : { membre, verifie_le }. Le jeton Discord n'est ni stocké, ni renvoyé, ni journalisé.
import { clientAdmin, env, servir, utilisateurDuJwt } from '../_shared/http.ts';
import { idDiscordDuCompte, verifierMembre } from '../_shared/discord.js';

servir('verifier-guilde', async (req, corps) => {
    const admin = clientAdmin();
    const utilisateur = await utilisateurDuJwt(req, admin);
    if (!utilisateur) return { statut: 401, corps: { erreur: 'Connexion requise' } };

    const resultat = await verifierMembre({
        providerToken: corps.provider_token,
        idDiscordAttendu: idDiscordDuCompte(utilisateur),
        guildId: env('GUILD_ID'),
        fetch,
    });
    if (!resultat.ok) return { statut: resultat.statut, corps: { erreur: resultat.erreur } };

    const verifie_le = new Date().toISOString();
    const { error } = await admin
        .from('membres_pts')
        .upsert(
            { user_id: utilisateur.id, discord_id: resultat.discordId, membre: resultat.membre, verifie_le },
            { onConflict: 'user_id' },
        );
    if (error) {
        console.error('verifier-guilde : écriture membres_pts impossible', error.code);
        return { statut: 500, corps: { erreur: 'Erreur interne, réessaie plus tard' } };
    }
    return { statut: 200, corps: { membre: resultat.membre, verifie_le } };
});
