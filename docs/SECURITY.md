# Security and updates

## Why risk is low, but not zero

The app is static files on GitHub Pages: no server, no accounts, no database and no
network calls. There's nothing on our side to break into and no player data to leak.
Almost all third-party code is build and test tooling that never reaches a phone. The
only shipped third-party code is the Workbox service worker (public/THIRD_PARTY_NOTICES.txt).

What's left:

- **Supply chain (the main risk).** `npm install` and the build run every package's code
  on your Mac and in CI. A hijacked package could steal credentials there, or slip code
  into the built site, which then runs on every player's phone.
- **The dev server.** `npm run dev` is reachable from your Wi-Fi (`server.host` in
  vite.config.ts) so you can test on a phone. Dev server bugs can expose files on your
  Mac to the network. Only run it on a network you trust, and stop it when you're done.
- **Your GitHub account.** Anyone who can push to `main` changes the live site. Keep
  two-factor sign-in on.

## Every few weeks: check dependencies

1. **Dependabot does the watching.** `.github/dependabot.yml` opens one grouped pull
   request a month for npm and for GitHub Actions. It waits 7 days after a release
   before suggesting it, because hijacked versions are usually caught and pulled
   within days. CI runs every test on the pull request. Turn on **Dependabot alerts**
   and **Dependabot security updates** in the repo's Settings, under "Advanced
   Security", to get urgent fixes as soon as they're published.
2. **Or check by hand:** `npm run deps` lists outdated packages and known advisories.
3. **Update** with `npm update` for minor versions, or a major version one at a time,
   reading its migration notes.
4. **Verify** as for any change: `npm run check` (types, licenses, unit and E2E tests),
   then look at the app on a phone. Never lower coverage or skip tests to land an
   update.
5. **Push** once everything passes.

## How urgent is an advisory?

- **Anything in shipped code** (Workbox's runtime, or our own code): fix and deploy
  now.
- **High or critical in build or test tools:** fix within days. These run on your Mac
  and in CI, not on phones, so the danger is to the build, not to players.
- **Low or moderate in build or test tools:** fix at the next regular check.

Don't run `npm audit fix --force` blindly. It jumps major versions, which can break the
build or the tests. Update one major version at a time and run the full check.

## Known and accepted

Recheck these at every dependency check, and remove an entry once it's resolved.

- **Vite stays on 7.** Vite 8 requires lightningcss, which is MPL-2.0 and so not allowed
  (docs/LEGAL.md). Vite 7 is supported and has no known advisories. Dependabot is told
  to skip Vite 8.
- **Workbox build advisories** (checked 2026-11-01): 10 low and moderate advisories in
  workbox-build 7.4.1 and the packages under it (glob, minimatch, ejs, deepmerge). They
  run only while the site is built, never on a phone, and 7.4.1 is the newest Workbox.
  `npm audit` suggests a "fix" that downgrades vite-plugin-pwa; don't apply it. Update
  when Workbox releases a fixed version.

## Rules for new dependencies

- Prefer none. Small helpers are easy to write and test ourselves.
- Permissive licenses only (docs/LEGAL.md); `npm run licenses` enforces it.
- Commit `package-lock.json`. CI installs with `npm ci`, so every build uses exactly the
  locked versions.
