NavoFlo V8.18.0 — Machining + Generic Stock Detection

- Adds local geometry-only inference for probable raw stock and machining.
- Recognizes round bar, square bar, flat bar, rectangular bar, and regular hex bar.
- A pristine simple bar is shown as a profile/stock shape.
- A body with material removal or machining signatures is shown as a probable machined part and its probable raw stock.
- Evidence may include turning, drilling/boring, chamfers, fillets, and estimated stock material removal.
- Existing sheet-metal and AISC structural-profile arbitration remains authoritative.
- Geometry alone cannot prove manufacturing intent. The UI explicitly labels this as a local geometric inference.
