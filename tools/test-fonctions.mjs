// Teste la logique pure des Edge Functions Supabase (supabase/functions/_shared/*.js).
// Usage : node tools/test-fonctions.mjs   (aucun réseau : les appels Discord passent par un faux fetch)
import { decisionCors, lireOrigines } from '../supabase/functions/_shared/cors.js';
import {
    analyserCorps,
    baseSite,
    confirmationSuppressionValide,
    estUuid,
    jetonBearer,
} from '../supabase/functions/_shared/requete.js';
import { niveauValide, slugValide, titreValide } from '../supabase/functions/_shared/contenus.js';
import { idDiscordDuCompte, verifierMembre } from '../supabase/functions/_shared/discord.js';
import {
    abonnementDeLEvenement,
    aResilier,
    doitAppliquer,
    donneAcces,
    evenementTraite,
    finDePeriode,
    ligneAbonnement,
    parametresCheckout,
    statutMaison,
    statutStripeResiliable,
    userIdDeLEvenement,
} from '../supabase/functions/_shared/stripe-logique.js';

let echecs = 0;
let reussites = 0;
const verif = (ok, texte) => {
    console.log(`${ok ? '  ✓' : '  ✗'} ${texte}`);
    if (ok) reussites++;
    else echecs++;
};

const UID = '3f1c2b7a-9d4e-4c51-8a2b-1234567890ab';
const ID_DISCORD = '123456789012345678';
const AUTRE_DISCORD = '987654321098765432';
const GUILDE = '1329053478743572480';
const JETON = 'jetonDiscordDeTest1234';

// Faux fetch Discord : enregistre les appels, répond selon une table chemin → réponse.
function fauxFetch(routes) {
    const appels = [];
    const f = async (url, options) => {
        appels.push({ url, auth: options?.headers?.Authorization });
        const chemin = url.replace('https://discord.com/api/v10', '');
        const cle = Object.keys(routes).find((k) => chemin.startsWith(k));
        if (!cle) return { ok: false, status: 404, json: async () => ({}) };
        const r = typeof routes[cle] === 'function' ? routes[cle](chemin) : routes[cle];
        if (r === 'reseau') throw new Error('réseau coupé');
        return { ok: r.status >= 200 && r.status < 300, status: r.status, json: async () => r.corps };
    };
    f.appels = appels;
    return f;
}
const moi = (id) => ({ status: 200, corps: { id, username: 'testeur' } });
const utilisateur = (id) => ({
    id: UID,
    identities: [{ provider: 'discord', id, identity_data: { provider_id: id, sub: id } }],
});

console.log('\n[CORS]');
const origines = lireOrigines(' https://undocpourtous.com/ , http://127.0.0.1:5500,pas-une-url, ');
verif(
    origines.length === 2 && origines[0] === 'https://undocpourtous.com' && origines[1] === 'http://127.0.0.1:5500',
    'SITE_ORIGINS lu (espaces, « / » final et entrées invalides ignorés)',
);
let d = decisionCors('https://undocpourtous.com', origines);
verif(
    d.autorise && d.enTetes['Access-Control-Allow-Origin'] === 'https://undocpourtous.com',
    'origine autorisée : en-tête renvoyé pour elle seule',
);
d = decisionCors('https://pirate.exemple', origines);
verif(
    !d.autorise && !('Access-Control-Allow-Origin' in d.enTetes),
    'origine non autorisée : refus, sans Access-Control-Allow-Origin',
);
d = decisionCors('https://undocpourtous.com.pirate.exemple', origines);
verif(!d.autorise, 'origine qui commence comme le site : refusée');
d = decisionCors(null, origines);
verif(
    d.autorise && !('Access-Control-Allow-Origin' in d.enTetes),
    'sans Origin (appel serveur) : accepté sans en-tête CORS',
);
verif(
    !decisionCors('https://undocpourtous.com', lireOrigines('')).autorise,
    'SITE_ORIGINS vide : aucune origine autorisée',
);
verif(!decisionCors('null', origines).autorise, 'Origin « null » refusée');

