---
name: publier
description: Publie le site sur GitHub Pages en passant par une pull request vérifiée. Utilisation : /publier titre de la PR
disable-model-invocation: true
---

# Publier le site

`main` = le site en ligne. On ne pousse jamais directement dessus : on passe par une PR.

1. Lancer la skill `pull-request` avec le titre `$ARGUMENTS` (branche, `npm run verif` vert, relecture, push, PR, CI verte).
2. Vérifier que `CNAME` est présent et inchangé (sauf demande explicite).
3. Quand la CI est verte et que l'utilisateur confirme : `gh pr merge --squash --delete-branch`.
4. Rappeler que GitHub Pages met 1 à 2 minutes à mettre le site à jour, puis vérifier la page en ligne.
