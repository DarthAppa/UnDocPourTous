---
name: publier
description: Vérifie puis publie le site sur GitHub Pages (commit + push sur main). Utilisation : /publier message du commit
disable-model-invocation: true
---

# Publier le site

1. `git status` et `git diff --stat` : résumer ce qui va partir. S'assurer que `node_modules/` et `shots/` ne sont pas inclus.
2. Lancer `verif-visuelle`. Si des problèmes restent, s'arrêter et les présenter.
3. Vérifier que `CNAME` est présent et inchangé (sauf demande explicite).
4. `git add -A` puis `git commit -m "$ARGUMENTS"` (si aucun message : en proposer un court en français, ex. `fix: menu mobile`).
5. Demander confirmation, puis `git push origin main`.
6. Rappeler que GitHub Pages met 1 à 2 minutes à mettre le site à jour.
