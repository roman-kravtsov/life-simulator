// A whole life played without a mouse (A11Y-001): only key presses, with Tab and Shift+Tab to reach a control, Enter
// and Space to press it, arrow keys in the tab lists and Escape to close a dialog. At phone and desktop widths.
import { expect, test, type Locator, type Page } from "@playwright/test";

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

const isFocused = (target: Locator) => target.evaluate((element) => element === document.activeElement);

/** Presses Tab (or Shift+Tab, `back`) until the target has focus, as a keyboard player does. */
async function tabTo(page: Page, target: Locator, { back = false, limit = 150 } = {}) {
  for (let presses = 0; presses < limit; presses++) {
    if (await isFocused(target)) return;
    await page.keyboard.press(back ? "Shift+Tab" : "Tab");
  }
  throw new Error(`${back ? "Shift+Tab" : "Tab"} did not reach the target in ${limit} presses`);
}

/** The focused element can be seen: it has a box, and a ring (outline or shadow) drawn round it. */
async function expectVisibleFocus(page: Page, what: string) {
  const focus = await page.evaluate(() => {
    const element = document.activeElement as HTMLElement | null;
    if (!element || element === document.body) return null;
    const box = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    return {
      width: box.width,
      height: box.height,
      ring:
        (style.outlineStyle !== "none" && parseFloat(style.outlineWidth) > 0) ||
        (style.boxShadow !== "none" && style.boxShadow !== ""),
    };
  });
  expect(focus, `${what}: nothing has focus`).not.toBeNull();
  expect(focus!.width, `${what}: the focused element has no width`).toBeGreaterThan(0);
  expect(focus!.height, `${what}: the focused element has no height`).toBeGreaterThan(0);
  expect(focus!.ring, `${what}: the focused element shows no ring`).toBe(true);
}

const isNarrow = (page: Page) => (page.viewportSize()?.width ?? 0) < 900;

