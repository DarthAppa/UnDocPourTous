---
name: pull-request
description: Ouvre une pull request propre vers main après vérification complète du code et relecture du diff. Utilisation : /pull-request [titre]
disable-model-invocation: true
---

# Ouvrir une pull request

Jamais de push direct sur `main` : tout passe par une branche + PR.

1. **Branche** : si on est sur `main`, créer une branche `feat/…`, `fix/…` ou `chore/…` (`git switch -c`).
2. **État** : `git status` + `git diff --stat main...HEAD`. Vérifier qu'aucun fichier privé ne part : `node_modules/`, `shots/`, `.env`, `docs-prives/`, `Claude outputs/`, `.claude/settings.local.json`.
3. **Vérification** : skill `verif-code` → `npm run verif` doit être entièrement vert. Sinon corriger et recommencer. Ne pas continuer tant que c'est rouge.
4. **Relecture** : skill `revue-code` sur `git diff main...HEAD` ; corriger les points « bloquant » et « important ».
5. **Commits** : messages courts en français (`feat: …`, `fix: …`, `chore: …`, `style: …`). Un commit = un sujet.
6. **Push** : `git push -u origin <branche>` (le hook pre-push relance la vérif ; ne jamais ajouter `--no-verify`). Demander confirmation avant.
7. **PR** : `gh pr create --base main --title "$ARGUMENTS" --body-file -` avec ce corps :
    - **Quoi** : 2-4 puces sur ce qui change pour le visiteur.
    - **Pourquoi** : le besoin.
    - **Vérification** : bilan de `npm run verif` + pages regardées à 390px et 1280px.
    - **À surveiller** : risques, points non testés.
8. **CI** : `gh pr checks --watch`. Si la vérif GitHub échoue : `gh run view --log-failed`, corriger, pousser à nouveau.
9. Donner le lien de la PR. Ne pas fusionner sans l'accord de l'utilisateur.
