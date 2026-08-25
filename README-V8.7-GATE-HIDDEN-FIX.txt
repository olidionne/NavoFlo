NavoFlo V8.7 — License gate hidden-state fix

Root cause fixed:
The license gate used the HTML `hidden` attribute, but the author CSS forced `display:flex` on the same element. In Chrome, the author rule could keep the gate visible after a successful lease acquisition. The lease was valid; only the overlay remained visible.

Fixes:
- Adds #navoflo-license-gate[hidden]{display:none!important}.
- unlock() explicitly sets display:none and aria-hidden=true.
- card() explicitly restores display:flex and aria-hidden=false.
- Uses a new physical script /js/license-lease-v87.js to avoid cache ambiguity.
- No D1 migration required.