console.log('\n[requêtes]');
verif(
    jetonBearer('Bearer abc.def-ghi') === 'abc.def-ghi' && jetonBearer('abc') === null && jetonBearer(null) === null,
    'en-tête Bearer lu',
);
verif(
    analyserCorps('{"offre":"premium"}').ok &&
        !analyserCorps('[1]').ok &&
        !analyserCorps('nul').ok &&
        !analyserCorps('null').ok,
    'corps JSON : objet seulement',
);
verif(!analyserCorps(`{"x":"${'a'.repeat(20000)}"}`).ok, 'corps trop gros refusé');
verif(estUuid(UID) && !estUuid('1 or 1=1') && !estUuid(42), 'uuid validé');
verif(baseSite('https://undocpourtous.com/') === 'https://undocpourtous.com', 'SITE_URL : « / » final retiré');
verif(baseSite('http://127.0.0.1:5500') === 'http://127.0.0.1:5500', 'SITE_URL local en http accepté');
verif(
    baseSite('http://undocpourtous.com') === null && baseSite('javascript:alert(1)') === null && baseSite('') === null,
    'SITE_URL non https refusée',
);

console.log('\n[suppression de compte]');
verif(confirmationSuppressionValide({ confirmation: 'SUPPRIMER' }), 'confirmation exacte acceptée');
verif(
    ['supprimer', 'SUPPRIMER ', ' SUPPRIMER', 'OUI', '', null, true].every(
        (c) => !confirmationSuppressionValide({ confirmation: c }),
    ),
    'confirmation approximative refusée (casse, espaces, autre mot)',
);
verif(!confirmationSuppressionValide(null) && !confirmationSuppressionValide({}), 'confirmation absente refusée');
verif(
    aResilier({ statut: 'actif', stripe_subscription_id: 'sub_1' }) &&
        aResilier({ statut: 'impaye', stripe_subscription_id: 'sub_1' }),
    'abonnement actif ou impayé : à résilier',
);
verif(
    !aResilier({ statut: 'annule', stripe_subscription_id: 'sub_1' }) &&
        !aResilier({ statut: 'actif' }) &&
        !aResilier(null),
    'rien à résilier sinon',
);
verif(statutStripeResiliable('active') && !statutStripeResiliable('canceled'), 'statut Stripe résiliable');

console.log('\n[contenus]');
verif(['guide-albion', 'a', 'tier-list-2026'].every(slugValide), 'slugs valides acceptés');
verif(
    ['', 'Guide', 'guide albion', '../secret', 'guide_albion', 'é', 'a'.repeat(101), null, 42].every(
        (s) => !slugValide(s),
    ),
    'slugs invalides refusés (majuscule, espace, chemin, accent, trop long)',
);
verif(niveauValide('premium') && niveauValide('pts') && !niveauValide('gratuit'), 'niveaux premium / pts seulement');
verif(titreValide('Guide') && !titreValide('  ') && !titreValide('x'.repeat(201)), 'titre validé');

console.log('\n[identité Discord]');
verif(idDiscordDuCompte(utilisateur(ID_DISCORD)) === ID_DISCORD, 'id Discord lu dans les identités Supabase');
verif(
    idDiscordDuCompte({ identities: [{ provider: 'github', id: ID_DISCORD }] }) === null,
    'compte sans identité Discord : null',
);
verif(idDiscordDuCompte({}) === null && idDiscordDuCompte(null) === null, 'utilisateur vide : null');

console.log('\n[verifier-guilde]');
let f = fauxFetch({
    '/users/@me/guilds': { status: 200, corps: [{ id: '1111111' }, { id: GUILDE }] },
    '/users/@me': moi(ID_DISCORD),
});
let r = await verifierMembre({ providerToken: JETON, idDiscordAttendu: ID_DISCORD, guildId: GUILDE, fetch: f });
verif(r.ok && r.membre === true && r.discordId === ID_DISCORD, 'membre du serveur : membre = true');
verif(
    f.appels.every((a) => a.auth === `Bearer ${JETON}`),
    'le jeton n’est envoyé qu’à Discord, en Bearer',
);
verif(!JSON.stringify(r).includes(JETON), 'le résultat ne contient jamais le jeton');

f = fauxFetch({ '/users/@me/guilds': { status: 200, corps: [{ id: '1111111' }] }, '/users/@me': moi(ID_DISCORD) });
r = await verifierMembre({ providerToken: JETON, idDiscordAttendu: ID_DISCORD, guildId: GUILDE, fetch: f });
verif(r.ok && r.membre === false, 'pas dans le serveur : membre = false');

f = fauxFetch({ '/users/@me/guilds': { status: 200, corps: [{ id: GUILDE }] }, '/users/@me': moi(AUTRE_DISCORD) });
r = await verifierMembre({ providerToken: JETON, idDiscordAttendu: ID_DISCORD, guildId: GUILDE, fetch: f });
verif(!r.ok && r.statut === 403, 'jeton d’un AUTRE compte Discord : refus 403');
verif(!f.appels.some((a) => a.url.includes('/guilds')), '… et la liste des serveurs n’est même pas demandée');

