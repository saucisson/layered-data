// Theme picker E2E (issue #233): the header offers several themes; the
// choice is applied on <html> and persisted in localStorage across
// reloads.
import { test, expect } from "@playwright/test";

test("#233 the theme chosen in the header is applied and survives a reload", async ({ page }) => {
  await page.goto("/#landing");
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
