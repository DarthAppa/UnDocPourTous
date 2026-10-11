---
name: audit-front
description: Audit qualité du site avant publication — accessibilité, SEO, performance, responsive. À utiliser quand l'utilisateur demande un audit, une relecture, ou avant une mise en ligne importante.
---

# Audit front

Faire l'audit dans un sous-agent si possible, pour garder la conversation légère. Ne signaler que les vrais problèmes, classés par gravité, avec fichier + ligne + correction proposée.

## Accessibilité
- Un seul `h1`, titres dans l'ordre, `lang="fr"`.
- Toutes les images ont un `alt` ; décors en `aria-hidden="true"`.
- Contraste texte ≥ 4.5:1 (attention aux textes gris sur fond sombre et au texte sur boutons orange).
- Navigation au clavier : menus déroulants ouvrables au clavier, focus visible (`focus-visible:`), boutons = `<button>`.
- Zones cliquables ≥ 44px sur mobile.
- Animations coupées avec `prefers-reduced-motion`.

## SEO
- `<title>` unique et `meta description` (≤ 160 caractères) par page.
- Balises Open Graph (`og:title`, `og:description`, `og:image`) pour le partage Discord/réseaux.
- Liens internes `#ancre` valides, pas de liens `href="#"` laissés en place sans raison.
- `favicon` présent.

## Performance
- Images en `.webp`, dimensionnées, `loading="lazy"` hors écran.
- Polices : `preconnect` + `display=swap`, pas plus de 2 familles.
- Scripts en `defer`. Signaler que le CDN Tailwind est lourd en production et proposer le build CLI.

## Responsive
- Lancer `verif-visuelle` : aucun débordement à 390px, rendu correct à 1280px.

## Rapport
Tableau : gravité (bloquant / important / mineur), problème, emplacement, correction. Proposer ensuite de corriger les points bloquants et importants.
