// An automated accessibility audit (A11Y-006): axe-core over every screen and the open dialogs, at phone and
// desktop widths (the two Playwright projects), in the light and the dark theme. It finds what a machine can find
// (names, roles, contrast, landmarks, duplicate ids) and is a safety net for the screen reader pass (A11Y-002),
// not a replacement for it. A violation fails the test with the rule, the page's state and the elements.
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const THEMES = ["light", "dark"] as const;

/** WCAG 2.0 to 2.2 at A and AA, and axe's own best practices (landmarks, headings, regions). */
const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"];

/** Makes the browser's random numbers a fixed sequence, so the test plays the same life every time. */
async function fixedRandom(page: Page, start: number) {
  await page.addInitScript((first) => {
    let x = first;
    crypto.getRandomValues = ((array: Uint32Array) => {
      for (let i = 0; i < array.length; i++) array[i] = x = (Math.imul(x, 1664525) + 1013904223) >>> 0;
      return array;
    }) as typeof crypto.getRandomValues;
  }, start);
}

/** Chooses the theme before the page loads, the way the settings screen would keep it (UI-009). */
async function useTheme(page: Page, theme: (typeof THEMES)[number]) {
  await page.emulateMedia({ colorScheme: theme });
  await page.addInitScript((chosen) => localStorage.setItem("birthright:theme", chosen), theme);
}

/** Runs axe on the page as it is now and fails, naming the screen and every offending element, on any violation. */
async function expectNoViolations(page: Page, where: string, exclude: string[] = []) {
  const builder = new AxeBuilder({ page }).withTags(TAGS);
  for (const selector of exclude) builder.exclude(selector);
  const { violations } = await builder.analyze();
  const report = violations.map(
    (violation) =>
      `${violation.id} (${violation.impact}): ${violation.help}\n` +
      violation.nodes.map((node) => `    ${node.target.join(" ")}\n      ${node.failureSummary}`).join("\n"),
  );
  expect(report, `${where}: axe found ${violations.length} kind(s) of violation\n${report.join("\n")}`).toEqual([]);
}

const isNarrow = (page: Page) => (page.viewportSize()?.width ?? 0) < 900;

for (const theme of THEMES) {
  test.describe(`${theme} theme`, () => {
    test.beforeEach(async ({ page }) => {
      await useTheme(page, theme);
    });

    test("the start, settings, sources and past lives screens have no violations", async ({ page }) => {
      await page.goto("./");
      await expect(page.getByRole("heading", { level: 1 })).toContainText("Birthright");
      await expectNoViolations(page, "start screen");

      await page.getByRole("button", { name: "Settings" }).click();
      await expect(page.getByRole("heading", { level: 1, name: "Settings" })).toBeFocused();
      await expectNoViolations(page, "settings screen");
      await page.getByRole("button", { name: "Back", exact: true }).click();

      await page.getByRole("button", { name: "Where the numbers come from" }).click();
      await expect(page.getByRole("heading", { level: 1 })).toBeFocused();
      await expectNoViolations(page, "sources screen");
      await page.getByRole("button", { name: "Back", exact: true }).click();

      await page.getByRole("button", { name: "Past lives" }).click();
      await expect(page.getByRole("heading", { level: 1, name: "Past lives" })).toBeFocused();
      await expectNoViolations(page, "past lives screen (empty)");
    });

    test("the reveal, birth screen, every tab of the life screen, a decision, the settings dialog and the summary have no violations", async ({
      page,
    }) => {
      test.setTimeout(180_000);
      await fixedRandom(page, 20261025);
      await page.goto("./");

      // The reel of names is decorative (hidden from assistive technology) and timed in CSS, so its changing
      // text is left out of the audit; the heading, the pace line and the Skip button are in it.
      await page.getByRole("button", { name: "Begin a life" }).click();
      await expect(page.getByRole("button", { name: "Skip the reveal" })).toBeVisible();
      await expectNoViolations(page, "birth reveal", ["[data-reel]"]);
      await page.getByRole("button", { name: "Skip the reveal" }).click();
      await expect(page.getByRole("heading", { level: 1 })).toContainText("You are born in");
      await expectNoViolations(page, "birth screen");

      await page.getByRole("button", { name: "Begin this life" }).click();
      await expect(page.getByRole("heading", { level: 1 })).toContainText("Age 0");
      await expectNoViolations(page, "life screen, story");

      // Every tab of both side columns; on a phone each column is first brought up from the bar of tabs.
      for (const part of [
        { column: "About you", bar: "You" },
        { column: "Around you", bar: "Around you" },
      ]) {
        if (isNarrow(page)) {
          await page
            .getByRole("tablist", { name: "Parts of this screen" })
            .getByRole("tab", { name: part.bar, exact: true })
            .click();
        }
        const column = page.getByRole("complementary", { name: part.column });
        const tabs = column.getByRole("tab");
        for (let i = 0; i < (await tabs.count()); i++) {
          const tab = tabs.nth(i);
          await tab.click();
          await expectNoViolations(page, `life screen, ${part.column}: ${(await tab.textContent())?.trim()}`);
        }
      }
      if (isNarrow(page)) await page.getByRole("tab", { name: "Story", exact: true }).click();

      await page.getByRole("button", { name: "Settings" }).click();
      await expect(page.getByRole("dialog", { name: "Settings" })).toBeVisible();
      await expectNoViolations(page, "life settings dialog");
      await page.keyboard.press("Escape");

      // Live the whole life, auditing the first decision card and the plan once it is there.
      const decision = page.getByRole("heading", { level: 2, name: "A decision" });
      const another = page.getByRole("button", { name: "Begin another life" });
      const next = page.getByRole("button", { name: "Continue to the next year" });
      const ready = page.getByRole("button", { name: "Continue to the next year", disabled: false });
      const plan = page.getByRole("region", { name: "Where your attention goes" });
      let auditedDecision = false;
      let auditedPlan = false;
      for (let step = 0; step < 400 && (await next.isVisible()); step++) {
        await next.click();
        await expect(ready.or(decision).or(another)).toBeVisible();
        if (!auditedPlan && (await plan.isVisible())) {
          auditedPlan = true;
          await expectNoViolations(page, "life screen with the plan");
        }
        if (await decision.isVisible()) {
          if (!auditedDecision) {
            auditedDecision = true;
            await expectNoViolations(page, "decision card");
          }
          await page
            .getByRole("list", { name: "Your choices" })
            .locator("button:not([aria-disabled='true'])")
            .first()
            .click();
          await expect(decision).toBeHidden();
        }
        if (await another.isVisible()) break;
      }
      expect(auditedDecision, "the fixed life met no decision to audit").toBe(true);
      await expect(another).toBeVisible();
      await expectNoViolations(page, "summary screen");

      // The finished life is kept: after a reload the start screen lists it among the past lives (SAVE-003).
      await page.reload();
      await page.getByRole("button", { name: "Past lives" }).click();
      await expect(page.getByRole("heading", { level: 1, name: "Past lives" })).toBeFocused();
      await expectNoViolations(page, "past lives screen (one life)");
      await page.getByRole("button", { name: "Delete all local data" }).click();
      await expect(page.getByRole("alertdialog", { name: "Delete all local data?" })).toBeVisible();
      await expectNoViolations(page, "delete-all confirmation");
    });
  });
}
