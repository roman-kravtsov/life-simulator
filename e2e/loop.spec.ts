import { expect, test, type Locator, type Page } from "@playwright/test";

const noHorizontalScroll = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

/** Continue when it can be pressed: while a decision waits it is still there, but disabled, with the reason. */
const continueReady = (page: Page) => page.getByRole("button", { name: "Continue to the next year", disabled: false });

/** Below 900 px the life screen is one column at a time, chosen from a bar of tabs (UI-010). */
const isNarrow = (page: Page) => (page.viewportSize()?.width ?? 0) < 900;

const PART_LABEL = { you: "About you", around: "Around you" } as const;
const PART_TAB = { you: "You", around: "Around you" } as const;

/** The side column (`you` or `around`) on the life screen, brought into view: on a phone its tab in the bar is pressed first. */
async function openPart(page: Page, part: keyof typeof PART_LABEL): Promise<Locator> {
  if (isNarrow(page)) {
    await page
      .getByRole("tablist", { name: "Parts of this screen" })
      .getByRole("tab", { name: PART_TAB[part], exact: true })
      .click();
  }
  return page.getByRole("complementary", { name: PART_LABEL[part] });
}

/** The panel of one tab of a side column, opened. */
async function openSideTab(page: Page, part: keyof typeof PART_LABEL, tab: string): Promise<Locator> {
  const column = await openPart(page, part);
  await column.getByRole("tab", { name: tab, exact: true }).click();
  return column.getByRole("tabpanel");
}

