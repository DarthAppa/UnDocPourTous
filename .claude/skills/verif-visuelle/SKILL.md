---
name: verif-visuelle
description: Vérifie le rendu du site avec des captures desktop et mobile (erreurs console, ressources manquantes, débordement horizontal). À utiliser après toute modification de HTML, CSS ou JS, et avant de dire qu'un changement visuel est terminé.
---

# Vérification visuelle

1. Si `node_modules/playwright` n'existe pas : `npm install` puis `npx playwright install chromium`.
2. Lancer `npm run shot` (ou `node tools/screenshot.mjs autre-page.html`).
3. Lire le rapport :
    - `Débordement horizontal` → un élément dépasse sur mobile. Chercher les `width`/`min-width` fixes et les éléments `absolute` sans parent `overflow: hidden`.
    - `Ressource introuvable` → image ou fichier manquant. Corriger le chemin ou remplacer par un visuel CSS/SVG.
    - Erreurs JS → corriger le script.
4. Ouvrir `shots/desktop.png` et `shots/mobile.png` avec l'outil de lecture d'image et les regarder vraiment :
    - texte lisible (pas caché par un décor), hiérarchie claire ;
    - alignements, espacements réguliers, rien de coupé ;
    - si une maquette est fournie : lister les différences (mise en page, couleurs, tailles, éléments manquants) et les corriger.
5. Recommencer jusqu'à « Aucun problème détecté » et un rendu conforme.
6. Dans le compte rendu final, donner le résultat de la commande et ce qui a été corrigé.
