NavoFlo Stripe Workers V7.1 — Licensing Fast Track
==================================================

V7.1 ajoute le parcours rapide d'achat d'une licence additionnelle depuis
/account/licenses/.

Quand toutes les licences sont utilisées :
1. L'administrateur entre le courriel du nouvel utilisateur.
2. NavoFlo affiche une confirmation claire du prix catalogue de la licence
   additionnelle (NavoBase 495 $ CA/an ou NavoPro 895 $ CA/an) et précise que
   Stripe calcule le prorata + taxes pour la période restante.
3. Après confirmation, le Worker ajoute/incrémente l'item de licence
   additionnelle sur l'abonnement Stripe existant avec proration immédiate.
4. Si Stripe exige une action de paiement, le client est redirigé vers la
   facture Stripe hébergée.
5. Le membre reste "En attente" dans D1 jusqu'à confirmation Stripe.
6. customer.subscription.updated / invoice.paid resynchronise D1 et attribue
   automatiquement la nouvelle licence au membre en attente.

Important : exécuter migrations/0004_fast_track_seats.sql UNE FOIS dans D1
avant de tester V7.1.

Aucune nouvelle variable Cloudflare requise.
PAD demeure désactivé par défaut.
