// Vérification « membre du serveur Discord PTS » (logique pure, fetch injecté → testable sans réseau).
// Ne journalise rien et ne renvoie jamais le jeton Discord.

export const API_DISCORD = 'https://discord.com/api/v10';
const SNOWFLAKE = /^\d{5,25}$/;
const JETON = /^[A-Za-z0-9._~+/=-]{10,200}$/;
const PAGES_MAX = 5; // 5 × 200 serveurs : au-delà, Discord limite de toute façon les comptes

export function snowflakeValide(id) {
    return typeof id === 'string' && SNOWFLAKE.test(id);
}

export function jetonDiscordValide(jeton) {
    return typeof jeton === 'string' && JETON.test(jeton);
}

// Id Discord lié au compte Supabase (identité « discord » enregistrée par Supabase Auth,
// donc fiable, contrairement à ce que le navigateur pourrait envoyer).
export function idDiscordDuCompte(utilisateur) {
    const identites = Array.isArray(utilisateur?.identities) ? utilisateur.identities : [];
    const discord = identites.find((i) => i?.provider === 'discord');
    if (!discord) return null;
    const candidats = [discord.identity_data?.provider_id, discord.identity_data?.sub, discord.provider_id, discord.id];
    return candidats.find((c) => snowflakeValide(c)) ?? null;
}

/** @typedef {{ ok: false, statut: number, erreur: string }} Echec */
/** @typedef {{ ok: true, membre: boolean, discordId: string }} Succes */

/** @returns {Echec} */
const echec = (statut, erreur) => ({ ok: false, statut, erreur });

async function appeler(fetchFn, chemin, jeton) {
    try {
        return await fetchFn(`${API_DISCORD}${chemin}`, { headers: { Authorization: `Bearer ${jeton}` } });
    } catch {
        return null;
    }
}

function echecHttp(reponse) {
    if (!reponse) return echec(502, 'Discord injoignable');
    if (reponse.status === 401) return echec(401, 'Connexion Discord expirée, reconnecte-toi');
    if (reponse.status === 429) return echec(503, 'Discord est surchargé, réessaie dans un instant');
    return echec(502, 'Réponse Discord inattendue');
}

// Renvoie { ok: true, membre, discordId } ou { ok: false, statut, erreur }.
// guildId vide → tout compte Discord (vérifié) est accepté comme membre.
/**
 * @param {{ providerToken: unknown, idDiscordAttendu: string | null, guildId: string, fetch: typeof globalThis.fetch }} p
 * @returns {Promise<Echec | Succes>}
 */
export async function verifierMembre({ providerToken, idDiscordAttendu, guildId, fetch: fetchFn }) {
    if (!jetonDiscordValide(providerToken)) return echec(400, 'Jeton Discord manquant ou invalide');
    if (!snowflakeValide(idDiscordAttendu)) return echec(403, 'Compte non lié à Discord');
    const serveur = String(guildId ?? '').trim();
    if (serveur !== '' && !snowflakeValide(serveur)) return echec(500, 'Configuration invalide');

    // 1. Le jeton doit appartenir au même compte Discord que l'utilisateur connecté :
    //    sinon on pourrait faire valider le jeton de quelqu'un d'autre (membre) pour soi.
    const moi = await appeler(fetchFn, '/users/@me', providerToken);
    if (!moi || !moi.ok) return echecHttp(moi);
    let profil;
    try {
        profil = await moi.json();
    } catch {
        return echec(502, 'Réponse Discord inattendue');
    }
    if (!profil || profil.id !== idDiscordAttendu) return echec(403, 'Ce jeton Discord ne correspond pas à ton compte');

    if (serveur === '') return { ok: true, membre: true, discordId: idDiscordAttendu };

    // 2. Liste des serveurs du compte (paginée par 200).
    let apres = null;
    for (let page = 0; page < PAGES_MAX; page++) {
        const chemin = `/users/@me/guilds?limit=200${apres ? `&after=${apres}` : ''}`;
        const rep = await appeler(fetchFn, chemin, providerToken);
        if (!rep || !rep.ok) return echecHttp(rep);
        let serveurs;
        try {
            serveurs = await rep.json();
        } catch {
            return echec(502, 'Réponse Discord inattendue');
        }
        if (!Array.isArray(serveurs)) return echec(502, 'Réponse Discord inattendue');
        if (serveurs.some((g) => g?.id === serveur)) return { ok: true, membre: true, discordId: idDiscordAttendu };
        if (serveurs.length < 200) break;
        apres = serveurs[serveurs.length - 1]?.id;
        if (!snowflakeValide(apres)) break;
    }
    return { ok: true, membre: false, discordId: idDiscordAttendu };
}
