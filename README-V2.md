# NavoFlo CAD Viewer V2

Files to replace on the website:

- public/viewer/index.html
- public/en/viewer/index.html
- public/css/viewer.css
- public/js/viewer.js
- public/js/step-worker.js

STEP/STP exact CAD kernel:
- tx-code/occt-js
- pinned Git commit: ad8ffb6007eb3fd25179232f291b626d6e78a195
- package metadata at that commit: 0.1.14
- OCCT runtime is loaded in the visitor's browser from jsDelivr.
- The visitor's STEP file is passed only to the local Web Worker and is not uploaded to NavoFlo.

V2 core features:
- horizontal CAD workspace
- toolbar inside viewport
- SolidWorks-like middle-mouse navigation
- black topology edges for STEP
- face / edge / vertex selection
- exact STEP radius, diameter, edge length and face area queries
- smart exact distance / center-to-center / angle measurement
- section plane
- STEP hierarchy and header information
- PC capability guidance

Validation performed:
- JavaScript syntax checks
- duplicate HTML ID checks
- static UI/JS reference checks

A real browser + real STEP file test is still required after Cloudflare deploy.
