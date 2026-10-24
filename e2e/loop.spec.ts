import { expect, test } from "@playwright/test";

test("begins a life, shows the birth screen and plays years without errors or horizontal scroll", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const noHorizontalScroll = () => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

  await page.goto("./");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Birthright");
  await page.getByRole("button", { name: "Begin a life" }).click();

  // CHAR-001, MONEY-001, FAM-001, RNG-003: the new person in words.
  await expect(page.getByRole("heading", { level: 1 })).toContainText("You are born in");
  await expect(page.getByText(/^You are .+, a (girl|boy)\./)).toBeVisible();
  await expect(page.getByText(/tenth of households in .+ about \$/)).toBeVisible();
  await expect(page.getByText(/^Your mother, .+, is \d+\. Your father, .+, is \d+\.$/)).toBeVisible();
  await expect(page.getByText(/^Life .+/)).toBeVisible();
  expect(await noHorizontalScroll()).toBe(true);

  await page.getByRole("button", { name: "Begin this life" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Age 0");
  await expect(page.getByRole("heading", { name: "Family" })).toBeVisible();

  // A life can end early, so stop when the continue button goes away.
  const next = page.getByRole("button", { name: "Continue to the next year" });
  for (let i = 0; i < 3; i++) {
    if (!(await next.isVisible())) break;
    await next.click();
    await expect(page.getByRole("heading", { level: 1 })).toContainText(/Age \d+/);
  }
  await expect(page.getByRole("status")).toContainText(/\S/);
  expect(await noHorizontalScroll()).toBe(true);
  expect(errors).toEqual([]);
});

test("shows the school, money and work panels on the life screen without horizontal scroll", async ({ page }) => {
  await page.goto("./");
  await page.getByRole("button", { name: "Begin a life" }).click();
  await page.getByRole("button", { name: "Begin this life" }).click();

  // MONEY-007, EDU-001, FAM-002: shown from the first year.
  await expect(page.getByRole("heading", { level: 2, name: "School" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "Money" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "Family" })).toBeVisible();
  await expect(page.getByRole("switch", { name: "Compare with US prices" })).toBeVisible();

  // CAREER-001: work appears from age six. A life can end early, so stop when it does.
  const next = page.getByRole("button", { name: "Continue to the next year" });
  const heading = page.getByRole("heading", { level: 1 });
  for (let age = 0; age < 6 && (await next.isVisible()); age++) {
    await next.click();
    await expect(heading).toContainText(`Age ${age + 1}`);
  }
  if (await next.isVisible()) {
    await expect(page.getByRole("heading", { level: 2, name: "Work" })).toBeVisible();
  }
  await expect(page.getByRole("heading", { level: 2, name: "Money" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
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