r = await verifierMembre({ providerToken: JETON, idDiscordAttendu: null, guildId: GUILDE, fetch: fauxFetch({}) });
verif(!r.ok && r.statut === 403, 'compte Supabase sans identité Discord : refus 403');

f = fauxFetch({ '/users/@me': moi(ID_DISCORD) });
r = await verifierMembre({ providerToken: JETON, idDiscordAttendu: ID_DISCORD, guildId: '', fetch: f });
verif(r.ok && r.membre === true && f.appels.length === 1, 'GUILD_ID vide : tout compte Discord vérifié est accepté');

r = await verifierMembre({ providerToken: JETON, idDiscordAttendu: ID_DISCORD, guildId: 'abc', fetch: fauxFetch({}) });
verif(!r.ok && r.statut === 500, 'GUILD_ID mal formé : erreur de configuration');

const refus = [];
for (const jeton of [undefined, '', 'court', 'a b c d e f g h', 'x'.repeat(300), { faux: true }]) {
    f = fauxFetch({});
    r = await verifierMembre({ providerToken: jeton, idDiscordAttendu: ID_DISCORD, guildId: GUILDE, fetch: f });
    refus.push(!r.ok && r.statut === 400 && f.appels.length === 0);
}
verif(refus.every(Boolean), 'jetons Discord absents ou mal formés : refus 400 sans appeler Discord');

r = await verifierMembre({
    providerToken: JETON,
    idDiscordAttendu: ID_DISCORD,
    guildId: GUILDE,
    fetch: fauxFetch({ '/users/@me': { status: 401, corps: {} } }),
});
verif(!r.ok && r.statut === 401, 'jeton Discord expiré : 401');
r = await verifierMembre({
    providerToken: JETON,
    idDiscordAttendu: ID_DISCORD,
    guildId: GUILDE,
    fetch: fauxFetch({ '/users/@me': 'reseau' }),
});
verif(!r.ok && r.statut === 502, 'Discord injoignable : 502');
f = fauxFetch({ '/users/@me/guilds': { status: 429, corps: {} }, '/users/@me': moi(ID_DISCORD) });
r = await verifierMembre({ providerToken: JETON, idDiscordAttendu: ID_DISCORD, guildId: GUILDE, fetch: f });
verif(!r.ok && r.statut === 503, 'Discord limite le débit : 503 (pas « non membre »)');

// Plus de 200 serveurs : la deuxième page est demandée.
const page1 = Array.from({ length: 200 }, (_, i) => ({ id: String(10000000 + i) }));
f = fauxFetch({
    '/users/@me/guilds': (chemin) => ({ status: 200, corps: chemin.includes('after=') ? [{ id: GUILDE }] : page1 }),
    '/users/@me': moi(ID_DISCORD),
});
r = await verifierMembre({ providerToken: JETON, idDiscordAttendu: ID_DISCORD, guildId: GUILDE, fetch: f });
verif(
    r.ok && r.membre === true && f.appels.some((a) => a.url.includes('after=10000199')),
    'plus de 200 serveurs : pagination',
);

console.log('\n[Stripe : statuts]');
const attendus = {
    active: 'actif',
    trialing: 'essai',
    past_due: 'impaye',
    unpaid: 'impaye',
    canceled: 'annule',
    incomplete_expired: 'expire',
};
verif(
    Object.entries(attendus).every(([s, m]) => statutMaison(s) === m),
    'active/trialing/past_due/unpaid/canceled/incomplete_expired traduits',
);
verif(
    statutMaison('incomplete') === 'impaye' &&
        statutMaison('inconnu') === 'expire' &&
        statutMaison(undefined) === 'expire',
    'statut inconnu : aucun accès',
);
const futur = new Date(Date.now() + 864e5).toISOString();
const passe = new Date(Date.now() - 864e5).toISOString();
verif(
    donneAcces('actif', futur) &&
        donneAcces('essai', null) &&
        !donneAcces('actif', passe) &&
        !donneAcces('annule', futur),
    'accès = actif/essai et fin non passée',
);

