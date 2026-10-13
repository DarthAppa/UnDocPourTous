// Faux client Supabase + fausses Edge Functions pour les tests navigateur (Playwright).
// Les tests ne dépendent ni du vrai projet Supabase, ni de Discord, ni de Stripe.
//
// preparer(page, { faux, fonctions, serveurUrl }) :
//   faux      : état du faux client (session, tables, rpc), injecté dans globalThis.__FAUX__ à chaque chargement
//   fonctions : { nom: { status, body } | (corps) => ({ status, body }) } réponses des Edge Functions
// Renvoie { appelsFonctions, requetesExternes } ; les appels au client sont dans window.__APPELS__.
import { PTS_CONFIG } from '../pts-config.js';

// HORS_LIGNE=1 : CDN Tailwind et polices coupés (conteneur sans Internet)
export const HORS_LIGNE = process.env.HORS_LIGNE === '1';

export const SESSION = {
    access_token: 'jwt-test',
    refresh_token: 'refresh-test',
    user: {
        id: 'u1',
        email: 'joueur@example.com',
        created_at: '2026-01-02T10:00:00Z',
        app_metadata: { provider: 'email', providers: ['email', 'discord'] },
        user_metadata: { full_name: 'Testeur' },
        identities: [
            { provider: 'email', id: 'u1' },
            { provider: 'discord', id: '111', identity_data: { provider_id: '111' } },
        ],
    },
};

// Compte du site sans Discord relié (connexion Google)
export const SESSION_SANS_DISCORD = {
    ...SESSION,
    user: {
        ...SESSION.user,
        app_metadata: { provider: 'google', providers: ['google'] },
        identities: [{ provider: 'google', id: 'g1' }],
    },
};

export const FAUX_SUPABASE = `export function createClient(url) {
  const F = globalThis.__FAUX__ || {};
  F.tables = F.tables || {};
  // Comme le vrai client : une session rafraîchie (sans jeton Discord) le reste après navigation
  try { if (F.session && sessionStorage.getItem('__faux_sans_jeton')) delete F.session.provider_token; } catch {}
  const A = (globalThis.__APPELS__ = globalThis.__APPELS__ || []);
  const copie = (o) => (o == null ? o : JSON.parse(JSON.stringify(o)));
  function requete(table) {
    const r = { table, op: 'select', filtres: {}, valeurs: null, options: null };
    const executer = () => {
      A.push({ type: 'from', table, op: r.op, filtres: r.filtres, valeurs: r.valeurs });
      if ((F.erreurs || []).includes(table)) return { data: null, error: { message: 'refus' }, count: null };
      const brut = F.tables[table];
      let lignes = Array.isArray(brut) ? brut : brut ? [brut] : [];
      lignes = lignes.filter((l) => Object.entries(r.filtres).every(([k, v]) => !(k in l) || l[k] === v));
      if (r.op === 'update') {
        lignes.forEach((l) => Object.assign(l, r.valeurs));
        return { data: null, error: null, count: null };
      }
      return { data: copie(lignes), error: null, count: lignes.length };
    };
    const q = {
      select(_c, o) { r.options = o; return q; },
      update(v) { r.op = 'update'; r.valeurs = v; return q; },
      eq(k, v) { r.filtres[k] = v; return q; },
      order() { return q; },
      limit() { return q; },
      maybeSingle() { const x = executer(); return Promise.resolve({ data: x.data ? x.data[0] ?? null : null, error: x.error }); },
      single() { return q.maybeSingle(); },
      then(ok, ko) { return Promise.resolve(executer()).then(ok, ko); },
    };
    return q;
  }
  return {
    from: requete,
    rpc: async (nom) => {
      A.push({ type: 'rpc', nom });
      return { data: copie((F.rpc || {})[nom] ?? []), error: null };
    },
    auth: {
      getSession: async () => ({ data: { session: copie(F.session ?? null) }, error: null }),
      refreshSession: async () => {
        A.push({ type: 'refresh' });
        if (F.session) delete F.session.provider_token;
        try { sessionStorage.setItem('__faux_sans_jeton', '1'); } catch {}
        return { data: { session: copie(F.session ?? null) }, error: null };
      },
      signOut: async (o) => {
        A.push({ type: 'signOut', scope: o && o.scope });
        try { sessionStorage.setItem('__faux_signOut', String(o && o.scope)); } catch {}
        F.session = null;
        try { localStorage.removeItem('${cleSession()}'); } catch {}
        return { error: null };
      },
      signInWithOAuth: async ({ provider, options }) => {
        A.push({ type: 'oauth', provider });
        location.assign(url + '/auth/v1/authorize?provider=' + provider + '&redirect_to=' + encodeURIComponent(options.redirectTo));
        return { data: {}, error: null };
      },
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
      signInWithPassword: async ({ email }) => {
        A.push({ type: 'password', email });
        if ((F.erreurs || []).includes('connexion')) return { data: {}, error: { code: 'invalid_credentials', message: 'Invalid login credentials' } };
        F.session = F.sessionApresConnexion || null;
        return { data: { session: copie(F.session) }, error: null };
      },
      signUp: async ({ email, options }) => {
        A.push({ type: 'signUp', email, nom: options && options.data && options.data.name });
        return { data: { user: { id: 'nouveau', identities: [{}] }, session: null }, error: null };
      },
      resetPasswordForEmail: async (email) => {
        A.push({ type: 'reset', email });
        return { data: {}, error: null };
      },
      linkIdentity: async ({ provider, options }) => {
        A.push({ type: 'link', provider, scopes: options && options.scopes });
        location.assign(url + '/auth/v1/user/identities/authorize?provider=' + provider + '&redirect_to=' + encodeURIComponent(options.redirectTo));
        return { data: {}, error: null };
      },
      unlinkIdentity: async (i) => {
        A.push({ type: 'unlink', provider: i && i.provider });
        if (F.session) F.session.user.identities = (F.session.user.identities || []).filter((x) => x.provider !== i.provider);
        return { data: {}, error: null };
      },
      updateUser: async (attrs) => {
        A.push({ type: 'updateUser', champs: Object.keys(attrs || {}) });
        return { data: { user: F.session && F.session.user }, error: null };
      },
      mfa: {
        getAuthenticatorAssuranceLevel: async () => ({
          data: { currentLevel: F.aal || 'aal1', nextLevel: F.mfa ? 'aal2' : (F.aal || 'aal1') },
          error: null,
        }),
        listFactors: async () => ({
          data: { all: F.mfa ? [{ id: 'f1', status: 'verified' }] : [], totp: F.mfa ? [{ id: 'f1', status: 'verified', friendly_name: 'Téléphone' }] : [] },
          error: null,
        }),
      },
    },
  };
}`;

