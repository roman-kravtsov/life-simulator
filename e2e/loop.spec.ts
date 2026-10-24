import { expect, test } from "@playwright/test";

test("begins a life and plays a few years without errors or horizontal scroll", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));

  await page.goto("./");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Birthright");
  await page.getByRole("button", { name: "Begin a life" }).click();
  for (let i = 0; i < 3; i++) await page.getByRole("button", { name: "Continue to the next year" }).click();

  await expect(page.getByRole("heading", { level: 1 })).toContainText("Age 3");
  await expect(page.getByRole("status")).toHaveText("A new chapter begins: Childhood.");
  expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);
  expect(errors).toEqual([]);
});

test("theme toggle switches between light and dark", async ({ page }) => {
  await page.goto("./");
  const before = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  await page.getByRole("button", { name: "Switch light or dark" }).click();
  const after = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(after).not.toBe(before);
});
