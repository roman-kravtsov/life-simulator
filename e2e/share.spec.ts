import { readFileSync } from "node:fs";
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

/** Lives a whole life, answering any decision with the first open choice, and ends on the summary screen. */
async function liveToTheEnd(page: Page) {
  await page.getByRole("button", { name: "Begin a life" }).click();
  await page.getByRole("button", { name: "Skip the reveal" }).click();
  await page.getByRole("button", { name: "Begin this life" }).click();
  const next = page.getByRole("button", { name: "Continue to the next year" });
  const decision = page.getByRole("heading", { level: 2, name: "A decision" });
  const ready = page.getByRole("button", { name: "Continue to the next year", disabled: false });
  const another = page.getByRole("button", { name: "Begin another life" });
  for (let step = 0; step < 400 && (await next.isVisible()); step++) {
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
  await expect(another).toBeVisible();
}

test("a finished life is copied as text and saved as a picture of its rings (SHARE-001, SHARE-002)", async ({
  page,
  context,
}, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await fixedRandom(page, 20261030);
  await page.goto("./");
  await liveToTheEnd(page);

  const share = page.getByRole("region", { name: "Keep this life" });
  await expect(share).toContainText("nothing is sent anywhere");

  await share.getByRole("button", { name: "Copy as text" }).click();
  await expect(share.getByText(/^Copied the text about /)).toBeVisible();
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(copied).toContain("Birthright, a free life simulation");
  expect(copied).toContain("https://roman-kravtsov.github.io/life-simulator/");
  expect(copied).toMatch(/What shaped it, as this game reckons it: \d+% circumstance, \d+% choice and \d+% chance\./);
  expect(copied.split("\n").length).toBeLessThanOrEqual(10);

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    share.getByRole("button", { name: "Save the rings as an image" }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/^birthright-[a-z]+-[a-z]+-\d+\.png$/);
  await expect(
    share.getByText(`Saved the picture as ${download.suggestedFilename()}, in your downloads.`),
  ).toBeVisible();
  const file = testInfo.outputPath("card.png");
  await download.saveAs(file);
  await testInfo.attach("card.png", { path: file, contentType: "image/png" });

  // A real PNG of the card's size, with the rings drawn on the paper and the paper left round them.
  const { width, height, corner, centre } = await page.evaluate(async (bytesBase64) => {
    const bytes = Uint8Array.from(atob(bytesBase64), (c) => c.charCodeAt(0));
    const bitmap = await createImageBitmap(new Blob([bytes], { type: "image/png" }));
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context2d = canvas.getContext("2d")!;
    context2d.drawImage(bitmap, 0, 0);
    const rgb = (x: number, y: number) => [...context2d.getImageData(x, y, 1, 1).data.slice(0, 3)];
    return { width: bitmap.width, height: bitmap.height, corner: rgb(80, 80), centre: rgb(600, 680) };
  }, readFileSync(file).toString("base64"));
  expect([width, height]).toEqual([1200, 1500]);
  expect(corner).toEqual([0xf6, 0xf1, 0xe7]);
  expect(centre).not.toEqual([0xf6, 0xf1, 0xe7]);
  expect(errors).toEqual([]);
});
