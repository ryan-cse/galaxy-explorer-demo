const { test, expect } = require('@playwright/test');

/**
 * SUP-16 — Release 2.4 regression sweep (subset: AC1, AC4, AC6).
 *
 * Written from the acceptance criteria in SUP-16 as a robustness
 * counterpart to the mabl tests covering the same behaviours.
 *
 * All three run against the deterministic seed (?demo=true), which
 * data.js honours via URLSearchParams before it ever calls SWAPI —
 * so nothing here depends on the live API. Routes are hash-based and
 * the base URL opens Characters, so each test navigates explicitly
 * rather than trusting the start URL.
 */

// Query param must precede the hash — data.js reads window.location.search.
const SIGNIN = '/?demo=true#/signin';
const PLANETS = '/?demo=true#/browse/planets';
const CHARACTERS = '/?demo=true#/browse/people';

// domcontentloaded, not load: the app pulls the Material Symbols font from a
// CDN and waiting for full `load` can hang. Assertions auto-wait regardless.
const goto = (page, url) => page.goto(url, { waitUntil: 'domcontentloaded' });

test.describe('AC1 — Sign-in rejects malformed input', () => {
  test('shows both field errors and no banner', async ({ page }) => {
    await goto(page, SIGNIN);
    await expect(page.getByTestId('signin-form')).toBeVisible();

    await page.getByTestId('email').fill('commander.rebellion.org'); // no @
    await page.getByTestId('password').fill('echo');                 // < 6 chars
    await page.getByTestId('signin-submit').click();

    // Both error nodes are always present in the DOM; `.field.error .err-msg`
    // flips them from display:none to block. Assert VISIBILITY, not presence —
    // a presence-only check passes on a completely broken form.
    const emailError = page.getByTestId('email-error');
    const passwordError = page.getByTestId('password-error');
    await expect(emailError).toBeVisible();
    await expect(emailError).toHaveText('Enter a valid email address.');
    await expect(passwordError).toBeVisible();
    await expect(passwordError).toHaveText('Password must be at least 6 characters.');

    // "No success or error banner": form-alert is display:none until the
    // handler adds .show, so toBeHidden() is a true negative check here.
    await expect(page.getByTestId('form-alert')).toBeHidden();

    // Validation must short-circuit before the credential check — the button
    // only disables on a successful sign-in.
    await expect(page.getByTestId('signin-submit')).toBeEnabled();
  });
});

test.describe('AC4 — Planets catalog sorts by population', () => {
  test('first card goes from Alderaan to Coruscant', async ({ page }) => {
    await goto(page, PLANETS);

    const firstTitle = page.getByTestId('card').first().locator('.card-title');
    await expect(firstTitle).toHaveText('Alderaan'); // default sort is Name (A–Z)

    const sort = page.getByTestId('sort-select');
    // Select by the label the ticket names, then pin the underlying value.
    // Label-only would pass if the option were rewired to the wrong sort key.
    await sort.selectOption({ label: 'Most populated' });
    await expect(sort).toHaveValue('population-desc');

    await expect(firstTitle).toHaveText('Coruscant');
  });
});

test.describe('AC6 — Character detail view renders', () => {
  test('Luke Skywalker detail shows name, attributes and breadcrumb', async ({ page }) => {
    await goto(page, CHARACTERS);

    // 14 characters at page size 6, Name (A–Z): Luke is 8th, so page 2.
    // Clicking his card straight off the initial grid would never resolve.
    await page.getByTestId('page-2').click();
    await expect(page.getByTestId('page-2')).toHaveAttribute('aria-current', 'true');

    await page.getByTestId('card').filter({ hasText: 'Luke Skywalker' }).click();

    await expect(page).toHaveURL(/#\/item\/people\/1$/);
    await expect(page.getByTestId('detail')).toBeVisible();
    await expect(page.getByTestId('detail-name')).toHaveText('Luke Skywalker');

    // The attribute cells render value + a nested <span class="unit">, so the
    // rendered text is "172cm"/"77kg" — exact-matching the ticket's bare 172
    // and 77 fails on a HEALTHY app. Assert the full rendered string, and the
    // numeric part separately so a unit change doesn't read as a data change.
    await expect(page.getByTestId('attr-height')).toHaveText('172cm');
    await expect(page.getByTestId('attr-mass')).toHaveText('77kg');
    await expect(page.getByTestId('attr-height')).toContainText('172');
    await expect(page.getByTestId('attr-mass')).toContainText('77');

    // Breadcrumb present and actually navigating back, not just rendered.
    const breadcrumb = page.getByTestId('breadcrumb');
    await expect(breadcrumb).toBeVisible();
    await expect(breadcrumb).toContainText('Characters');
    await breadcrumb.getByRole('button', { name: 'Characters' }).click();
    await expect(page).toHaveURL(/#\/browse\/people$/);
  });
});
