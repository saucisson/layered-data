// Theme picker E2E (issue #233): the Preferences page offers several
// themes; the choice is applied on <html> and persisted in
// localStorage across reloads. The header brand is the single layered
// vector logo (the #234 variant picker was removed).
import { test, expect, type Page } from "@playwright/test";

/** Open the Preferences page (LD-8: the settings live on their own
 *  route, linked from the account menu in the header). */
async function openPrefs(page: Page) {
  await page.goto("/#preferences");
}

test("#233 the theme chosen in Preferences is applied and survives a reload", async ({ page }) => {
  await page.goto("/#landing");
  await openPrefs(page);
  const picker = page.getByRole("combobox", { name: "theme" });
  await expect(picker).toBeVisible({ timeout: 10_000 });

  await picker.selectOption("nord");
  await expect
    .poll(() => page.evaluate("document.documentElement.classList.contains('theme-nord')"))
    .toBe(true);
  await expect
    .poll(() => page.evaluate("localStorage.getItem('ld-theme')"))
    .toBe("nord");

  // a reload keeps the theme
  await page.reload();
  await openPrefs(page);
  await expect(picker).toHaveValue("nord", { timeout: 10_000 });
  await expect
    .poll(() => page.evaluate("document.documentElement.classList.contains('theme-nord')"))
    .toBe(true);

  // back to light removes every theme class
  await picker.selectOption("light");
  await expect
    .poll(() =>
      page.evaluate(
        "(() => { const c = document.documentElement.classList; return !c.contains('theme-nord') && !c.contains('dark'); })()",
      ),
    )
    .toBe(true);
});

test("the header brand is the layered vector logo and the reference exports are served", async ({ page }) => {
  await page.goto("/#landing");
  // the brand is the inline wordmark SVG: the L and D capitals as
  // clipped strata, the lowercase ink in currentColor (follows the theme)
  const brand = page.locator("header svg[role='img']");
  await expect(brand).toBeVisible({ timeout: 10_000 });
  // the wordmark is exposed as an accessible "Layered Data" image
  await expect(brand).toHaveAttribute("aria-label", "Layered Data");
  // the reference light and dark exports are actually served
  expect((await page.request.get("/logos/layered-data-logo-light.svg")).status()).toBe(200);
  expect((await page.request.get("/logos/layered-data-logo-dark.svg")).status()).toBe(200);
  expect((await page.request.get("/logos/layered-data-favicon.svg")).status()).toBe(200);
});

test("the Tokyo Night theme applies its indigo palette and survives a reload", async ({ page }) => {
  await page.goto("/#landing");
  await openPrefs(page);
  const picker = page.getByRole("combobox", { name: "theme" });
  await expect(picker).toBeVisible({ timeout: 10_000 });

  await picker.selectOption("tokyonight");
  await expect
    .poll(() =>
      page.evaluate(
        "(() => { const c = document.documentElement.classList; return c.contains('theme-tokyonight') && c.contains('dark'); })()",
      ),
    )
    .toBe(true);
  await expect
    .poll(() => page.evaluate("localStorage.getItem('ld-theme')"))
    .toBe("tokyonight");
  // the storm background is applied to the body
  await expect
    .poll(() => page.evaluate("getComputedStyle(document.body).backgroundColor"))
    .toBe("rgb(26, 27, 38)");

  await page.reload();
  await openPrefs(page);
  await expect(picker).toHaveValue("tokyonight", { timeout: 10_000 });
  await expect
    .poll(() => page.evaluate("document.documentElement.classList.contains('theme-tokyonight')"))
    .toBe(true);
});
