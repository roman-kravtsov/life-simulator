// Motion (UI-013): this year settles into place when Continue is pressed, and nothing moves under reduced motion.
// The timing is CSS alone, so the test reads the browser's own animations; no sleeps, only polling.
import { expect, test, type Page } from "@playwright/test";

/** Makes the browser's random numbers a fixed sequence, so a test plays the same life every time. */
async function fixedRandom(page: Page, start: number) {
  await page.addInitScript((first) => {
    let x = first;
    crypto.getRandomValues = ((array: Uint32Array) => {
      for (let i = 0; i < array.length; i++) array[i] = x = (Math.imul(x, 1664525) + 1013904223) >>> 0;
      return array;
    }) as typeof crypto.getRandomValues;
  }, start);
}

/** Begins a life and stands on the life screen at age 0. */
async function beginLife(page: Page) {
  await fixedRandom(page, 20261030);
  await page.goto("./");
  await page.getByRole("button", { name: "Begin a life" }).click();
  // Under reduced motion there is no reel to skip (UI-016): the birth screen follows at once.
  const skip = page.getByRole("button", { name: "Skip the reveal" });
  const begin = page.getByRole("button", { name: "Begin this life" });
  await expect(skip.or(begin)).toBeVisible();
  if (await skip.isVisible()) await skip.click();
  await begin.click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Age 0");
}

const thisYear = (page: Page) => page.locator("[data-year]");

/** Presses Continue; the year moves to age 1 (the first years of a life stop at no decision). */
async function continueOnce(page: Page) {
  await page.getByRole("button", { name: "Continue to the next year" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Age 1");
}

test("this year settles into place after Continue, then rests untransformed", async ({ page }) => {
  await beginLife(page);
  await continueOnce(page);
  const body = thisYear(page);
  // The animation is the CSS one, on the transform only, and it ends by itself.
  await expect
    .poll(async () => body.evaluate((el) => el.getAnimations().map((a) => (a as CSSAnimation).animationName)))
    .toEqual(expect.arrayContaining([expect.stringMatching(/settle-(even|odd)/)]));
  await expect.poll(() => body.evaluate((el) => el.getAnimations().length), { timeout: 5_000 }).toBe(0);
  expect(await body.evaluate((el) => getComputedStyle(el).transform)).toBe("none");
  // The heading kept focus: the body was not remounted.
  await expect(page.getByRole("heading", { level: 1 })).toBeFocused();
});

test("nothing moves under reduced motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await beginLife(page);
  await continueOnce(page);
  // No animation exists at all on the life screen (the settling, the ring growing, the kit's transitions), and the
  // year is where it will rest: the rise is a transform, so it never changes the layout either way.
  expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
  expect(await thisYear(page).evaluate((el) => getComputedStyle(el).transform)).toBe("none");
});
