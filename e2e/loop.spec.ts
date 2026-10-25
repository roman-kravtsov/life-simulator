import { expect, test, type Page } from "@playwright/test";

const noHorizontalScroll = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

/** The first choice on the decision card that is open to the player. */
const openChoice = (page: Page) =>
  page.getByRole("list", { name: "Your choices" }).locator("button:not([aria-disabled='true'])").first();

/**
 * Lives one step: Continue, then, if the year stopped at a decision, answers it with the keyboard
 * (the first choice that is open). Returns what happened, or "ended" when the life is over, which
 * shows the summary screen with its "Begin another life" button.
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
  let ended = false;
  for (let i = 0; i < 8 && !ended; i++) {
    ended = (await liveStep(page)) === "ended";
    if (!ended) await expect(page.getByRole("heading", { level: 1 })).toContainText(/Age \d+/);
  }
  // A life that ends goes to the summary screen, which takes focus; otherwise the year is told in the status region.
  if (ended) await expect(page.getByRole("button", { name: "Begin another life" })).toBeVisible();
  else await expect(page.getByRole("status")).toContainText(/\S/);
  expect(await noHorizontalScroll(page)).toBe(true);
  expect(errors).toEqual([]);
});

test("shows the school, money and work panels on the life screen without horizontal scroll", async ({ page }) => {
  // A fixed life that reaches six: a life that ends shows the summary instead of these panels.
  await fixedRandom(page, 20261024);
  await page.goto("./");
  await page.getByRole("button", { name: "Begin a life" }).click();
  await page.getByRole("button", { name: "Begin this life" }).click();

  // MONEY-007, EDU-001, FAM-002: shown from the first year.
  await expect(page.getByRole("heading", { level: 2, name: "School" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "Money" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "Family" })).toBeVisible();
  await expect(page.getByRole("switch", { name: "Compare with US prices" })).toBeVisible();

  // CAREER-001: work appears from age six. Quiet years may pass in one step, so go on until the person is six.
  const next = page.getByRole("button", { name: "Continue to the next year" });
  const heading = page.getByRole("heading", { level: 1 });
  for (let step = 0; step < 12 && (await next.isVisible()); step++) {
    expect(await liveStep(page)).not.toBe("ended");
    const age = Number(/Age (\d+)/.exec((await heading.textContent()) ?? "")?.[1]);
    if (age >= 6) break;
  }
  await expect(page.getByRole("heading", { level: 2, name: "Work" })).toBeVisible();
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

/** Lives a whole life, answering decisions, until the summary appears. The cap stops a life that never ends. */
async function playToTheEnd(page: Page) {
  for (let step = 0; step < 400; step++) {
    if ((await liveStep(page)) === "ended") return;
  }
  throw new Error("The life did not end within 400 steps");
}