export function cleSession() {
    return `sb-${new URL(PTS_CONFIG.SUPABASE_URL).hostname.split('.')[0]}-auth-token`;
}

// Image 1×1 (PNG) servie à la place des avatars Discord
const PNG = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    'base64',
);

export async function preparer(page, { faux = {}, fonctions = {}, serveurUrl, cleStockee = false } = {}) {
    const appelsFonctions = [];
    const requetesExternes = [];
    page.on('request', (r) => {
        if (!r.url().startsWith(serveurUrl)) requetesExternes.push(r.url());
    });
    // 1. Tout ce qui sort du serveur local est coupé (Supabase, Discord, Stripe…), sauf la mise en page
    //    (CDN Tailwind, polices) quand on n'est pas HORS_LIGNE.
    const miseEnPage = (u) => /^https:\/\/(cdn\.tailwindcss\.com|fonts\.(googleapis|gstatic)\.com)\//.test(u);
    await page.route(
        (u) => !u.href.startsWith(serveurUrl),
        (r) => (!HORS_LIGNE && miseEnPage(r.request().url()) ? r.continue() : r.abort()),
    );
    // Hors ligne : CDN Tailwind remplacé par un bouchon (sinon tailwind-config.js plante) ; mise en page absente
    const etat = { tailwindAbsent: false };
    if (HORS_LIGNE)
        await page.route('https://cdn.tailwindcss.com/**', (r) => {
            etat.tailwindAbsent = true;
            return r.fulfill({
                contentType: 'text/javascript',
                body: 'globalThis.tailwind = globalThis.tailwind || {};',
            });
        });
    // 2. Exceptions (les dernières routes déclarées passent en premier)
    await page.route('https://cdn.discordapp.com/**', (r) => r.fulfill({ contentType: 'image/png', body: PNG }));
    await page.route('**/assets/vendor/supabase.mjs', (r) =>
        r.fulfill({ contentType: 'text/javascript', body: FAUX_SUPABASE }),
    );
    await page.route('**/functions/v1/**', async (r) => {
        const req = r.request();
        const nom = new URL(req.url()).pathname.split('/').pop();
        let corps;
        try {
            corps = req.postDataJSON();
        } catch {
            corps = req.postData();
        }
        appelsFonctions.push({ nom, corps, headers: req.headers(), methode: req.method() });
        const def = fonctions[nom];
        const rep = typeof def === 'function' ? def(corps) : def;
        if (!rep) return r.fulfill({ status: 404, contentType: 'application/json', body: '{"erreur":"inconnue"}' });
        await r.fulfill({ status: rep.status || 200, contentType: 'application/json', body: JSON.stringify(rep.body) });
    });
    await page.addInitScript(
        ([etat, cle, stocker]) => {
            globalThis.__FAUX__ = etat;
            globalThis.__APPELS__ = [];
            try {
                if (stocker) localStorage.setItem(cle, '{"faux":true}');
            } catch {
                /* bloqué */
            }
        },
        [faux, cleSession(), cleStockee],
    );
    // Débordement horizontal : sans Tailwind (hors ligne), la mesure n'a pas de sens → ignorée
    const debordement = async (largeurVue) => {
        const largeur = await page.evaluate(() => document.documentElement.scrollWidth);
        return { largeur, ignore: etat.tailwindAbsent, ok: etat.tailwindAbsent || largeur <= largeurVue };
    };
    return { appelsFonctions, requetesExternes, debordement };
}

export function texteDebordement(d) {
    return d.ignore
        ? `pas de débordement horizontal : non mesurable hors ligne sans Tailwind (${d.largeur}px)`
        : `pas de débordement horizontal (${d.largeur}px)`;
}

// Petit compteur ✓/✗ partagé
export function compteur() {
    const c = { echecs: 0 };
    c.verif = (ok, texte) => {
        console.log(`${ok ? '  ✓' : '  ✗'} ${texte}`);
        if (!ok) c.echecs++;
    };
    return c;
}

export const VUES = [
    { nom: 'desktop', width: 1280, height: 900 },
    { nom: 'mobile', width: 390, height: 844 },
];
