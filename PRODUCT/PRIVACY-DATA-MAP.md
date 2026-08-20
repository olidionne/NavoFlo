# Minimum-data map for NavoFlo

| Data | Needed? | Purpose | Suggested retention |
|---|---|---|---|
| Name / email | Yes | Account, support, contract | Account life + legal retention |
| Company / org | B2B | Seats, billing | Account life + legal retention |
| Billing token / transaction ID | Yes | Subscription | Accounting/legal period |
| Full card number | No | Leave with payment processor | Never store |
| Login IP/security log | Limited | Security/fraud | Short documented period |
| Device activation pseudonym | If licensing needs it | Seat/device enforcement | Active license + short grace |
| SOLIDWORKS version | Useful | Compatibility | Current + support history |
| Add-in version | Useful | Support/security | Short support history |
| CAD file contents | No for licensing | None | Never send |
| CAD filename/path | No for licensing | None | Never send |
| Navo2D/Navo3D CAD geometry | Local by default | Browser processing | Never upload by default |
| Analytics/profile data | Optional | Product analytics | Opt-in where required; minimize |

Before NavoAnalyzer is built, decide explicitly whether analysis is local or
cloud. If cloud processing uploads customer drawings/models, perform a new PIA,
update privacy/terms, specify retention, encryption, subprocessors and customer
confidentiality obligations **before** enabling the feature.
