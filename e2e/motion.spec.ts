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

/** Records the names of the animations that start, from the first frame on, so a short one cannot be missed. */
async function recordAnimations(page: Page) {
  await page.addInitScript(() => {
    const started: string[] = [];
    (window as unknown as { __started: string[] }).__started = started;
    document.addEventListener("animationstart", (event) => started.push((event as AnimationEvent).animationName), true);
  });
}
const started = (page: Page) => page.evaluate(() => (window as unknown as { __started: string[] }).__started);
/** Whether an animation of that name has started (the names are the style sheet\'s, with a hash added). */
const hasStarted = async (page: Page, name: string) => (await started(page)).some((started) => started.includes(name));
const forget = (page: Page) => page.evaluate(() => (window as unknown as { __started: string[] }).__started.splice(0));

const isNarrow = (page: Page) => (page.viewportSize()?.width ?? 0) < 900;

/** Presses Continue and waits for a later age: a run of quiet years can pass in one go. */
async function continueOn(page: Page) {
  const heading = page.getByRole("heading", { level: 1 });
  const before = (await heading.textContent()) ?? "";
  await page.getByRole("button", { name: "Continue to the next year" }).click();
  await expect(heading).not.toHaveText(before);
}

test("each year settles into place after Continue, once, and then rests untransformed", async ({ page }) => {
  await recordAnimations(page);
  await beginLife(page);
  const body = page.getByRole("heading", { level: 1 }).locator("xpath=..");
  await expect(body).not.toHaveAttribute("data-settling", "", { timeout: 5_000 });
  for (let year = 0; year < 3; year++) {
    await forget(page);
    await continueOn(page);
    // The animation is the CSS one, on the transform only, it starts again for each year and it ends by itself.
    await expect.poll(() => hasStarted(page, "settle")).toBe(true);
    await expect(body).not.toHaveAttribute("data-settling", "", { timeout: 5_000 });
    expect(await body.evaluate((el) => el.getAnimations().length)).toBe(0);
    expect(await body.evaluate((el) => getComputedStyle(el).transform)).toBe("none");
    // The heading kept focus: the body was not remounted.
    await expect(page.getByRole("heading", { level: 1 })).toBeFocused();
  }
});

test("the newest ring of the thumbnail grows when a year is added, and a tab shown again replays nothing", async ({
  page,
}) => {
  await recordAnimations(page);
  await beginLife(page);
  const body = page.getByRole("heading", { level: 1 }).locator("xpath=..");
  await expect(body).not.toHaveAttribute("data-settling", "", { timeout: 5_000 });
  await forget(page);
  await continueOn(page);
  // On a phone the picture is on the You tab, hidden until it is brought up.
  const tabs = page.getByRole("tablist", { name: "Parts of this screen" });
  if (isNarrow(page)) await tabs.getByRole("tab", { name: "You", exact: true }).click();
  await expect.poll(() => hasStarted(page, "grow")).toBe(true);
  await expect(page.locator("circle[data-newest]")).toHaveCount(0, { timeout: 5_000 });
  if (isNarrow(page)) {
    // Away and back: nothing starts again, neither the year nor the ring.
    // (The year settled while the Story was out of sight, so it does as the Story is first brought back.)
    await tabs.getByRole("tab", { name: "Story", exact: true }).click();
    await expect(body).not.toHaveAttribute("data-settling", "", { timeout: 5_000 });
    await tabs.getByRole("tab", { name: "You", exact: true }).click();
    await tabs.getByRole("tab", { name: "Story", exact: true }).click();
    await forget(page);
    await page.evaluate(() => new Promise(requestAnimationFrame));
    expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
    expect(await started(page)).toEqual([]);
  }
});

test("nothing moves under reduced motion, asked by the system", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await beginLife(page);
  await continueOn(page);
  // No animation exists at all on the life screen (the settling, the ring growing, the kit's transitions), and the
  // year is where it will rest: the rise is a transform, so it never changes the layout either way.
  expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
  expect(
    await page
      .getByRole("heading", { level: 1 })
      .locator("xpath=..")
      .evaluate((el) => getComputedStyle(el).transform),
  ).toBe("none");
});

test("nothing moves under reduced motion, asked by the player's setting", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("birthright:motion", "reduced"));
  await beginLife(page);
  await continueOn(page);
  await expect(page.locator("html")).toHaveAttribute("data-motion", "reduced");
  expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
});
