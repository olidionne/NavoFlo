NavoFlo V8.15 — CAD TABS + UNIFIED UI
======================================

Objectif
--------
Première passe d'optimisation UI/UX de Navo2D et Navo3D à partir de la base V8.14 validée.

1. Navigation Navo2D / Navo3D uniformisée
------------------------------------------
- Le sélecteur Navo2D / Navo3D est maintenant placé au même endroit, dans la zone supérieure droite, sur les deux applications.
- Navo3D utilise maintenant une coquille d'application compacte semblable à Navo2D afin de maximiser l'espace CAD utile.
- Les accès Site principal, Licences et FR/EN suivent le même ordre visuel.
- Le badge LOCAL reste visible afin de rappeler que les fichiers CAD restent sur le poste.

2. Navo2D — plusieurs dessins avec onglets
------------------------------------------
- Le bouton Ouvrir accepte plusieurs fichiers DXF à la fois.
- Chaque DXF possède son propre onglet.
- Chaque document conserve indépendamment : entités, layers, sélection, vue, undo/redo, unités, analyse et état modifié.
- Un point indique un dessin modifié/non exporté.
- La fermeture d'un dessin modifié demande confirmation.
- NEW crée un nouveau DrawingN.dxf dans un nouvel onglet.
- Le bouton + ouvre d'autres DXF.
- Les préférences d'interface V8.14 restent propres à l'utilisateur et ne sont pas dupliquées par document.

3. Navo3D — plusieurs modèles avec onglets
------------------------------------------
- Plusieurs STEP/STP/GLB/GLTF/STL/OBJ peuvent être sélectionnés en une seule opération.
- Chaque modèle possède son onglet.
- La caméra, l'unité d'affichage et l'état de travail propre au modèle sont retenus lorsque l'utilisateur change d'onglet.
- Pour éviter de multiplier la mémoire sur de gros assemblages, un seul modèle 3D/WebGL est chargé activement à la fois.
- Lors d'un retour sur un onglet, le modèle est rechargé localement à partir du File conservé par le navigateur, puis sa caméra est restaurée.
- Les dépendances GLTF (.bin/textures) sont groupées avec le document correspondant.
- Le bouton + ouvre d'autres modèles.

Raccourcis onglets
------------------
- Ctrl+Tab : onglet suivant
- Ctrl+Shift+Tab : onglet précédent
- Ctrl+W : fermer l'onglet courant

Sécurité / Licensing
--------------------
- Aucune modification à la logique de licences V8.14.
- Aucune modification au Security Hardening V8.14.
- Aucune migration D1 requise.
- Le Setup per User V8.14 reste actif.

Validation recommandée après déploiement
----------------------------------------
Navo2D :
1. Ouvrir 2 ou 3 DXF simultanément.
2. Passer d'un onglet à l'autre et vérifier que chaque dessin conserve sa vue et ses modifications.
3. Modifier un dessin et vérifier l'indicateur d'état modifié.
4. Fermer le dessin modifié et vérifier la confirmation.
5. Tester NEW, +, Ctrl+Tab et Ctrl+W.

Navo3D :
1. Ouvrir 2 ou 3 modèles STEP/STL/OBJ simultanément.
2. Changer l'orientation du premier modèle.
3. Passer au deuxième puis revenir au premier et vérifier la restauration de caméra.
4. Fermer un onglet et vérifier l'activation du modèle voisin.
5. Tester +, Ctrl+Tab et Ctrl+W.

Navigation :
- Alterner Navo2D / Navo3D plusieurs fois et vérifier que le sélecteur reste au même emplacement visuel en haut à droite.

Cette V8.15 est une première passe d'interface. Les prochains raffinements peuvent ensuite viser le ribbon, les panneaux, la hiérarchie des commandes et les workflows propres à chaque moteur.