/** Begins a life and goes into its first year. */
async function beginLife(page: Page) {
  await page.getByRole("button", { name: "Begin a life" }).click();
  await page.getByRole("button", { name: "Begin this life" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Age 0");
}

test("a whole life ends on the summary screen: passage, rings, numbered moments, and an epitaph (SUM-001, SUM-002, DEATH-004)", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await fixedRandom(page, 20261025);
  await page.goto("./");
  await beginLife(page);
  await playToTheEnd(page);

  // The summary replaces the life screen and takes focus on the person's name.
  const heading = page.getByRole("heading", { level: 1 });
  await expect(heading).toBeFocused();
  await expect(heading).toContainText(/Died at \d+\./);
  await expect(page.getByRole("button", { name: "Continue to the next year" })).toBeHidden();
  // The closing passage and the line after it.
  const passage = page.locator("h1 + div p");
  await expect(passage).toHaveCount(2);
  await expect(passage.first()).toContainText(/\S/);
  // The expectancy line names its source.
  await expect(page.getByText(/can expect to live about \d+ years \(.+, \d{4}\)\./)).toBeVisible();

  // The rings are a picture with a name, one ring a year, and a table gives the same facts.
  const rings = page.getByRole("img", { name: /^The rings? of .+ life/ });
  await expect(rings).toBeVisible();
  const ringCount = await rings.locator("circle[data-ring]").count();
  expect(ringCount).toBeGreaterThan(0);
  await page.getByText("Year by year").click();
  await expect(page.getByRole("table")).toBeVisible();
  await expect(page.getByRole("table").locator("tbody tr")).toHaveCount(ringCount);

  // The key moments are numbered like the marks on the rings.
  const moments = page.locator("ol > li");
  const count = await moments.count();
  expect(count).toBeGreaterThanOrEqual(1);
  await expect(moments.first()).toBeVisible();
  await expect(moments.first()).toContainText(/^At \d+: /);
  await expect(rings.locator("[data-mark]")).toHaveCount(count);
  await expect(page.getByRole("heading", { name: "What shaped your life" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Your life in brief" })).toBeVisible();
  await expect(page.getByText(/^The seed of this life is /)).toBeVisible();
  expect(await noHorizontalScroll(page)).toBe(true);

  // The epitaph: written with the keyboard, shown as a quotation, and the Edit button is where focus lands.
  const field = page.getByRole("textbox", { name: /^A few words for / });
  await field.fill("Kept bees and told the truth.");
  await field.press("Enter");
  await expect(page.getByText("Kept bees and told the truth.")).toBeVisible();
  await expect(page.locator("blockquote")).toHaveText("Kept bees and told the truth.");
  await expect(page.getByRole("button", { name: "Edit" })).toBeFocused();
  expect(await noHorizontalScroll(page)).toBe(true);
  expect(errors).toEqual([]);
});

test("reloading in the middle of a life offers to continue it, at the same age (SAVE-001, SAVE-002)", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await fixedRandom(page, 20261026);
  await page.goto("./");
  await beginLife(page);
  const heading = page.getByRole("heading", { level: 1 });
  for (let step = 0; step < 6; step++) {
    if ((await liveStep(page)) === "ended") break;
  }
  await expect(heading).toContainText(/Age \d+/);
  const age = (await heading.textContent()) ?? "";

  await page.reload();
  const card = page.getByRole("region", { name: "Continue your life" });
  await expect(card).toBeVisible();
  await expect(card).toContainText(/, \d+, in /);
  await expect(card).toContainText("Beginning a new life replaces this one.");
  expect(await noHorizontalScroll(page)).toBe(true);
  await card.getByRole("button", { name: "Continue" }).click();
  await expect(heading).toHaveText(age);
  await expect(heading).toBeFocused();
  // The game goes on from there.
  await liveStep(page);
  expect(errors).toEqual([]);
});

test("a finished life is kept: after a reload it is listed, opens as its summary and can be deleted (SAVE-003, SAVE-007)", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await fixedRandom(page, 20261027);
  await page.goto("./");
  await beginLife(page);
  await playToTheEnd(page);

  await page.reload();
  // A life that ended is not offered for continuing; it is in the past lives.
  await expect(page.getByRole("button", { name: "Begin a life" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Continue your life" })).toBeHidden();
  await page.getByRole("button", { name: "Past lives" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Past lives" })).toBeFocused();
  const items = page.getByRole("listitem");
  await expect(items).toHaveCount(1);
  await expect(items.first()).toContainText(/Died at \d+, of /);
  expect(await noHorizontalScroll(page)).toBe(true);

  await page.getByRole("button", { name: /^Open the life of / }).click();
  await expect(page.getByRole("heading", { level: 1 })).toBeFocused();
  await expect(page.getByRole("img", { name: /^The rings? of .+ life/ })).toBeVisible();
  await page.getByRole("button", { name: "Past lives" }).click();

  await page.getByRole("button", { name: /^Delete the life of / }).click();
  const dialog = page.getByRole("alertdialog");
  await expect(dialog).toBeVisible();
  expect(await noHorizontalScroll(page)).toBe(true);
  await dialog.getByRole("button", { name: "Delete this life" }).click();
  await expect(page.getByText("No lives yet. When a life ends, it is kept here.")).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Past lives" }).click();
  await expect(page.getByText("No lives yet. When a life ends, it is kept here.")).toBeVisible();
  expect(errors).toEqual([]);
});

test("deleting all local data empties the list and leaves nothing of the game in storage (SAVE-007)", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await fixedRandom(page, 20261028);
  await page.goto("./");
  // A theme choice and a life in progress are stored, and one finished life is in the archive.
  await page.getByRole("button", { name: "Switch light or dark" }).click();
  await beginLife(page);
  await playToTheEnd(page);
  await page.getByRole("button", { name: "Begin another life" }).click();
  await page.getByRole("button", { name: "Begin this life" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Age 0");
  expect(await page.evaluate(() => Object.keys(localStorage).filter((key) => key.startsWith("birthright:")))).toEqual(
    expect.arrayContaining(["birthright:current", "birthright:theme"]),
  );

  await page.getByRole("button", { name: "Back to start" }).click();
  await page.getByRole("button", { name: "Past lives" }).click();
  await expect(page.getByRole("listitem")).toHaveCount(1);
  await page.getByRole("button", { name: "Delete all local data" }).click();
  const dialog = page.getByRole("alertdialog", { name: "Delete all local data?" });
  await expect(dialog).toContainText("every past life, the life in progress");
  await dialog.getByRole("button", { name: "Delete everything" }).click();

  await expect(page.getByRole("button", { name: "Begin a life" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Continue your life" })).toBeHidden();
  expect(await page.evaluate(() => Object.keys(localStorage).filter((key) => key.startsWith("birthright:")))).toEqual(
    [],
  );
  expect(await page.evaluate(async () => (await indexedDB.databases()).map((db) => db.name))).not.toContain(
    "birthright",
  );
  await page.getByRole("button", { name: "Past lives" }).click();
  await expect(page.getByText("No lives yet. When a life ends, it is kept here.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Delete all local data" })).toBeDisabled();
  await page.reload();
  await expect(page.getByRole("region", { name: "Continue your life" })).toBeHidden();
  expect(errors).toEqual([]);
});
