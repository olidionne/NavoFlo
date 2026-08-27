NavoFlo V8.19.0 — Manufacturing Recognition Engine (MRE)
==========================================================

OBJECTIF
--------
V8.19.0 remplace l'arbitrage exclusif « plaque OU profilé OU usinage » par un
modèle de connaissance de fabrication. Les questions suivantes sont désormais
indépendantes :

1) Quel est le brut probable?
2) Quelles capacités géométriques sont possibles (DXF, dépliage)?
3) Quels procédés sont indiqués par la géométrie (découpe, pliage, tournage,
   perçage/alésage, fraisage)?
4) Quelles features de matière retirée sont reconnues?

PIPELINE LOCAL
--------------
STEP
  -> B-Rep OpenCascade exact
  -> AAG (Attributed Adjacency Graph) faces/arêtes
  -> hypothèses de brut (plaque, round bar, flat/square/rectangular bar,
     profilé structural, tôle)
  -> décomposition des features de matière retirée
  -> capacités + procédés indépendants
  -> résumé UI

Aucun service cloud ou modèle IA n'est requis pour cette analyse.

NOUVEAU MODULE
--------------
public/js/manufacturing-recognition-engine.js

Le MRE retourne notamment :
- stock
- capabilities { unfold, export2dDxf, directFlatDxf, structuralProfile }
- processes { cutting, bending, turning, drilling, milling, machining, profile }
- featureInstances[]
- delta
- aag
- confidence

FEATURES COUVERTES DANS CE MVP
-------------------------------
Plaques / disques :
- trous traversants (ne déclenchent PAS l'usinage à eux seuls)
- trous borgnes
- contre-alésages
- fraisures
- trous transversaux
- gorges annulaires
- fonds de poches
- torus / raccords de gorge

Bruts ronds / shafts :
- changements de diamètre tournés
- gorges tournées
- chanfreins / cônes tournés
- épaulements
- alésages axiaux / borgnes
- trous transversaux
- alésages décentrés
- raccords de gorge

OPEN CASCADE / TOPOLOGIE
------------------------
Le worker enrichit maintenant chaque face analytique avec :
- famille exacte (plan, cylindre, cône, tore, etc.)
- aire et centroïde exacts
- rayon / axe / centre exacts lorsque disponibles
- étendue axiale de la face
- voisins B-Rep explicites (AAG)
- DescribeExactHole pour les cylindres
- DescribeExactCompoundHole pour les contre-alésages/fraisures lorsque la
  complexité du modèle permet le passage détaillé

IMPORTANT — DELTA VOLUME
------------------------
L'architecture V8.19.0 possède une étape « delta / matière retirée », mais le
WASM occt-js actuellement épinglé dans NavoFlo n'expose pas encore une primitive
publique permettant de faire directement un BRepAlgoAPI_Cut entre le STEP
importé et un brut généré.

Donc V8.19.0 utilise :
- la décomposition exacte B-Rep/AAG des features;
- et, lorsque le calcul volumique actuel est fiable, une estimation
  stock-volume moins part-volume.

Le contrat `delta` a volontairement été isolé : un futur binding OCCT de Boolean
Cut pourra remplacer ce backend sans réécrire l'UI, les capacités ou les règles
de procédé.

RÈGLE DE CAPACITÉ DXF
---------------------
Le DXF n'est plus conceptuellement synonyme de « Type = plaque ».
- une plaque/disque avec usinage secondaire peut garder Exporter DXF;
- un shaft tourné en round bar n'obtient pas un faux DXF de plaque;
- une tôle pliée conserve Déplier + Exporter DXF;
- un flat bar probable peut conserver le DXF 2D.

PERSISTANCE
-----------
Le cache d'analyse par onglet passe à la version 3 afin d'invalider les anciennes
classifications V8.18.x une seule fois. Les analyses MRE sont ensuite persistées
par document comme les autres données Navo3D.

RÉGRESSIONS TESTÉES AVEC LES STEP RÉELS
----------------------------------------
- ST01-0002_0       -> machined-part / round-bar / DXF NON
- ST04-0025_A       -> cuttable-plate-machined / DXF OUI
- ST09-0003_0       -> cuttable-plate-machined / DXF OUI
- ST14-0002_0       -> machined-part / round-bar / DXF NON
- ST14-0004_0       -> machined-part / round-bar / DXF NON
- ST01-0011_0       -> cuttable-plate / flat-bar / DXF OUI
- ST01-0006_0       -> cuttable-plate / DXF OUI
- 25021600_521-00-01_0 -> cuttable-plate / DXF OUI
- 25021600_503-00-02_0 -> cuttable-plate / DXF OUI

Les contrôles de syntaxe Node ont été exécutés sur viewer.js, step-worker.js,
manufacturing-classifier.js, manufacturing-recognition-engine.js et
sheetmetal-engine.js.

NOTE TEST NAVIGATEUR
--------------------
Le smoke test Chromium local n'a pas pu être lancé dans l'environnement de
construction parce que la navigation localhost du navigateur sandboxé est
bloquée par l'administrateur. Les tests du moteur MRE ont donc été exécutés
directement sur les données B-Rep extraites des STEP de régression.
