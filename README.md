# NavoFlo

Official bilingual static landing page for **NavoFlo**.

**Du CAD à la production, simplifié.**  
**CAD to Production, Simplified.**

## Languages

- French (default): https://navoflo.com/
- English: https://navoflo.com/en/

## Structure

```text
NavoFlo/
├── public/
│   ├── index.html
│   ├── en/
│   │   └── index.html
│   ├── css/
│   │   └── styles.css
│   ├── js/
│   │   └── main.js
│   ├── favicon.svg
│   ├── robots.txt
│   └── sitemap.xml
├── README.md
└── wrangler.jsonc
```

## Deployment

This repository is designed to deploy through Cloudflare Workers Static Assets.

Wrangler serves the `./public` directory:

```bash
npx wrangler deploy
```

## Contact

contact@navoflo.com
