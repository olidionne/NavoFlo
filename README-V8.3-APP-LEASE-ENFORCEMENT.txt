NavoFlo V8.3 — App Lease Enforcement
=====================================

But:
- Une licence ADMIN ou USER ne peut être active que sur un seul POSTE à la fois.
- Plusieurs onglets sur le même poste sont permis.
- Une licence USER peut toujours être transférée entre utilisateurs uniquement depuis /account/licenses/.
- Un même utilisateur peut déplacer sa session vers un autre poste depuis l'écran de licence de Navo2D.

Nouveautés:
- Navo2D ne charge plus son module principal avant l'acquisition d'une lease valide.
- Heartbeat toutes les 20 secondes.
- Lease serveur de 90 secondes.
- En cas de perte réseau, l'application se verrouille au plus tard à l'expiration de la lease.
- Un takeover révoque immédiatement les leases de l'autre poste; l'autre poste se verrouille au prochain heartbeat.
- Un transfert de licence USER depuis le portail révoque déjà toutes les leases de l'ancien utilisateur.
- Une annulation/perte d'entitlement invalide le heartbeat suivant.
- Les onglets multiples du même poste ne se bloquent plus entre eux.

Déploiement:
1. Commit/merge les fichiers de cette archive.
2. Aucune migration D1 supplémentaire.
3. Déployer Cloudflare.
4. Tester Navo2D avec le compte licencié sur deux profils/navigateurs différents.
5. Quand le test est validé, activer NAVOFLO_ENFORCE_LICENSES=true dans Cloudflare.

Test deux postes:
A. Profil Chrome normal: login avec un compte licencié, ouvrir /navo2d/.
B. Profil Chrome Incognito ou autre ordinateur: même compte, ouvrir /navo2d/.
C. B doit afficher « Licence déjà utilisée ».
D. Cliquer « Utiliser ce poste » sur B.
E. B ouvre Navo2D; A doit se verrouiller à son prochain heartbeat (<=20 s).

IMPORTANT:
NAVOFLO_ENFORCE_LICENSES peut rester false pour le premier test. Le gate Navo2D vérifie déjà la lease.
L'activer ensuite ajoute aussi le verrou serveur des routes /navo2d/ et /navo3d/.
