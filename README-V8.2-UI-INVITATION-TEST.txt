NavoFlo V8.2

Changes:
- Sign-out button on the licensing account page is now visually red and prominent.
- No D1 migration required.
- Auth, invitation, floating-license, Stripe Fast Track and lease logic are unchanged from V8.1.

Recommended validation after deploy:
1. Sign in as Owner.
2. Open /account/licenses/.
3. Click "Renvoyer l’invitation" for an existing pending member, or invite a new member without a license.
4. If email delivery is not configured, copy the generated invitation URL.
5. Open the invitation link and create the invited user's password.
6. Confirm the invited user becomes Active and can sign in independently.
