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

/** Begins a life and lives a few years, answering any decision with the first open choice. Returns the age reached. */
async function liveAFewYears(page: Page, years: number): Promise<string> {
  await page.getByRole("button", { name: "Begin a life" }).click();
  await page.getByRole("button", { name: "Skip the reveal" }).click();
  await page.getByRole("button", { name: "Begin this life" }).click();
  const heading = page.getByRole("heading", { level: 1 });
  const next = page.getByRole("button", { name: "Continue to the next year" });
  const decision = page.getByRole("heading", { level: 2, name: "A decision" });
  const ready = page.getByRole("button", { name: "Continue to the next year", disabled: false });
  const another = page.getByRole("button", { name: "Begin another life" });
  for (let step = 0; step < years && (await next.isVisible()); step++) {
    await next.click();
    await expect(ready.or(decision).or(another)).toBeVisible();
    if (await decision.isVisible()) {
      await page
        .getByRole("list", { name: "Your choices" })
        .locator("button:not([aria-disabled='true'])")
        .first()
        .click();
      await expect(decision).toBeHidden();
    }
  }
  await expect(heading).toContainText(/Age \d+/);
  return (await heading.textContent()) ?? "";
}

/** From the life screen to the start screen, where that action lives in the settings dialog. */
async function backToStart(page: Page) {
  await page.getByRole("button", { name: "Settings" }).click();
  await page.getByRole("dialog", { name: "Settings" }).getByRole("button", { name: "Back to start" }).click();
}

test("a life is saved to a file, the browser is emptied, and the file brings the life back at the same age (SAVE-006)", async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await fixedRandom(page, 20261029);
  await page.goto("./");
  const age = await liveAFewYears(page, 5);
  await backToStart(page);

  await page.getByRole("button", { name: "Settings" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Settings" })).toBeFocused();
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Save the life in progress to a file" }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/^birthright-[a-z]+-[a-z]+-\d+\.json$/);
  await expect(page.getByText(`Saved as ${download.suggestedFilename()}, in your downloads.`)).toBeVisible();
  const file = testInfo.outputPath("life.json");
  await download.saveAs(file);

  // A clean browser: everything the game keeps is deleted, through the game's own button.
  await page.getByRole("button", { name: "Delete all local data" }).click();
  await page.getByRole("button", { name: "Delete everything" }).click();
  await expect(page.getByText("All local data in this browser was deleted.")).toBeVisible();
  await expect(page.getByRole("region", { name: "Continue your life" })).toHaveCount(0);

  await page.getByRole("button", { name: "Settings" }).click();
  await page.locator("input[type=file]").setInputFiles(file);
  await expect(page.getByText(/You can now continue .+ from the start screen\./)).toBeVisible();
  await page.getByRole("button", { name: "Back", exact: true }).click();

  const card = page.getByRole("region", { name: "Continue your life" });
  await expect(card).toContainText(/, \d+, in /);
  await card.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(age);
  // The life goes on from there.
  await page.getByRole("button", { name: "Continue to the next year" }).click();
  expect(errors).toEqual([]);
});

test("a file that is not a life says so and changes nothing (SAVE-006)", async ({ page }) => {
  await page.goto("./");
  await page.getByRole("button", { name: "Settings" }).click();
  await expect(page.getByRole("button", { name: "Save the life in progress to a file" })).toBeDisabled();
  await page.locator("input[type=file]").setInputFiles({
    name: "not-a-life.json",
    mimeType: "application/json",
    buffer: Buffer.from('{"hello":"world"}'),
  });
  await expect(page.getByText(/is not a life this game can read/)).toBeVisible();
});
