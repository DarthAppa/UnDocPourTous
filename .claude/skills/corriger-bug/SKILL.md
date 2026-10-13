---
name: corriger-bug
description: Débogage méthodique — reproduire, isoler, corriger, prouver. À utiliser quand quelque chose ne marche pas sur le site (erreur console, page cassée, verrou PTS, connexion Discord, rendu mobile).
---

# Corriger un bug

1. **Reproduire** : page + taille d'écran + étapes exactes. Lancer `node tools/screenshot.mjs page.html` (erreurs console et ressources manquantes) ou `npm run test:pts` pour le verrou. Sans reproduction, ne pas « corriger au hasard ».
2. **Isoler** : lire le message d'erreur en entier, remonter au fichier:ligne. `git log -p -- fichier` pour voir ce qui a changé récemment. Réduire jusqu'au plus petit cas qui casse.
3. **Comprendre la cause** avant d'écrire : l'expliquer en une phrase. Chercher les autres endroits atteints par la même cause (`grep`).
4. **Prouver** : quand c'est testable (logique PTS, outils), ajouter d'abord un cas dans le test qui échoue, puis corriger jusqu'à ce qu'il passe.
5. **Corriger** au plus petit : pas de refactor opportuniste dans le même commit.
6. **Vérifier** : skill `verif-code` (`npm run verif` vert) + regarder les captures 390px et 1280px.
7. **Commit** : `fix: <symptôme visible>` et, dans le compte rendu, la cause en une phrase.
