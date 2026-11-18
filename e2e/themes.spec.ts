// Theme picker E2E (issue #233): the header offers several themes; the
// choice is applied on <html> and persisted in localStorage across
// reloads.
import { test, expect } from "@playwright/test";

test("#233 the theme chosen in the header is applied and survives a reload", async ({ page }) => {
  await page.goto("/#landing");
  await page.getByRole("button", { name: "preferences" }).click();
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
  await page.getByRole("button", { name: "preferences" }).click();
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

test("#234 the logo variant chosen in the header is persisted across reloads", async ({ page }) => {
  await page.goto("/#landing");
  await page.getByRole("button", { name: "preferences" }).click();
  const picker = page.getByRole("combobox", { name: "logo" });
  await expect(picker).toBeVisible({ timeout: 10_000 });

  await picker.selectOption("diamond");
  await expect
    .poll(() => page.evaluate("localStorage.getItem('ld-logo')"))
    .toBe("diamond");
  // the header brand now carries the diamond mark
  await expect(page.locator("header svg path").first()).toBeVisible();

  await page.reload();
  await page.getByRole("button", { name: "preferences" }).click();
  await expect(picker).toHaveValue("diamond", { timeout: 10_000 });
});

test("the artwork logo variant renders the provided PNG wordmark and persists", async ({ page }) => {
  await page.goto("/#landing");
  await page.getByRole("button", { name: "preferences" }).click();
  const picker = page.getByRole("combobox", { name: "logo" });
  await expect(picker).toBeVisible({ timeout: 10_000 });

  await picker.selectOption("artwork");
  await expect
    .poll(() => page.evaluate("localStorage.getItem('ld-logo')"))
    .toBe("artwork");
  // the header brand is now the PNG wordmark (light card on the light theme)
  const artwork = page.locator('header img[src="/logos/layered-data-logo-light.png"]');
  await expect(artwork).toBeVisible();
  // the PNGs are actually served
  expect((await page.request.get("/logos/layered-data-logo-dark.png")).status()).toBe(200);
  expect((await page.request.get("/logos/layered-data-logo-light.png")).status()).toBe(200);
  expect((await page.request.get("/logos/layered-data-logo.png")).status()).toBe(200);

  await page.reload();
  await expect(picker).toHaveValue("artwork", { timeout: 10_000 });
  await expect(artwork).toBeVisible();
});

test("the Tokyo Night theme applies its indigo palette and survives a reload", async ({ page }) => {
  await page.goto("/#landing");
  await page.getByRole("button", { name: "preferences" }).click();
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
  await expect(picker).toHaveValue("tokyonight", { timeout: 10_000 });
  await expect
    .poll(() => page.evaluate("document.documentElement.classList.contains('theme-tokyonight')"))
    .toBe(true);
});
