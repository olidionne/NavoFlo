NavoFlo V8.18.4 — TAB ANALYSIS PERSISTENCE

But
- Corriger la perte des classifications Navo3D lors du changement ou de la fermeture d'onglets STEP.
- Chaque document conserve maintenant son propre instantané d'analyse géométrique.

Persisté par onglet
- classification tôlerie / plaque / profilé
- résultat de fabrication / brut détecté
- correspondance AISC
- résultat de développé complet lorsque disponible
- paramètres manuels de tôlerie
- vue caméra et unités déjà persistées auparavant

Sécurité contre les données périmées
- l'instantané est attaché à une signature fichier (nom + taille + date de modification)
- un changement de fichier invalide automatiquement le cache
- un numéro de version du cache permet d'invalider les anciens formats lors d'une future mise à jour

Comportement
- changer d'onglet restaure immédiatement les propriétés calculées
- fermer un onglet n'efface plus les données des autres STEP
- un profilé AISC conserve son identification
- une plaque conserve le bouton Exporter DXF
- une tôle pliée conserve Déplier / Exporter DXF et son développé en mémoire
- une pièce usinée conserve son brut, ses indices et sa confiance
- les résultats sont également inclus dans le snapshot de session Navo3D

Le noyau OCCT exact reste libéré pour le document inactif afin de ne pas multiplier la RAM; seules les données calculées sérialisables sont conservées par onglet.
