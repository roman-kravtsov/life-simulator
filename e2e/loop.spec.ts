import { expect, test, type Page } from "@playwright/test";

const noHorizontalScroll = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

/** The first choice on the decision card that is open to the player. */
const openChoice = (page: Page) =>
  page.getByRole("list", { name: "Your choices" }).locator("button:not([aria-disabled='true'])").first();

/**
 * Lives one step: Continue, then, if the year stopped at a decision, answers it with the keyboard
 * (the first choice that is open). Returns what happened, or "ended" when the life is over.
 */
async function liveStep(page: Page): Promise<"year" | "decided" | "ended"> {
  const next = page.getByRole("button", { name: "Continue to the next year" });
  const another = page.getByRole("button", { name: "Begin another life" });
  const decision = page.getByRole("heading", { level: 2, name: "A decision" });
  if (!(await next.isVisible())) return "ended";
  await next.click();
  await expect(next.or(decision).or(another)).toBeVisible();
  if (!(await decision.isVisible())) return (await another.isVisible()) ? "ended" : "year";

  // The card takes focus, and a long card must not push the page sideways.
  await expect(decision).toBeFocused();
  await expect(page.getByRole("status")).toContainText("A decision is waiting.");
  expect(await noHorizontalScroll(page)).toBe(true);
  await openChoice(page).focus();
  await page.keyboard.press("Enter");
  await expect(decision).toBeHidden();
  await expect(page.getByRole("heading", { level: 1 })).toBeFocused();
  return (await another.isVisible()) ? "ended" : "decided";
}

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

test("begins a life, shows the birth screen and plays years without errors or horizontal scroll", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));

  await page.goto("./");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Birthright");
  await page.getByRole("button", { name: "Begin a life" }).click();

  // CHAR-001, MONEY-001, FAM-001, RNG-003: the new person in words.
  await expect(page.getByRole("heading", { level: 1 })).toContainText("You are born in");
  await expect(page.getByText(/^You are .+, a (girl|boy)\./)).toBeVisible();
  await expect(page.getByText(/tenth of households in .+ about \$/)).toBeVisible();
  await expect(page.getByText(/^Your mother, .+, is \d+\. Your father, .+, is \d+\.$/)).toBeVisible();
  await expect(page.getByText(/^Life .+/)).toBeVisible();
  expect(await noHorizontalScroll(page)).toBe(true);

  await page.getByRole("button", { name: "Begin this life" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Age 0");
  await expect(page.getByRole("heading", { name: "Family" })).toBeVisible();

  // A life can end early, so stop when it does. Decisions come up in most childhoods: answer them.
  for (let i = 0; i < 8; i++) {
    if ((await liveStep(page)) === "ended") break;
    await expect(page.getByRole("heading", { level: 1 })).toContainText(/Age \d+/);
  }
  await expect(page.getByRole("status")).toContainText(/\S/);
  expect(await noHorizontalScroll(page)).toBe(true);
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
  // Quiet years may pass in one step, so go on until the person is six.
  const next = page.getByRole("button", { name: "Continue to the next year" });
  const heading = page.getByRole("heading", { level: 1 });
  for (let step = 0; step < 12 && (await next.isVisible()); step++) {
    if ((await liveStep(page)) === "ended") break;
    const age = Number(/Age (\d+)/.exec((await heading.textContent()) ?? "")?.[1]);
    if (age >= 6) break;
  }
  if (await next.isVisible()) {
    await expect(page.getByRole("heading", { level: 2, name: "Work" })).toBeVisible();
  }
  await expect(page.getByRole("heading", { level: 2, name: "Money" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("the plan can be placed by keyboard and carries over, and the help link is always there (UI-005, UI-012)", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await fixedRandom(page, 20261024);

  await page.goto("./");
  // UI-012: the link is on the start screen, opens a new tab and is a real link.
  const talk = page.getByRole("link", { name: "Need to talk?" });
  await expect(talk).toHaveAttribute("href", "https://findahelpline.com");
  await expect(talk).toHaveAttribute("target", "_blank");
  await expect(talk).toHaveAttribute("rel", "noopener noreferrer");

  // The settings are on the start screen too.
  await expect(page.getByRole("switch", { name: "Softer telling" })).not.toBeChecked();
  await expect(page.getByRole("switch", { name: "Skip quiet years" })).toBeChecked();

  await page.getByRole("button", { name: "Begin a life" }).click();
  await page.getByRole("button", { name: "Begin this life" }).click();
  await expect(talk).toBeVisible();

  // No plan before six; from six the widget shows.
  const region = page.getByRole("region", { name: "Where your attention goes" });
  await expect(region).toBeHidden();
  const next = page.getByRole("button", { name: "Continue to the next year" });
  const heading = page.getByRole("heading", { level: 1 });
  const ageNow = async () => Number(/Age (\d+)/.exec((await heading.textContent()) ?? "")?.[1]);
  // Quiet years may pass in one step: live on until the age is six or more, and the widget must be there.
  for (let step = 0; step < 14 && (await ageNow()) < 6; step++) {
    await liveStep(page);
  }
  expect(await ageNow()).toBeGreaterThanOrEqual(6);
  await expect(region).toBeVisible();
  expect(await noHorizontalScroll(page)).toBe(true);

  // Take a point off the first area that has one and give it to Rest, with the keyboard.
  let taken = "";
  for (const name of ["Learn", "Earn", "Health", "Belonging"]) {
    const field = region.getByRole("textbox", { name });
    if ((await field.isEnabled()) && Number(await field.inputValue()) > 0) {
      await field.focus();
      await page.keyboard.press("ArrowDown");
      taken = name;
      break;
    }
  }
  expect(taken).not.toBe("");
  await expect(region.getByText(/1 point left to place/)).toBeVisible();
  const rest = region.getByRole("textbox", { name: "Rest" });
  const restBefore = Number(await rest.inputValue());
  await rest.focus();
  await page.keyboard.press("ArrowUp");
  await expect(rest).toHaveValue(String(restBefore + 1));
  await expect(region.getByText("All points placed.")).toBeVisible();
  expect(await noHorizontalScroll(page)).toBe(true);

  // Continue sends the plan, and it is still the player's after the next year. A decision may stop the
  // year first: answer it (a few can follow one another) until the life screen asks for Continue again.
  await next.click();
  const decision = page.getByRole("heading", { level: 2, name: "A decision" });
  for (let answered = 0; answered < 5; answered++) {
    await expect(decision.or(next)).toBeVisible();
    if (!(await decision.isVisible())) break;
    await openChoice(page).focus();
    await page.keyboard.press("Enter");
  }
  await expect(next).toBeVisible();
  await expect(region.getByText(/These are the points you set/)).toBeVisible();
  expect(errors).toEqual([]);
});

test("a setting changed in the middle of a life stays changed", async ({ page }) => {
  await page.goto("./");
  await page.getByRole("button", { name: "Begin a life" }).click();
  await page.getByRole("button", { name: "Begin this life" }).click();
  const softer = page.getByRole("switch", { name: "Softer telling" });
  await softer.focus();
  await page.keyboard.press("Space");
  await expect(softer).toBeChecked();
  if ((await liveStep(page)) !== "ended") await expect(softer).toBeChecked();
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
