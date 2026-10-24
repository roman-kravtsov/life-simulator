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

test("sources screen lists the real sources without horizontal scroll", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));

  await page.goto("./");
  await page.getByRole("button", { name: "Where the numbers come from" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Where the numbers come from");
  await expect(page.getByRole("link", { name: /World Population Prospects 2024/ })).toBeVisible();
  await expect(page.getByText("CC BY 3.0 IGO")).toBeVisible();
  await page.getByText(/countries and what is missing/).click();
  await expect(page.getByText(/^Afghanistan: /)).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);
  expect(errors).toEqual([]);

  await page.getByRole("button", { name: "Back" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Birthright");
});