test("a whole life by keyboard alone: begin, live, write in the journal, decide, end, leave an epitaph and begin again (A11Y-001)", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await fixedRandom(page, 20261025);
  await page.goto("./");

  const heading = page.getByRole("heading", { level: 1 });

  // The start screen: Begin a life, reached and pressed by keyboard.
  const begin = page.getByRole("button", { name: "Begin a life" });
  await tabTo(page, begin);
  await expectVisibleFocus(page, "Begin a life");
  await page.keyboard.press("Enter");

  // The birth reveal (UI-016) puts focus on Skip, which Enter presses.
  const skip = page.getByRole("button", { name: "Skip the reveal" });
  await expect(skip).toBeFocused();
  await expectVisibleFocus(page, "Skip the reveal");
  await page.keyboard.press("Enter");

  // The birth screen takes focus on its heading.
  await expect(heading).toContainText("You are born in");
  await expect(heading).toBeFocused();
  await tabTo(page, page.getByRole("button", { name: "Begin this life" }));
  await expectVisibleFocus(page, "Begin this life");
  await page.keyboard.press("Enter");

  // The life screen, on its heading.
  await expect(heading).toContainText("Age 0");
  await expect(heading).toBeFocused();

  // No trap: Escape closes the settings dialog and gives focus back to the button that opened it.
  const settings = page.getByRole("button", { name: "Settings" });
  await tabTo(page, settings, { back: true });
  await expectVisibleFocus(page, "Settings");
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog", { name: "Settings" });
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(settings).toBeFocused();

  const next = page.getByRole("button", { name: "Continue to the next year" });
  const ready = page.getByRole("button", { name: "Continue to the next year", disabled: false });
  const decision = page.getByRole("heading", { level: 2, name: "A decision" });
  const another = page.getByRole("button", { name: "Begin another life" });
  const pause = page.getByRole("region", { name: "A pause" });
  const openChoice = page.getByRole("list", { name: "Your choices" }).locator("button:not([aria-disabled='true'])");

  let answered = false;
  let decided = false;
  let noted = false;
  for (let step = 0; step < 300; step++) {
    // Continue is in the header, before the story: Shift+Tab reaches it from the year's heading.
    await tabTo(page, next, { back: true });
    if (step === 0) await expectVisibleFocus(page, "Continue");
    await page.keyboard.press("Enter");
    await expect(ready.or(decision).or(another)).toBeVisible();
    if (await another.isVisible()) break;

    if (await decision.isVisible()) {
      await expect(decision).toBeFocused();
      await tabTo(page, openChoice.first());
      if (!decided) await expectVisibleFocus(page, "a choice");
      await page.keyboard.press("Enter");
      decided = true;
      await expect(ready.or(another)).toBeVisible();
      if (await another.isVisible()) break;
    }
    await expect(heading).toBeFocused();

    // The first reflection prompt is answered from the story; Continue never waits for it otherwise.
    if (!answered && (await pause.isVisible())) {
      const field = pause.getByRole("textbox");
      await tabTo(page, field);
      await expectVisibleFocus(page, "the reflection field");
      await page.keyboard.type("A line written with the keys alone.");
      await page.keyboard.press("Enter");
      await expect(pause.getByText("Your line is saved.")).toBeVisible();
      await expect(field).toBeFocused();
      answered = true;
    }

    // Once, a line of the player's own in the Notes tab: from the Journal button on a desktop, from the bar on a phone.
    if (!noted && step >= 2) {
      const around = page.getByRole("complementary", { name: "Around you" });
      const own = around.getByRole("textbox", { name: "A line for this year" });
      if (isNarrow(page)) {
        const bar = page.getByRole("tablist", { name: "Parts of this screen" });
        await tabTo(page, bar.getByRole("tab", { selected: true }), { back: true });
        await expectVisibleFocus(page, "the bar of tabs");
        await page.keyboard.press("End");
        await expect(bar.getByRole("tab", { name: "Around you", exact: true })).toHaveAttribute(
          "aria-selected",
          "true",
        );
        await tabTo(page, around.getByRole("tab", { selected: true }));
        await page.keyboard.press("End");
        await expect(around.getByRole("tab", { name: "Notes" })).toHaveAttribute("aria-selected", "true");
        await tabTo(page, own);
      } else {
        await tabTo(page, page.getByRole("button", { name: "Journal" }), { back: true });
        await page.keyboard.press("Enter");
        await expect(own).toBeFocused();
      }
      await expectVisibleFocus(page, "the Notes field");
      await page.keyboard.type("Mine, not asked for.");
      await page.keyboard.press("Enter");
      await expect(around.getByText("Your line is saved.")).toBeVisible();

      // The whole journal in a dialog, closed again with Escape onto the button that opened it.
      const all = around.getByRole("button", { name: /^(All \d+ lines|Read the line in full)$/ });
      await tabTo(page, all);
      await page.keyboard.press("Enter");
      const journal = page.getByRole("dialog", { name: "Your journal" });
      await expect(journal).toContainText("Mine, not asked for.");
      await page.keyboard.press("Escape");
      await expect(journal).toBeHidden();
      await expect(all).toBeFocused();
      noted = true;
    }
  }
  expect(answered, "this life should offer a reflection prompt").toBe(true);
  expect(decided, "this life should meet a decision").toBe(true);
  expect(noted, "a line should have been written in the Notes tab").toBe(true);

  // The summary takes focus on the person's name; the notes are there.
  await expect(another).toBeVisible();
  await expect(heading).toBeFocused();
  await expect(page.getByRole("region", { name: "Your notes" })).toContainText("Mine, not asked for.");

  // The epitaph, written and saved by keyboard; focus goes to Edit.
  const epitaph = page.getByRole("textbox", { name: /^A few words for / });
  await tabTo(page, epitaph);
  await expectVisibleFocus(page, "the epitaph field");
  await page.keyboard.type("Wrote it down.");
  await page.keyboard.press("Enter");
  await expect(page.locator("blockquote")).toHaveText("Wrote it down.");
  const edit = page.getByRole("button", { name: "Edit" });
  await expect(edit).toBeFocused();
  await expectVisibleFocus(page, "Edit");

  // And another life: the birth screen, on its heading.
  await tabTo(page, another);
  await expectVisibleFocus(page, "Begin another life");
  await page.keyboard.press("Enter");
  await expect(skip).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(heading).toContainText("You are born in");
  await expect(heading).toBeFocused();
  expect(errors).toEqual([]);
});
