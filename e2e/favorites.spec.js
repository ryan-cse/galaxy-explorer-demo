const { test, expect } = require('@playwright/test');

/**
 * Tests for the "Favorites" button in the upper-right header of the
 * Galaxy Explorer app, exercised from the Starships browse screen.
 *
 * The header button (data-testid="nav-favorites") carries a live count
 * badge (data-testid="fav-count") and routes to #/favorites. Favorites
 * are persisted in localStorage under "galaxy.favorites" via setFavs(),
 * which also calls updateFavCount() so the badge refreshes with no reload.
 * Each test runs in a fresh browser context, so that store starts empty.
 */

const STARSHIPS = '/#/browse/starships';

test.describe('Favorites button (header, upper-right)', () => {
  test.beforeEach(async ({ page }) => {
    // domcontentloaded, not load: the app fetches the Material Symbols font
    // from a CDN, and waiting for full `load` can hang offline/on slow links.
    // Assertions below auto-wait for the elements they target regardless.
    await page.goto(STARSHIPS, { waitUntil: 'domcontentloaded' });
  });

  test('is visible in the header with the count badge hidden at zero', async ({ page }) => {
    const favButton = page.getByTestId('nav-favorites');
    await expect(favButton).toBeVisible();
    await expect(favButton).toContainText('Favorites');

    // Badge has the `hidden` attribute while there are 0 favorites.
    await expect(page.getByTestId('fav-count')).toBeHidden();
  });

  test('navigates to the favorites page when clicked', async ({ page }) => {
    await page.getByTestId('nav-favorites').click();

    await expect(page).toHaveURL(/#\/favorites/);
    // With no favorites yet, the favorites page shows its empty state.
    await expect(page.getByTestId('favorites-empty')).toBeVisible();
  });

  test('count badge increments live when a starship is favorited', async ({ page }) => {
    const badge = page.getByTestId('fav-count');
    await expect(badge).toBeHidden();

    // Cards load live from SWAPI — wait for the grid before interacting.
    const firstToggle = page.getByTestId('fav-toggle').first();
    await firstToggle.waitFor({ state: 'visible' });
    await expect(firstToggle).toHaveAttribute('aria-pressed', 'false');

    await firstToggle.click();

    // setFavs() -> updateFavCount() updates the header badge with no reload.
    await expect(badge).toBeVisible();
    await expect(badge).toHaveText('1');
    await expect(firstToggle).toHaveAttribute('aria-pressed', 'true');
  });

  test('leads to the favorited starship on the favorites page', async ({ page }) => {
    // Cards load live from SWAPI — wait for the grid before interacting.
    const firstCard = page.locator('.card').first();
    await firstCard.waitFor({ state: 'visible' });
    const name = (await firstCard.locator('.card-title').innerText()).trim();

    await firstCard.getByTestId('fav-toggle').click();
    await expect(page.getByTestId('fav-count')).toHaveText('1');

    await page.getByTestId('nav-favorites').click();
    await expect(page).toHaveURL(/#\/favorites/);

    const cards = page.getByTestId('card');
    await expect(cards).toHaveCount(1);
    await expect(cards.first()).toContainText(name);
  });

  test('badge disappears when the last favorite is removed', async ({ page }) => {
    const badge = page.getByTestId('fav-count');
    const firstToggle = page.getByTestId('fav-toggle').first();

    // Cards load live from SWAPI — wait for the grid before interacting.
    await firstToggle.waitFor({ state: 'visible' });
    await firstToggle.click();
    await expect(badge).toHaveText('1');

    await firstToggle.click();
    await expect(firstToggle).toHaveAttribute('aria-pressed', 'false');
    await expect(badge).toBeHidden();
  });
});
