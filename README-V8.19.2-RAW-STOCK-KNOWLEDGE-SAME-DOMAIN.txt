NavoFlo V8.19.2 — RAW STOCK KNOWLEDGE + SAME-DOMAIN ANALYSIS
==============================================================

OBJECTIF
--------
Ajouter une couche de connaissance manufacturière au MRE V8.19 sans revenir à
une classification globale fragile. Les questions restent indépendantes :

- Quel brut est plausible ?
- Le DXF 2D est-il possible ?
- Y a-t-il de l'usinage secondaire ?
- Quelles features sont réellement reconnues ?

NOUVEAU 1 — RAW STOCK KNOWLEDGE
-------------------------------
Nouveau fichier : public/js/raw-stock-knowledge.js

Le moteur ne prend plus une extrusion rectangulaire pour une barre plate
uniquement parce que la géométrie est rectangulaire.

Prior manufacturier intégré :
- ASTM A663/A663M-23 : les merchant-quality flats sont notamment décrits jusqu'à
  6 po de largeur, puis >6 à 8 po sous conditions de section/épaisseur.
- La limite 8 po est utilisée comme preuve forte de plausibilité "merchant flat
  bar", pas comme une interdiction universelle de tout produit spécial.
- 8 à 12 po : zone ambiguë, le moteur garde une confiance réduite.
- >12 po : une extrusion très mince et très large est reclassée comme PLAQUE.
- Le ratio largeur/épaisseur et la proximité d'une épaisseur impériale courante
  sont des indices secondaires.

Conséquence testée :
25021600_502-05-01_0.step
  43.625 po x 0.3125 po x 102.484 po
  AVANT : Profilé probable / barre plate
  V8.19.2 : Plaque à découper

AISC EDI
--------
La convention de nommage AISC EDI est utilisée comme helper de désignation pour
les produits barres supportés :
- FB<t>x<w> : flat bar
- RB<diameter> : round bar
- HB<across flats> : hex bar

La Shapes Database AISC v16 reste utilisée séparément pour les W/L/C/HSS/etc.
La base v16 ne contient pas un catalogue complet de flat bars commerciaux.

NOUVEAU 2 — SAME-DOMAIN HEALING
-------------------------------
OpenCascade fournit ShapeUpgrade_UnifySameDomain pour unir des faces/arêtes
adjacentes qui reposent sur la même géométrie. Le build occt-js actuellement
chargé par NavoFlo n'expose pas directement cette classe, donc V8.19.2 implémente
son équivalent ANALYTIQUE non destructif au niveau worker :

- les faces planes adjacentes coplanaires reçoivent un sameDomainId commun;
- les faces cylindriques adjacentes du même cylindre conservent leur logique
  existante;
- les IDs B-Rep originaux sont conservés pour sélection/mesure.

Le MRE étend ensuite les peaux de plaque à tout leur same-domain group avant de
chercher des poches. Une ligne de séparation SolidWorks ne peut donc plus être
prise pour un fond de poche simplement parce que le STEP a fractionné la face.

Cas de régression :
25021600_502-01-01_0.step
  - deux faces coplanaires SolidWorks sur la même peau;
  - 5 trous traversants;
  - V8.19.2 : Plaque à découper, SANS usinage secondaire/poche.

NOUVEAU 3 — POCKET = PREUVE TOPOLOGIQUE
----------------------------------------
Un plan intérieur n'est plus automatiquement une poche.

Pour être accepté comme pocket floor, il doit :
- être réellement entre les deux peaux physiques;
- avoir des murs adjacents non coplanaires;
- et ces murs doivent se reconnecter à au moins une peau physique.

De plus, un écart d'aire entre les deux peaux n'est plus une preuve autonome.
Il faut une corroboration analytique (trou borgne, lamage, tore, cône, poche
réelle...). Cela supprime les faux positifs causés par les split faces.

NOUVEAU 4 — ANALYTIC MACHINING FALLBACK
---------------------------------------
Après l'analyse AAG par composantes, une passe analytique indépendante vérifie
encore :
- tore -> rainure/rayon usiné;
- cône -> fraisure/chanfrein;
- cylindre partiel -> trou borgne/alésage;
- DescribeExactCompoundHole -> lamage/fraisure;
- DescribeExactChamfer -> chanfrein exact lorsque le runtime OCCT le reconnait.

Cette redondance est volontaire : une seam STEP ne doit jamais pouvoir masquer
une vraie feature d'usinage.

Cas de régression :
ST04-0027_0.step
  - plaque/disque DXF-able;
  - rainures annulaires + trous borgnes + géométrie conique;
  - V8.19.2 : Plaque à découper + usinage, DXF conservé.

AUTRES HELPERS OCCT ÉTUDIÉS
---------------------------
- ShapeUpgrade_UnifySameDomain : principe intégré virtuellement maintenant.
- BRepCheck_Analyzer : excellent candidat futur pour vérifier la validité exacte
  du B-Rep avant classification. Non exposé dans le build occt-js actuel.
- BRepClass3d_SolidClassifier : excellent candidat futur pour prouver
  Stock contient Part et pour le vrai delta-volume Stock-Part. Non exposé par le
  runtime actuel de NavoFlo.
- BRepAlgoAPI_Cut : futur vrai delta-volume booléen quand un binding WASM sera
  disponible.

RÉGRESSIONS LOCALES EXÉCUTÉES
-----------------------------
Entrées B-Rep reconstruites des STEP réels et envoyées au MRE V8.19.2 :

- 25021600_502-01-01_0 : cuttable-plate, 5 through-holes, NO machining
- 25021600_502-05-01_0 : cuttable-plate, NO machining, stock reclassifié plate
- ST04-0027_0 : cuttable-plate-machined, groove/blind-hole/counterbore evidence
- ST04-0025_A : cuttable-plate-machined, DXF true
- ST09-0003_0 : cuttable-plate-machined, DXF true
- ST01-0002_0 : machined round shaft, DXF false
- ST14-0002_0 : machined round shaft, DXF false
- ST14-0004_0 : machined round shaft, DXF false

CACHE
-----
MODEL_ANALYSIS_CACHE_VERSION passe de 4 à 5 pour forcer une réanalyse unique
après déploiement, puis les résultats restent persistants par onglet.

FICHIERS PRINCIPAUX MODIFIÉS
----------------------------
- public/js/raw-stock-knowledge.js (nouveau)
- public/js/manufacturing-classifier.js
- public/js/manufacturing-recognition-engine.js
- public/js/step-worker.js
- public/js/viewer.js
- public/navo3d/index.html
- public/en/navo3d/index.html

DÉPLOIEMENT
-----------
Le PATCH V8.19.2 est destiné à une installation V8.19.1.
Déployer TOUS les fichiers du patch, incluant le nouveau raw-stock-knowledge.js.
