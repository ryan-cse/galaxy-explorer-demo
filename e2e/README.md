# Playwright E2E — Favorites button

Browser E2E tests for the upper-right header **Favorites** button, run
with [Playwright](https://playwright.dev/). This is a separate layer from:

- the **Vitest** unit layer (`tests/**/*.test.js`, pure logic in `lib.js`), and
- the **mabl** E2E layer wired into `.github/workflows/deploy.yml`.

It is intentionally **not** part of the CI pipeline — it's a local/dev
cross-check of the Favorites flow.

## Run

```bash
npm install            # installs @playwright/test + http-server
npx playwright install chromium   # one-time browser download
npm run test:e2e       # headless
npm run test:e2e:headed
npm run test:e2e:report
```

`playwright.config.js` starts a local static server (`http-server`) on
`http://127.0.0.1:4173` serving the repo root, so tests exercise the code
on the current branch (not the live Pages deploy).

## What it covers (`favorites.spec.js`)

Starting on the Starships browse screen (`#/browse/starships`):

1. Header **Favorites** button (`data-testid="nav-favorites"`) is visible;
   count badge (`data-testid="fav-count"`) is hidden at zero.
2. Clicking it routes to `#/favorites` (empty state shown).
3. Favoriting a starship card (`data-testid="fav-toggle"`) increments the
   header badge live — `setFavs()` → `updateFavCount()`, no reload.
4. The favorites page then lists that exact starship.
5. Removing the last favorite hides the badge again.

## Notes

- Tests run **serially** (`workers: 1`). The catalog loads live from SWAPI,
  and parallel browsers contend for that external API + Google Fonts, which
  trips navigation/render timeouts. The suite is small, so serial is cheap.
- Each test runs in a fresh browser context, so `localStorage` (favorites are
  persisted under `galaxy.favorites`) starts empty — no cross-test bleed.
- Navigation waits for `domcontentloaded` (not `load`) to avoid hanging on the
  CDN font fetch; assertions auto-wait for their target elements.