console.log('\n[Stripe : événements]');
verif(
    evenementTraite('customer.subscription.updated') &&
        !evenementTraite('charge.succeeded') &&
        !evenementTraite(undefined),
    'événements inconnus ignorés',
);
const sub = {
    id: 'sub_123',
    status: 'active',
    customer: 'cus_123',
    current_period_end: 1893456000,
    metadata: { user_id: UID },
};
verif(finDePeriode(sub) === '2030-01-01T00:00:00.000Z', 'fin = current_period_end');
verif(
    finDePeriode({ status: 'active', items: { data: [{ current_period_end: 1893456000 }] } }) ===
        '2030-01-01T00:00:00.000Z',
    'fin lue sur les items (API Stripe récente)',
);
const ligne = ligneAbonnement(sub, UID, new Date('2026-10-13T00:00:00Z'));
verif(
    ligne.user_id === UID &&
        ligne.statut === 'actif' &&
        ligne.offre === 'premium' &&
        ligne.stripe_customer_id === 'cus_123' &&
        ligne.stripe_subscription_id === 'sub_123',
    'ligne abonnements construite',
);
verif(
    abonnementDeLEvenement({
        type: 'checkout.session.completed',
        data: { object: { mode: 'subscription', subscription: 'sub_9' } },
    }) === 'sub_9',
    'checkout : abonnement trouvé',
);
verif(
    abonnementDeLEvenement({ type: 'checkout.session.completed', data: { object: { mode: 'payment' } } }) === null,
    'checkout hors abonnement : ignoré',
);
verif(
    abonnementDeLEvenement({ type: 'customer.subscription.deleted', data: { object: sub } }) === 'sub_123',
    'subscription.* : abonnement trouvé',
);
verif(
    abonnementDeLEvenement({ type: 'invoice.payment_failed', data: { object: { subscription: 'sub_7' } } }) ===
        'sub_7' &&
        abonnementDeLEvenement({
            type: 'invoice.payment_failed',
            data: { object: { parent: { subscription_details: { subscription: 'sub_8' } } } },
        }) === 'sub_8',
    'invoice.payment_failed : abonnement trouvé (ancienne et nouvelle API)',
);
verif(
    userIdDeLEvenement({ type: 'checkout.session.completed', data: { object: { client_reference_id: UID } } }) === UID,
    'checkout : utilisateur = client_reference_id',
);
verif(
    userIdDeLEvenement({
        type: 'checkout.session.completed',
        data: { object: { client_reference_id: "x' or 1=1" } },
    }) === null,
    'client_reference_id non uuid : ignoré',
);

console.log('\n[Stripe : idempotence et ordre]');
const nouvelleActive = { statut: 'actif', fin: futur, stripe_subscription_id: 'sub_neuf' };
const vieilleAnnulee = { statut: 'annule', fin: passe, stripe_subscription_id: 'sub_vieux' };
verif(doitAppliquer(null, vieilleAnnulee), 'pas de ligne : on écrit');
verif(
    doitAppliquer({ ...nouvelleActive }, { ...nouvelleActive, statut: 'annule' }),
    'même abonnement : on écrit (rejouer = même résultat)',
);
verif(
    !doitAppliquer(nouvelleActive, vieilleAnnulee),
    'vieil abonnement annulé arrivé en retard : n’écrase pas l’actif',
);
verif(doitAppliquer(vieilleAnnulee, nouvelleActive), 'nouvel abonnement actif : remplace l’ancien');

console.log('\n[creer-paiement]');
const p = parametresCheckout({
    userId: UID,
    email: 'a@exemple.test',
    customerId: null,
    priceId: 'price_serveur',
    base: 'https://undocpourtous.com',
});
verif(
    p.mode === 'subscription' &&
        p.line_items.length === 1 &&
        p.line_items[0].price === 'price_serveur' &&
        p.line_items[0].quantity === 1,
    'prix décidé côté serveur, quantité 1',
);
verif(
    p.client_reference_id === UID && p.subscription_data.metadata.user_id === UID,
    'utilisateur attaché à la session et à l’abonnement',
);
verif(
    p.success_url === 'https://undocpourtous.com/profil.html?paiement=ok' &&
        p.cancel_url === 'https://undocpourtous.com/albion-paiement.html?paiement=annule',
    'URLs de retour fixes',
);
verif(p.customer_email === 'a@exemple.test' && !('customer' in p), 'nouveau client : e-mail pré-rempli');
const p2 = parametresCheckout({
    userId: UID,
    email: 'a@exemple.test',
    customerId: 'cus_123',
    priceId: 'price_serveur',
    base: 'https://undocpourtous.com',
});
verif(p2.customer === 'cus_123' && !('customer_email' in p2), 'client connu : réutilisé');

console.log(`\n${reussites} ✓, ${echecs} ✗`);
process.exit(echecs ? 1 : 0);
