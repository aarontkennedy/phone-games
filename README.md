# Phone Games

A personal collection of games that runs on a phone with no ads, accounts or internet
connection. It's a Progressive Web App: open it once in Safari (iPhone) or Chrome
(Android), add it to the home screen, and it works offline from then on.

## Develop

```bash
nvm use            # Node 22 (see .nvmrc)
npm install
npx playwright install chromium webkit   # once, for the end-to-end tests
npm run dev        # open the "Network" URL on your phone (same Wi-Fi)
npm run check      # types, licenses, unit + e2e tests
```

## Standards

- [docs/TESTING.md](docs/TESTING.md): test layers, the 95% coverage rule, and the new-game checklist
- [docs/DESIGN.md](docs/DESIGN.md): tokens, screen layout, touch and contrast rules
- [docs/LEGAL.md](docs/LEGAL.md): naming, licenses and assets

## Deploy

Pushing to `main` runs every check, then deploys to GitHub Pages.

Copyright (c) 2026 aarontkennedy. All rights reserved. See [LICENSE](LICENSE).
