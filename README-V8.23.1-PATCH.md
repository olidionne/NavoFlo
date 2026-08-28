# NavoFlo V8.23.1 — Sheet-shell / through-cut arbitration patch

Base attendue : **V8.23.0**.

Corrections principales :
- preuve de pli `Rext-Rint=T` coaxiale prioritaire sur une simple ressemblance de profilé;
- une hypothèse structurale rejetée dans les diagnostics ne peut plus reclasser une tôle pliée dans le MRE;
- protection des deux peaux physiques des plaques contre les faux `pocket-floor`;
- les peaux support ne servent plus de pont entre plusieurs volumes négatifs;
- `through-slot` / `through-profile` suppriment les fragments génériques de poche/perçage recouvrant les mêmes faces;
- rainure cylindrique sur plaque exige une profondeur partielle; un rayon de contour laser ne suffit pas;
- `DescribeExactChamfer` est conservé comme usinage secondaire hors faces de formage;
- fallback tôle unique si la passe manufacturière complète échoue génériquement;
- cache d'analyse incrémenté pour forcer une reclassification propre.

Validation : tous les tests V8.20, V8.20.1, V8.21.0, V8.21.1, V8.21.2, V8.22.0, V8.23.0 et V8.23.1 doivent passer.
