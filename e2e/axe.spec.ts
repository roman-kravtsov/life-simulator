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

/**
 * Runs axe on the page as it is now and fails, naming the screen and every offending element, on any violation.
 * Axe also lists "incomplete" checks it could not decide; they are not failures. On these screens they are
 * color-contrast where a pseudo element, a dialog's overlap or an aria-hidden glyph hides the background, and
 * label-content-name-mismatch on the plan's steppers. Contrast is checked on the style sheets themselves in
 * `tests/ui/contrast.test.ts`; `AXE_DEBUG=1` prints the incomplete checks with their elements.
 */
async function expectNoViolations(page: Page, where: string, exclude: string[] = []) {
  const builder = new AxeBuilder({ page }).withTags(TAGS);
  for (const selector of exclude) builder.exclude(selector);
  const { violations, incomplete } = await builder.analyze();
  if (process.env.AXE_DEBUG)
    for (const r of incomplete)
      console.log(
        where,
        r.id,
        r.nodes.slice(0, 3).map((n) => n.target.join(" ") + " :: " + n.any.map((c) => c.message).join("|")),
      );
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
      await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
      await expectNoViolations(page, "start screen");

      await page.getByRole("button", { name: "Settings" }).click();
      await expect(page.getByRole("heading", { level: 1, name: "Settings" })).toBeFocused();
      await expectNoViolations(page, "settings screen");
      await page.getByRole("button", { name: "Back", exact: true }).click();

      await page.getByRole("button", { name: "Where the numbers come from" }).click();
      await expect(page.getByRole("heading", { level: 1 })).toBeFocused();
      await expect(page.getByRole("heading", { name: "How this works" })).toBeVisible();
      await expect(page.getByText("of the world's births")).toBeVisible();
      await expectNoViolations(page, "sources screen");
      await page.getByRole("button", { name: "Back", exact: true }).click();

      await page.getByRole("button", { name: "Past lives" }).click();
      await expect(page.getByRole("heading", { level: 1, name: "Past lives" })).toBeFocused();
      await expectNoViolations(page, "past lives screen (empty)");
    });

    test("lives as files: the settings screen with a life in progress, and the question before it is replaced, have no violations (SAVE-006)", async ({
      page,
    }, testInfo) => {
      await fixedRandom(page, 20261029);
      await page.goto("./");
      await page.getByRole("button", { name: "Begin a life" }).click();
      await page.getByRole("button", { name: "Skip the reveal" }).click();
      await page.getByRole("button", { name: "Begin this life" }).click();
      await page.getByRole("button", { name: "Settings" }).click();
      await page.getByRole("dialog", { name: "Settings" }).getByRole("button", { name: "Back to start" }).click();
      await page.getByRole("button", { name: "Settings" }).click();
      await expect(page.getByRole("heading", { level: 1, name: "Settings" })).toBeFocused();
      const [download] = await Promise.all([
        page.waitForEvent("download"),
        page.getByRole("button", { name: "Save the life in progress to a file" }).click(),
      ]);
      await expect(page.getByText(`Saved as ${download.suggestedFilename()}, in your downloads.`)).toBeVisible();
      await expectNoViolations(page, "settings screen, a file saved");
      const file = testInfo.outputPath("life.json");
      await download.saveAs(file);
      await page.locator("input[type=file]").setInputFiles(file);
      await expect(page.getByRole("alertdialog", { name: "Replace the life in progress?" })).toBeVisible();
      await expectNoViolations(page, "replace the life in progress");
      await page.keyboard.press("Escape");
      await page.getByRole("button", { name: "Back", exact: true }).click();
      await page.getByRole("button", { name: "Past lives" }).click();
      await expect(page.getByRole("heading", { level: 1, name: "Past lives" })).toBeFocused();
      await page.locator("input[type=file]").setInputFiles({
        name: "not-a-life.json",
        mimeType: "application/json",
        buffer: Buffer.from("[]"),
      });
      await expect(page.getByText(/is not a life this game can read/)).toBeVisible();
      await expectNoViolations(page, "past lives screen, a file refused");
    });

    test("the still reveal, shown while the country loads, has no violations", async ({ page }) => {
      let release: () => void = () => {};
      const held = new Promise<void>((resolve) => (release = resolve));
      await page.route("**/data/countries/*.json", async (route) => {
        await held;
        await route.continue();
      });
      await page.goto("./");
      await page.getByRole("button", { name: "Begin a life" }).click();
      await expect(page.getByRole("status")).toHaveText("Opening your life…", { timeout: 15_000 });
      await expect(page.getByRole("heading", { level: 1, name: "Where you are born" })).toBeAttached();
      await expectNoViolations(page, "still reveal");
      release();
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
          if ((await tab.textContent())?.trim() === "Notes") {
            // A line written in the journal lists it in a dialog, which is audited open.
            await column.getByRole("textbox", { name: "A line for this year" }).fill("A line for the audit.");
            await column.getByRole("button", { name: "Save" }).click();
            await column.getByRole("button", { name: "Read the line in full" }).click();
            await expect(page.getByRole("dialog")).toBeVisible();
            await expectNoViolations(page, "journal lines dialog");
            await page.keyboard.press("Escape");
          }
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
      expect(auditedPlan, "the fixed life never showed the plan to audit").toBe(true);
      await expect(another).toBeVisible();
      await expectNoViolations(page, "summary screen");
      // The share panel's text open, with the notice that a press of Copy leaves (SHARE-001, SHARE-002).
      const share = page.getByRole("region", { name: "Keep this life" });
      await share.getByText("Show the text").click();
      await share.getByRole("button", { name: "Save the rings as an image" }).click();
      await expect(share.getByText(/^Saved the picture as birthright-.+\.png/)).toBeVisible();
      await expectNoViolations(page, "summary screen with the share text open");

      // The finished life is kept: after a reload the start screen lists it among the past lives (SAVE-003).
      await page.reload();
      await page.getByRole("button", { name: "Past lives" }).click();
      await expect(page.getByRole("heading", { level: 1, name: "Past lives" })).toBeFocused();
      await expectNoViolations(page, "past lives screen (one life)");
      await page.getByRole("button", { name: /^Delete(?! all)/ }).click();
      await expect(page.getByRole("alertdialog")).toBeVisible();
      await expectNoViolations(page, "delete-one-life confirmation");
      await page.keyboard.press("Escape");
      await page.getByRole("button", { name: "Delete all local data" }).click();
      await expect(page.getByRole("alertdialog", { name: "Delete all local data?" })).toBeVisible();
      await expectNoViolations(page, "delete-all confirmation");
    });
  });
}
