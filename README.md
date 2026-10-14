# UnDocPourTous

Guides et outils gratuits pour joueurs (Albion Online, Pack ta Small, bientôt Path of Exile et World of Warcraft) : [undocpourtous.com](https://undocpourtous.com).

## Démarrer

```bash
npm install                      # dépendances + hook git pre-push
npx playwright install chromium  # navigateur pour les captures et les tests
npm run dev                      # site en direct : http://localhost:4321
```

## Commandes

| Commande               | Rôle                                                                       |
| ---------------------- | -------------------------------------------------------------------------- |
| `npm run dev`          | Site en direct avec rechargement automatique                               |
| `npm run build`        | Construit le site dans `dist/` (Tailwind → Astro → politique de sécurité)  |
| `npm run serve`        | Sert `dist/` sur http://127.0.0.1:5500                                     |
| `npm run verif`        | Tout vérifier avant un push ou une PR (obligatoire, lancé par le pre-push) |
| `npm run verif:rapide` | Même chose sans les captures                                               |
| `npm run import:pts`   | Régénère les pages Pack ta Small depuis `../1_PTS` (dépôt privé)           |
| `npm run format`       | Corrige le formatage (Prettier)                                            |

## Organisation

```
src/pages/       pages du site (.astro → .html)
src/layouts/     gabarit commun (<head>, en-tête, pied de page)
src/components/  composants réutilisables
public/          fichiers servis tels quels (scripts, CSS, images)
supabase/        base de données, règles d'accès, fonctions serveur
tools/           outils de build, de vérification et tests
```

Le site est 100 % statique (Astro) : `main` est construit et mis en ligne par GitHub Actions. Les règles du projet sont dans [CLAUDE.md](CLAUDE.md), la configuration serveur dans [supabase/LISEZMOI.md](supabase/LISEZMOI.md).