/** Presses Tab until the target has focus, so a test reaches a control the way a keyboard player does. */
async function tabTo(page: Page, target: Locator, limit = 100) {
  for (let presses = 0; presses < limit; presses++) {
    if (await target.evaluate((element) => element === document.activeElement)) return;
    await page.keyboard.press("Tab");
  }
  throw new Error(`Tab did not reach the target in ${limit} presses`);
}

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
  const ready = continueReady(page);
  const another = page.getByRole("button", { name: "Begin another life" });
  const decision = page.getByRole("heading", { level: 2, name: "A decision" });
  if (!(await next.isVisible())) return "ended";
  await next.click();
  await expect(ready.or(decision).or(another)).toBeVisible();
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
  // UI-016: the reveal comes first; its names are not read out. Skip leads on to the birth screen.
  await expect(page.locator("[data-reel]")).toHaveAttribute("aria-hidden", "true");
  await page.getByRole("button", { name: "Skip the reveal" }).click();

  // CHAR-001, MONEY-001, FAM-001, RNG-003: the new person in words.
  await expect(page.getByRole("heading", { level: 1 })).toContainText("You are born in");
  await expect(page.getByText(/^You are .+, a (girl|boy)\./)).toBeVisible();
  await expect(
    page.getByText(/^Of all the households in .+, yours is in the .*tenth.*\. Each person in it lives on about \$/),
  ).toBeVisible();
  await expect(
    page.getByText(
      /You have (no older brothers or sisters|one older brother or sister|\d+ older brothers and sisters)\.$/,
    ),
  ).toBeVisible();
  // WORLD-008: the country panel, with a source under each fact.
  await expect(page.getByRole("region", { name: "Where you were born" })).toContainText(
    /Life expectancy at birth|no measured figures/,
  );
  await expect(page.getByText(/^Your mother, .+, is \d+\. Your father, .+, is \d+\./)).toBeVisible();
  await expect(page.getByText(/^Life [a-z]+-[a-z]+-\d+$/)).toBeVisible();
  expect(await noHorizontalScroll(page)).toBe(true);

  await page.getByRole("button", { name: "Begin this life" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Age 0");
  await expect(page.getByRole("button", { name: "Continue to the next year" })).toBeVisible();
  await expect((await openSideTab(page, "around", "Family")).getByRole("list").first()).toBeVisible();

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

test("shows the school, money, family and work panels on the life screen without horizontal scroll", async ({
  page,
}) => {
  // A fixed life that reaches six: a life that ends shows the summary instead of these panels.
  await fixedRandom(page, 20261024);
  await page.goto("./");
  await page.getByRole("button", { name: "Begin a life" }).click();
  await page.getByRole("button", { name: "Skip the reveal" }).click();
  await page.getByRole("button", { name: "Begin this life" }).click();

  // MONEY-007, EDU-001, FAM-002: shown from the first year, each in its tab.
  await expect(await openSideTab(page, "you", "School & work")).toContainText("Schooling");
  const money = await openSideTab(page, "you", "Money");
  await expect(money.getByRole("switch", { name: "Compare with US prices" })).toBeVisible();
  await expect(await openSideTab(page, "around", "Family")).toContainText("your mother");
  await expect(await openSideTab(page, "around", "Country")).toContainText(/, \d{4}/);

  // CAREER-001: work appears from age six. Quiet years may pass in one step, so go on until the person is six.
  const next = page.getByRole("button", { name: "Continue to the next year" });
  const heading = page.getByRole("heading", { level: 1 });
  const ageNow = async () => Number(/Age (\d+)/.exec((await heading.textContent()) ?? "")?.[1]);
  for (let step = 0; step < 12 && (await next.isVisible()); step++) {
    expect(await liveStep(page)).not.toBe("ended");
    if ((await ageNow()) >= 6) break;
  }
  if (isNarrow(page)) await page.getByRole("tab", { name: "Story", exact: true }).click();
  await expect(heading).toContainText(/Age \d+/);
  const school = await openSideTab(page, "you", "School & work");
  await expect(school.getByText("Now", { exact: true })).toBeVisible();
  await expect(await openSideTab(page, "you", "Money")).toContainText("a day");
  expect(await noHorizontalScroll(page)).toBe(true);
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
  await page.getByRole("button", { name: "Skip the reveal" }).click();
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
    await expect(decision.or(continueReady(page))).toBeVisible();
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
  await page.getByRole("button", { name: "Skip the reveal" }).click();
  await page.getByRole("button", { name: "Begin this life" }).click();
  // On the life screen the settings are in a dialog under the Settings button.
  const dialog = page.getByRole("dialog", { name: "Settings" });
  const softer = dialog.getByRole("switch", { name: "Softer telling" });
  await page.getByRole("button", { name: "Settings" }).click();
  await softer.focus();
  await page.keyboard.press("Space");
  await expect(softer).toBeChecked();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(page.getByRole("button", { name: "Settings" })).toBeFocused();
  if ((await liveStep(page)) !== "ended") {
    await page.getByRole("button", { name: "Settings" }).click();
    await expect(softer).toBeChecked();
  }
});

test("the settings screen, from the start: the theme, the text size and motion apply to the whole page (UI-009, A11Y-004, A11Y-005)", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("./");
  // Every screen's header is the banner, outside the one main (UI-010).
  await expect(page.getByRole("banner")).toHaveCount(1);
  await expect(page.locator("main header")).toHaveCount(0);
  await page.getByRole("button", { name: "Settings" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Settings" })).toBeFocused();
  await expect(page.locator("main header")).toHaveCount(0);

  const root = (property: string) =>
    page.evaluate((name) => getComputedStyle(document.documentElement).getPropertyValue(name), property);
  const before = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  // The input is visually hidden inside its label, so the press goes to the label, as a player's would.
  await page.getByText("Dark", { exact: true }).click();
  await expect(page.getByRole("radio", { name: "Dark" })).toBeChecked();
  expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).not.toBe(before);
  await page.getByText("Light", { exact: true }).click();
  expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe(before);

  // The text size, by keyboard: 125% of the browser's 16 px.
  await page.getByRole("radio", { name: "Default" }).focus();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowDown");
  await expect(page.getByRole("radio", { name: "Largest" })).toBeChecked();
  expect(await root("font-size")).toBe("20px");
  expect(await noHorizontalScroll(page)).toBe(true);

  // Reduce motion: the switch's own movement stops.
  const motion = page.getByRole("switch", { name: "Reduce motion" });
  const track = () =>
    motion.evaluate(
      (input) =>
        getComputedStyle(input.closest("label")!.querySelector('span[aria-hidden="true"]')!).transitionDuration,
    );
  expect(await track()).not.toBe("0s");
  await motion.focus();
  await page.keyboard.press("Space");
  await expect(motion).toBeChecked();
  expect(await track()).toBe("0s");

  // Kept after a reload, and still applied.
  await page.reload();
  expect(await root("font-size")).toBe("20px");
  expect(await page.evaluate(() => document.documentElement.dataset.motion)).toBe("reduced");

  // The start screen, the birth screen and the life screen at the largest text, without sideways scroll.
  await page.getByRole("button", { name: "Begin a life" }).click();
  // Motion is reduced, so there is no birth reveal to skip (UI-016).
  await page.getByRole("button", { name: "Begin this life" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Age 0");
  expect(await noHorizontalScroll(page)).toBe(true);
  await page.getByRole("button", { name: "Settings" }).click();
  await page.getByRole("dialog", { name: "Settings" }).getByRole("button", { name: "Back to start" }).click();
  await page.getByRole("button", { name: "Settings" }).click();
  await page.getByRole("button", { name: "Back" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Birthright");
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
  await expect(page.getByRole("heading", { level: 2, name: "How this works" })).toBeVisible();
  await expect(page.getByText(/of the world's births in \d{4}/)).toBeVisible();
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
  await page.getByRole("button", { name: "Skip the reveal" }).click();
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
  await expect(page.getByText(/^Died at \d+, of .+\.$/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Continue to the next year" })).toBeHidden();
  // The closing passage and the line after it.
  const passage = page.locator("h1 + p + div p");
  await expect(passage).toHaveCount(2);
  await expect(passage.first()).toContainText(/\S/);
  // The expectancy line names its source.
  await expect(page.getByText(/can expect to live about \d+ years \(.+, \d{4}\)\./)).toBeVisible();

  // The rings are a picture with a name, one ring a year, and a table gives the same facts.
  const rings = page.getByRole("img", { name: /^The rings? of .+ life/ });
  await expect(rings).toBeVisible();
  const ringCount = await rings.locator("circle[data-ring]").count();
  expect(ringCount).toBeGreaterThan(0);
  // The paper line between rings is at least about half a pixel where it is drawn, even at about 400 px.
  const separator = await rings.evaluate((svg) => {
    const circle = svg.querySelector("circle[data-ring]")!;
    return parseFloat(getComputedStyle(circle).strokeWidth) * (svg.getBoundingClientRect().width / 100);
  });
  expect(separator).toBeGreaterThanOrEqual(0.5);
  await page.getByText("Year by year", { exact: true }).click();
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
  await expect(page.getByText("Kept bees and told the truth.", { exact: true })).toBeVisible();
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
  await page.getByRole("button", { name: "Skip the reveal" }).click();
  await page.getByRole("button", { name: "Begin this life" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Age 0");
  expect(await page.evaluate(() => Object.keys(localStorage).filter((key) => key.startsWith("birthright:")))).toEqual(
    expect.arrayContaining(["birthright:current", "birthright:theme"]),
  );

  await page.getByRole("button", { name: "Settings" }).click();
  await page.getByRole("dialog", { name: "Settings" }).getByRole("button", { name: "Back to start" }).click();
  await page.getByRole("button", { name: "Past lives" }).click();
  await expect(page.getByRole("listitem")).toHaveCount(1);
  await page.getByRole("button", { name: "Delete all local data" }).click();
  const dialog = page.getByRole("alertdialog", { name: "Delete all local data?" });
  await expect(dialog).toContainText("every past life, the life in progress");
  await dialog.getByRole("button", { name: "Delete everything" }).click();

  await expect(page.getByRole("button", { name: "Begin a life" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Continue your life" })).toBeHidden();
  await expect(page.getByRole("status")).toContainText("All local data in this browser was deleted.");
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

const SIDE_TABS = {
  you: ["School & work", "Money", "Health"],
  around: ["Family", "Country", "Notes"],
} as const;

/** Every tab of both side columns fits its column without scrolling, and the column ends inside the window (UI-010). */
async function expectColumnsFit(page: Page, when: string) {
  const height = page.viewportSize()!.height;
  for (const part of ["you", "around"] as const) {
    const column = page.getByRole("complementary", { name: PART_LABEL[part] });
    for (const tab of SIDE_TABS[part]) {
      const panel = await openSideTab(page, part, tab);
      const fit = await column.evaluate(
        (aside, tabpanel) => {
          const panelBox = tabpanel.getBoundingClientRect();
          return {
            asideOverflow: aside.scrollHeight - aside.clientHeight,
            panelOverflow: tabpanel.scrollHeight - tabpanel.clientHeight,
            bottom: Math.max(aside.getBoundingClientRect().bottom, panelBox.bottom),
          };
        },
        await panel.elementHandle(),
      );
      const where = `${PART_LABEL[part]} / ${tab} at ${height} px tall, ${when}`;
      expect(fit.asideOverflow, `${where}: the column scrolls`).toBeLessThanOrEqual(0);
      expect(fit.panelOverflow, `${where}: the tab scrolls`).toBeLessThanOrEqual(0);
      expect(fit.bottom, `${where}: the column runs below the window`).toBeLessThanOrEqual(height + 0.5);
    }
  }
}

test("the side columns fit a short window, in every tab, with a decision waiting or not (UI-010)", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name === "phone", "The side columns are only side by side in the wide layout");
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await fixedRandom(page, 20261024);
  await page.goto("./");
  await beginLife(page);

  // Live on into the teens, where there is school, work, money and family to show, and look at the columns in the
  // years that end at a decision as well as the ones that do not. Both short heights the layout is meant for.
  const next = page.getByRole("button", { name: "Continue to the next year" });
  const decision = page.getByRole("heading", { level: 2, name: "A decision" });
  const heading = page.getByRole("heading", { level: 1 });
  const pause = page.getByRole("region", { name: "A pause" });
  // The Notes tab at its fullest: three long lines (the longest the journal keeps), with prompts where one is offered.
  const long =
    "The river was high that spring and we walked the long way round, past the school and the market. ".repeat(3);
  let written = 0;
  let seenDecision = false;
  let checked = 0;
  let checkedWithNotes = 0;
  for (let step = 0; step < 40; step++) {
    if (!(await next.isVisible())) break;
    await next.click();
    await expect(continueReady(page).or(decision)).toBeVisible();
    const waiting = await decision.isVisible();
    seenDecision ||= waiting;
    if (!waiting && written < 3) {
      const field = (await pause.isVisible())
        ? pause.getByRole("textbox")
        : (await openSideTab(page, "around", "Notes")).getByRole("textbox", { name: "A line for this year" });
      await field.fill(long);
      await field.press("Enter");
      await expect(page.getByText("Your line is saved.")).toBeVisible();
      written++;
    }
    if (step % 3 === 0 || waiting) {
      for (const height of [640, 600]) {
        await page.setViewportSize({ width: 1440, height });
        await expectColumnsFit(page, waiting ? "a decision waiting" : "no decision");
      }
      await page.setViewportSize({ width: 1440, height: 900 });
      checked++;
      if (written >= 3) checkedWithNotes++;
    }
    if (waiting) {
      await openChoice(page).focus();
      await page.keyboard.press("Enter");
      await expect(decision).toBeHidden();
    }
    if (Number(/Age (\d+)/.exec((await heading.textContent()) ?? "")?.[1]) >= 30) break;
  }
  expect(checked).toBeGreaterThan(3);
  expect(checkedWithNotes, "the Notes tab should be checked with three lines written").toBeGreaterThan(0);
  expect(seenDecision, "this life should meet a decision").toBe(true);
  expect(errors).toEqual([]);
});

test("a whole year can be played by keyboard alone: Continue, a decision, the plan and the side tabs (UI-004, A11Y)", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await fixedRandom(page, 20261024);
  await page.goto("./");
  await beginLife(page);

  const next = page.getByRole("button", { name: "Continue to the next year" });
  const decision = page.getByRole("heading", { level: 2, name: "A decision" });
  const heading = page.getByRole("heading", { level: 1 });
  const region = page.getByRole("region", { name: "Where your attention goes" });
  const ageNow = async () => Number(/Age (\d+)/.exec((await heading.textContent()) ?? "")?.[1]);

  // Continue is in the header, so the Tab key reaches it from anywhere in the page; a decision then takes focus.
  for (let step = 0; step < 14 && (await ageNow()) < 6; step++) {
    await tabTo(page, next);
    await page.keyboard.press("Enter");
    await expect(decision.or(continueReady(page))).toBeVisible();
    if (await decision.isVisible()) {
      await expect(decision).toBeFocused();
      await tabTo(page, openChoice(page));
      await page.keyboard.press("Enter");
      await expect(decision).toBeHidden();
      await expect(heading).toBeFocused();
    }
  }
  expect(await ageNow()).toBeGreaterThanOrEqual(6);

  // The plan: one point from the first area that has one to Rest, with the arrow keys.
  await expect(region).toBeVisible();
  for (const name of ["Learn", "Earn", "Health", "Belonging"]) {
    const field = region.getByRole("textbox", { name });
    if ((await field.isEnabled()) && Number(await field.inputValue()) > 0) {
      await tabTo(page, field);
      await page.keyboard.press("ArrowDown");
      break;
    }
  }
  await expect(region.getByText(/1 point left to place/)).toBeVisible();
  const rest = region.getByRole("textbox", { name: "Rest" });
  const before = Number(await rest.inputValue());
  await tabTo(page, rest);
  await page.keyboard.press("ArrowUp");
  await expect(rest).toHaveValue(String(before + 1));

  // The side columns: on a phone the bar of parts comes first, and its arrow keys choose the part.
  if (isNarrow(page)) {
    const bar = page.getByRole("tablist", { name: "Parts of this screen" });
    await tabTo(page, bar.getByRole("tab", { name: "Story", exact: true }));
    await page.keyboard.press("ArrowRight");
    await expect(bar.getByRole("tab", { name: "You", exact: true })).toHaveAttribute("aria-selected", "true");
  }
  const you = page.getByRole("complementary", { name: "About you" });
  const tabs = you.getByRole("tablist");
  await tabTo(page, tabs.getByRole("tab", { name: "School & work", exact: true }));
  await page.keyboard.press("ArrowRight");
  const money = tabs.getByRole("tab", { name: "Money", exact: true });
  await expect(money).toBeFocused();
  await expect(money).toHaveAttribute("aria-selected", "true");
  await expect(you.getByRole("switch", { name: "Compare with US prices" })).toBeVisible();
  await page.keyboard.press("End");
  await expect(tabs.getByRole("tab", { name: "Health", exact: true })).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("Home");
  await expect(tabs.getByRole("tab", { name: "School & work", exact: true })).toHaveAttribute("aria-selected", "true");
  expect(errors).toEqual([]);
});

test("on a phone the bar of tabs shows one of Story, You and Around you at a time, without sideways scroll (UI-010)", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "phone", "The bar of tabs is only in the narrow layout");
  await fixedRandom(page, 20261024);
  await page.goto("./");
  await beginLife(page);

  const bar = page.getByRole("tablist", { name: "Parts of this screen" });
  // The story's own year heading; while another part is shown a visually hidden one stands in, so the page always has one (A11Y-006).
  const heading = page.locator("h1:not(.visually-hidden)");
  const standIn = page.getByRole("heading", { level: 1 });
  const you = page.getByRole("complementary", { name: "About you" });
  const around = page.getByRole("complementary", { name: "Around you" });
  const next = page.getByRole("button", { name: "Continue to the next year" });

  // The story is shown first; the bar sits at the bottom of the window and Continue stays in the header.
  await expect(bar.getByRole("tab", { name: "Story", exact: true })).toHaveAttribute("aria-selected", "true");
  await expect(heading).toBeVisible();
  await expect(you).toBeHidden();
  await expect(around).toBeHidden();
  const box = (await bar.boundingBox())!;
  expect(box.y + box.height).toBeGreaterThan(page.viewportSize()!.height - 2);
  await expect(next).toBeVisible();
  expect(await noHorizontalScroll(page)).toBe(true);

  await bar.getByRole("tab", { name: "You", exact: true }).click();
  await expect(you).toBeVisible();
  await expect(heading).toBeHidden();
  await expect(standIn).toHaveText("Age 0");
  await expect(around).toBeHidden();
  expect(await noHorizontalScroll(page)).toBe(true);

  await bar.getByRole("tab", { name: "Around you", exact: true }).click();
  await expect(around).toBeVisible();
  await expect(you).toBeHidden();
  await expect(heading).toBeHidden();
  await expect(standIn).toHaveCount(1);
  expect(await noHorizontalScroll(page)).toBe(true);

  // Continue goes back to the story, where the new year is told.
  await next.click();
  await expect(bar.getByRole("tab", { name: "Story", exact: true })).toHaveAttribute("aria-selected", "true");
  await expect(around).toBeHidden();
  expect(await noHorizontalScroll(page)).toBe(true);
});

test("the wide layout holds up in smaller windows: no sideways scroll, and the plan tray docks only where there is room (UI-010)", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name === "phone", "The wide layout is only for windows 900 px and up");
  await fixedRandom(page, 20261024);
  await page.goto("./");
  await beginLife(page);
  const heading = page.getByRole("heading", { level: 1 });
  const region = page.getByRole("region", { name: "Where your attention goes" });
  for (let step = 0; step < 14 && !(await region.isVisible()); step++) await liveStep(page);
  await expect(region).toBeVisible();

  // The tray is docked (sticky) in a big window, and an ordinary block in a small one.
  const position = () => region.evaluate((node) => getComputedStyle(node.parentElement!).position);
  for (const [width, height, docked] of [
    [1440, 900, true],
    [1301, 701, true],
    [1280, 700, false],
    [1101, 701, false],
    [1100, 700, false],
    [900, 600, false],
    [1280, 560, false],
  ] as const) {
    await page.setViewportSize({ width, height });
    await expect(heading).toBeVisible();
    expect(await noHorizontalScroll(page), `${width} x ${height}: the page scrolls sideways`).toBe(true);
    expect(await position(), `${width} x ${height}`).toBe(docked ? "sticky" : "static");
  }
});

test("the birth reveal: the reel is not announced, it fits at the width of the window, and it ends on the birth screen by itself on the country it showed (UI-016)", async ({
  page,
}) => {
  test.setTimeout(60_000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await fixedRandom(page, 20261026);
  await page.goto("./");
  await page.getByRole("button", { name: "Begin a life" }).click();

  // Skip takes focus and the reel is hidden from assistive technology; the one live message names no passing country.
  await expect(page.getByRole("button", { name: "Skip the reveal" })).toBeFocused();
  const reel = page.locator("[data-reel]");
  await expect(reel).toHaveAttribute("aria-hidden", "true");
  await expect(page.getByRole("status")).toHaveText(/Finding where you are born|You are born in/);
  const settled = (await page.locator("[data-settle]").textContent()) ?? "";
  expect(settled).not.toBe("");
  expect(await noHorizontalScroll(page)).toBe(true);

  // Left alone, it ends on the birth screen with no key pressed (no fixed sleeps: the timeout is only the longest it
  // may take), in the country the reel settled on.
  const heading = page.getByRole("heading", { level: 1 });
  await expect(heading).toContainText(`You are born in ${settled}`, { timeout: 20_000 });
  await expect(heading).toBeFocused();
  await expect(page.getByRole("button", { name: "Begin this life" })).toBeVisible();
  expect(errors).toEqual([]);
});

test("the birth reveal ends with Escape too, on the same country the life is lived in (UI-016)", async ({ page }) => {
  await fixedRandom(page, 20261027);
  await page.goto("./");
  await page.getByRole("button", { name: "Begin a life" }).click();
  const settled = (await page.locator("[data-settle]").textContent()) ?? "";
  await page.keyboard.press("Escape");
  const heading = page.getByRole("heading", { level: 1 });
  await expect(heading).toContainText(`You are born in ${settled}`);
  await expect(heading).toBeFocused();
});

test("under reduced motion there is no reel: the birth screen opens at once and says how the country was drawn (UI-016)", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("./");
  await page.getByRole("button", { name: "Begin a life" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("You are born in");
  await expect(page.getByRole("heading", { level: 1 })).toBeFocused();
  await expect(page.locator("[data-reel]")).toHaveCount(0);
  await expect(
    page.getByText("Where you are born is drawn by chance, weighted by where children are born each year."),
  ).toBeVisible();
  expect(await noHorizontalScroll(page)).toBe(true);
});

test("the plan hint shows once, is put away by keyboard, stays away after a reload and comes back from the settings (UI-015)", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await fixedRandom(page, 20261029);
  await page.goto("./");
  await beginLife(page);

  const heading = page.getByRole("heading", { level: 1 });
  const region = page.getByRole("region", { name: "Where your attention goes" });
  const hint = page.getByRole("note").filter({ hasText: "place a few points of attention" });
  const ageNow = async () => Number(/Age (\d+)/.exec((await heading.textContent()) ?? "")?.[1]);
  // A decision on the way puts the decision hint away by being answered; the next test looks at it.
  for (let step = 0; step < 14 && (await ageNow()) < 6; step++) await liveStep(page);
  await expect(region).toBeVisible();

  // The note is in the page, not over it, and nothing about it moves focus or scrolls sideways.
  await expect(hint).toBeVisible();
  expect(await noHorizontalScroll(page)).toBe(true);
  const gotIt = hint.getByRole("button", { name: "Got it" });
  await expect(gotIt).not.toBeFocused();
  await tabTo(page, gotIt);
  await page.keyboard.press("Enter");
  await expect(hint).toBeHidden();
  await expect(heading).toBeFocused();
  expect(await page.evaluate(() => localStorage.getItem("birthright:hints"))).toContain("plan");

  // After a reload the same life goes on without it.
  await page.reload();
  await page.getByRole("region", { name: "Continue your life" }).getByRole("button", { name: "Continue" }).click();
  await expect(region).toBeVisible();
  await expect(hint).toBeHidden();

  // The settings bring the hints back.
  await page.getByRole("button", { name: "Settings" }).click();
  await page.getByRole("dialog", { name: "Settings" }).getByRole("button", { name: "Back to start" }).click();
  await page.getByRole("button", { name: "Settings" }).click();
  await page.getByRole("button", { name: "Show the hints again" }).click();
  await expect(page.getByRole("button", { name: "Show the hints again" })).toBeFocused();
  await expect(page.getByRole("status").filter({ hasText: "The hints will show again." })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("birthright:hints"))).toBeNull();
  expect(errors).toEqual([]);
});

test("the decision and odds lens hints sit above the choices once, and are put away by keyboard (UI-015)", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await fixedRandom(page, 20261026);
  await page.goto("./");
  await beginLife(page);

  const decision = page.getByRole("heading", { level: 2, name: "A decision" });
  const hint = page.getByRole("note").filter({ hasText: "the year stops and asks you something" });
  const next = page.getByRole("button", { name: "Continue to the next year" });
  for (let step = 0; step < 60 && !(await decision.isVisible()); step++) {
    if (!(await next.isVisible())) break;
    await next.click();
    await expect(continueReady(page).or(decision)).toBeVisible();
  }
  await expect(decision).toBeVisible();

  // One note on the card, above the choices, that moves nothing sideways.
  await expect(hint).toBeVisible();
  expect(await noHorizontalScroll(page)).toBe(true);
  const choices = page.getByRole("list", { name: "Your choices" });
  const hintBox = await hint.boundingBox();
  const choicesBox = await choices.boundingBox();
  expect(hintBox && choicesBox && hintBox.y + hintBox.height <= choicesBox.y).toBe(true);
  // The odds line appears when some choice on the card has odds to show.
  const hasOdds = (await choices.getByText(/almost|about \d|\bin \d/).count()) > 0;
  if (hasOdds) await expect(hint).toContainText("put in words under it");
  else await expect(hint).not.toContainText("put in words under it");

  await tabTo(page, hint.getByRole("button", { name: "Got it" }));
  await page.keyboard.press("Enter");
  await expect(hint).toBeHidden();
  await expect(decision).toBeFocused();
  expect(await page.evaluate(() => localStorage.getItem("birthright:hints"))).toContain("decision");

  // After a reload the card is still waiting, and the note does not come back.
  await page.reload();
  await page.getByRole("region", { name: "Continue your life" }).getByRole("button", { name: "Continue" }).click();
  await expect(decision).toBeVisible();
  await expect(hint).toBeHidden();
  expect(errors).toEqual([]);
});
