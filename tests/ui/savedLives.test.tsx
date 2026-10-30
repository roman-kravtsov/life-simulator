// @vitest-environment jsdom
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { App } from "../../src/ui/App";
import { LifeScreen } from "../../src/ui/LifeScreen";
import { createGameStore } from "../../src/ui/store";
import { makeCountry, testWorld } from "../fixtures/country";
import { fakePersistence, finishedLife, playYears, type Fake } from "./fakes";
import { backToStart, lifeScreenProps, skipReveal } from "./helpers";

const country = makeCountry({ region: "Western Africa" });
const clock = () => "2026-10-25T10:00:00.000Z";

const open = (fake: Fake, world = testWorld(country)) => {
  const store = createGameStore(() => "new-seed", world, fake.persistence, clock);
  store.init();
  render(<App store={store} />);
  return { store, user: userEvent.setup() };
};

/** A browser that holds a life saved after `years` years. */
const savedAfter = async (years: number) => {
  const fake = fakePersistence();
  const store = createGameStore(() => "saved-seed", testWorld(country), fake.persistence, clock);
  store.setSettings({ pace: "every-year" });
  await store.begin();
  store.startLife();
  playYears(store, years);
  return { fake, life: store.getSnapshot().life! };
};

describe("SAVE-002: continuing a life from the start screen", () => {
  it("offers the life in progress by name, age and place, and says a new life replaces it", async () => {
    const { fake, life } = await savedAfter(3);
    open(fake);
    const card = screen.getByRole("region", { name: "Continue your life" });
    // Until the index is read the place is not known, so the line is the name and the age.
    expect(within(card).getByText(`${life.person.name}, ${life.person.age}`)).toBeInTheDocument();
    expect(await within(card).findByText(`${life.person.name}, ${life.person.age}, in Testland`)).toBeInTheDocument();
    expect(within(card).getByText("Beginning a new life replaces this one.")).toBeInTheDocument();
  });

  it("goes back into the life at the same age, with focus on the heading", async () => {
    const { fake, life } = await savedAfter(4);
    const { user } = open(fake);
    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(await screen.findByRole("heading", { level: 1, name: new RegExp(`^Age ${life.person.age}`) })).toHaveFocus();
    // The same decision is waiting if one was.
    expect(Boolean(screen.queryByRole("heading", { level: 2, name: "A decision" }))).toBe(life.turn !== undefined);
  });

  it("does not offer a card when nothing is saved", () => {
    open(fakePersistence());
    expect(screen.queryByRole("region", { name: "Continue your life" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Begin a life" })).toBeInTheDocument();
  });

  it("is offered again after going back to the start from a life in progress", async () => {
    const { user } = open(fakePersistence());
    await user.click(screen.getByRole("button", { name: "Begin a life" }));
    await skipReveal(user);
    await user.click(await screen.findByRole("button", { name: "Begin this life" }));
    await backToStart(user);
    expect(screen.getByRole("region", { name: "Continue your life" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Continue" }));
    // A life with no years yet resumes at its birth.
    expect(await screen.findByRole("button", { name: "Begin this life" })).toBeInTheDocument();
  });

  it("is offered after going back from the birth screen, where the life is already saved", async () => {
    const { user } = open(fakePersistence());
    await user.click(screen.getByRole("button", { name: "Begin a life" }));
    await skipReveal(user);
    await screen.findByRole("button", { name: "Begin this life" });
    await user.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Birthright");
    expect(screen.getByRole("region", { name: "Continue your life" })).toBeInTheDocument();
  });

  it("is reached by keyboard before the button that begins a new life", async () => {
    const { fake } = await savedAfter(2);
    const { user } = open(fake);
    const keep = screen.getByRole("button", { name: "Continue" });
    for (let i = 0; i < 8 && document.activeElement !== keep; i++) await user.tab();
    expect(keep).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(await screen.findByRole("heading", { level: 1, name: /^Age \d+/ })).toBeInTheDocument();
  });

  describe.each([
    [
      "unsupported",
      { schemaVersion: 99 },
      "A saved life could not be opened: it was made by a newer version of the game.",
    ],
    ["damaged", { seed: undefined }, "A saved life could not be opened: its file is damaged."],
  ])("a saved life that is %s", (_, change, message) => {
    it("is said calmly, with a way to discard it", async () => {
      const { fake } = await savedAfter(1);
      const raw = fake.current.status === "found" ? (fake.current.raw as object) : {};
      fake.current = { status: "found", raw: { ...raw, ...change } };
      const { user } = open(fake);
      expect(screen.getByText(message)).toHaveAttribute("role", "note");
      expect(screen.queryByRole("button", { name: "Continue" })).not.toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: "Discard it" }));
      expect(screen.queryByText(message)).not.toBeInTheDocument();
      expect(fake.current).toEqual({ status: "none" });
    });
  });

  it("says when this browser would not let the game read the saved life", () => {
    open(fakePersistence({ status: "unreadable" }));
    expect(
      screen.getByText("A saved life could not be opened: this browser would not let the game read it."),
    ).toBeInTheDocument();
  });

  it("opens the past lives from the start screen", async () => {
    const { user } = open(fakePersistence());
    await user.click(screen.getByRole("button", { name: "Past lives" }));
    expect(await screen.findByRole("heading", { level: 1, name: "Past lives" })).toBeInTheDocument();
  });
});

describe("SAVE-005, RNG-004: notes on a resumed life", () => {
  it("says the life was rebuilt from its seed, once", async () => {
    const { fake } = await savedAfter(3);
    const raw = fake.current.status === "found" ? (fake.current.raw as object) : {};
    fake.current = { status: "found", raw: { ...raw, snapshot: { broken: true } } };
    const { user } = open(fake);
    await user.click(screen.getByRole("button", { name: "Continue" }));
    const note = await screen.findByText("Your life was rebuilt from its seed after the saved copy could not be read.");
    expect(note).toHaveAttribute("role", "note");
    await user.click(screen.getByRole("button", { name: "Continue to the next year" }));
    await waitFor(() => expect(screen.queryByText(/rebuilt from its seed/)).not.toBeInTheDocument());
  });

  it("says the game was updated when the data of the save is older", async () => {
    const { fake } = await savedAfter(2);
    const world = testWorld(country);
    const { user } = open(fake, {
      ...world,
      loadIndex: async () => ({ ...(await world.loadIndex()), dataVersion: "newer" }),
    });
    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(
      await screen.findByText(
        "The game has been updated since this life was saved, so it may play out a little differently from here.",
      ),
    ).toBeInTheDocument();
  });

  it("says both when the saved copy could not be read and the game has been updated", async () => {
    const { fake } = await savedAfter(3);
    const raw = fake.current.status === "found" ? (fake.current.raw as object) : {};
    fake.current = { status: "found", raw: { ...raw, snapshot: { broken: true } } };
    const world = testWorld(country);
    const { user } = open(fake, {
      ...world,
      loadIndex: async () => ({ ...(await world.loadIndex()), dataVersion: "newer" }),
    });
    await user.click(screen.getByRole("button", { name: "Continue" }));
    const note = await screen.findByText(
      /could not be read, so it was rebuilt from its seed\. The game has also been updated/,
    );
    expect(note).toHaveAttribute("role", "note");
  });

  it("says nothing when the saved copy was used as it was", async () => {
    const { fake } = await savedAfter(2);
    const { user } = open(fake);
    await user.click(screen.getByRole("button", { name: "Continue" }));
    await screen.findByRole("heading", { level: 1, name: /^Age/ });
    expect(screen.queryByText(/rebuilt|has been updated/)).not.toBeInTheDocument();
  });
});

describe("SAVE-001: a life the browser would not keep", () => {
  it("says so on the life screen, in a polite region that is there before the words arrive", () => {
    const { rerender, container } = render(<LifeScreen {...lifeScreenProps(country)} />);
    const live = container.querySelector("[aria-live='polite']")!;
    expect(live).toBeEmptyDOMElement();
    rerender(<LifeScreen {...lifeScreenProps(country, { problem: "current" })} />);
    expect(live).toHaveTextContent(
      "This life could not be saved in your browser. If you close this tab, it will be lost.",
    );
    expect(within(live as HTMLElement).getByRole("note")).toBeInTheDocument();
  });

  it("does not mention the archive on the life screen", () => {
    render(<LifeScreen {...lifeScreenProps(country, { problem: "archive" })} />);
    expect(screen.queryByText(/could not be saved/)).not.toBeInTheDocument();
  });

  it("is said in play when the browser refuses a save", async () => {
    const fake = fakePersistence();
    fake.refuseCurrent = true;
    const { user } = open(fake);
    await user.click(screen.getByRole("button", { name: "Begin a life" }));
    await skipReveal(user);
    await user.click(await screen.findByRole("button", { name: "Begin this life" }));
    expect(screen.getByText(/This life could not be saved in your browser/)).toBeInTheDocument();
    fake.refuseCurrent = false;
    await user.click(screen.getByRole("button", { name: "Continue to the next year" }));
    expect(screen.queryByText(/This life could not be saved in your browser/)).not.toBeInTheDocument();
  });
});

describe("SAVE-003, SAVE-007: the past lives", () => {
  const lives = () => [
    finishedLife("older-life", country, undefined, "2026-10-20T10:00:00.000Z").past,
    finishedLife("newer-life", country, "Walked far.", "2026-10-22T10:00:00.000Z").past,
  ];
  const openPast = async (fake: Fake) => {
    const view = open(fake);
    await view.user.click(screen.getByRole("button", { name: "Past lives" }));
    await screen.findByRole("heading", { level: 1, name: "Past lives" });
    return view;
  };

  it("lists the lives, the newest first, with name, place, age, cause and date", async () => {
    const [older, newer] = lives();
    await openPast(fakePersistence({ status: "none" }, [older!, newer!]));
    expect(screen.getByRole("heading", { level: 1 })).toHaveFocus();
    const items = await screen.findAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(within(items[0]!).getByRole("heading", { level: 2 })).toHaveTextContent(newer!.summary.name);
    expect(within(items[1]!).getByRole("heading", { level: 2 })).toHaveTextContent(older!.summary.name);
    expect(items[0]).toHaveTextContent(
      new RegExp(`Born ${newer!.summary.birthYear} in Testland\\. Died at ${newer!.summary.death.age}, of `),
    );
    expect(items[0]).toHaveTextContent("Walked far.");
    expect(items[0]).toHaveTextContent(/Finished October 2[0-9], 2026/);
    expect(items[1]).not.toHaveTextContent("Walked far.");
  });

  it("shows each life's growth rings as a small picture that a screen reader skips (UI-008)", async () => {
    const [older, newer] = lives();
    await openPast(fakePersistence({ status: "none" }, [older!, newer!]));
    const items = await screen.findAllByRole("listitem");
    for (const [item, life] of [
      [items[0]!, newer!],
      [items[1]!, older!],
    ] as const) {
      const pictures = item.querySelectorAll("svg");
      expect(pictures).toHaveLength(1);
      expect(pictures[0]).toHaveAttribute("aria-hidden", "true");
      // One circle a ring, the oldest innermost.
      expect(pictures[0]!.querySelectorAll("circle")).toHaveLength(life.summary.rings.length);
      expect(life.summary.rings.length).toBeGreaterThan(0);
      // The picture comes before the name, and the name stays the item's heading.
      const name = within(item).getByRole("heading", { level: 2 });
      expect(pictures[0]!.compareDocumentPosition(name) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }
  });

  it("opens a life as its summary, and Past lives leads back to the list", async () => {
    const [older, newer] = lives();
    const { user } = await openPast(fakePersistence({ status: "none" }, [older!, newer!]));
    await user.click(await screen.findByRole("button", { name: `Open the life of ${older!.summary.name}` }));
    const heading = await screen.findByRole("heading", { level: 1, name: new RegExp(older!.summary.name) });
    expect(heading).toHaveFocus();
    expect(
      screen.getByText(`The seed of this life is older-life. It is what the game used to draw this birth.`),
    ).toBeInTheDocument();
    // A life from the archive can be kept as text or a picture like one just finished (SHARE-001, SHARE-002).
    expect(screen.getByRole("region", { name: "Keep this life" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Past lives" }));
    expect(await screen.findAllByRole("listitem")).toHaveLength(2);
  });

  it("writes an epitaph on an opened life, which the list then shows", async () => {
    const [older] = lives();
    const fake = fakePersistence({ status: "none" }, [older!]);
    const { user } = await openPast(fake);
    await user.click(await screen.findByRole("button", { name: /^Open the life of/ }));
    await user.type(await screen.findByRole("textbox", { name: /A few words for/ }), "Sang at dawn.");
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(fake.lives.get("older-life")!.summary.epitaph).toBe("Sang at dawn."));
    await user.click(screen.getByRole("button", { name: "Past lives" }));
    expect(await screen.findByText("Sang at dawn.")).toBeInTheDocument();
  });

  it("asks before deleting a life, and keeps it when the answer is no", async () => {
    const [older, newer] = lives();
    const fake = fakePersistence({ status: "none" }, [older!, newer!]);
    const { user } = await openPast(fake);
    const name = older!.summary.name;
    await user.click(await screen.findByRole("button", { name: `Delete the life of ${name}` }));
    const dialog = screen.getByRole("alertdialog", { name: `Delete the life of ${name}?` });
    expect(dialog).toHaveTextContent("This life will be removed from this browser. It cannot be undone.");
    expect(within(dialog).getByRole("button", { name: "Keep it" })).toHaveFocus();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(fake.lives.size).toBe(2);
    await user.click(screen.getByRole("button", { name: `Delete the life of ${name}` }));
    await user.click(screen.getByRole("button", { name: "Keep it" }));
    expect(fake.lives.size).toBe(2);
  });

  it("deletes a life once confirmed, and puts focus on the heading", async () => {
    const [older, newer] = lives();
    const fake = fakePersistence({ status: "none" }, [older!, newer!]);
    const { user } = await openPast(fake);
    await user.click(await screen.findByRole("button", { name: `Delete the life of ${older!.summary.name}` }));
    await user.click(screen.getByRole("button", { name: "Delete this life" }));
    await waitFor(() => expect(screen.getAllByRole("listitem")).toHaveLength(1));
    expect(fake.lives.has("older-life")).toBe(false);
    expect(fake.lives.has("newer-life")).toBe(true);
    await waitFor(() => expect(screen.getByRole("heading", { level: 1 })).toHaveFocus());
  });

  it("says a life was deleted in a status region that was on the page before", async () => {
    const [older, newer] = lives();
    const fake = fakePersistence({ status: "none" }, [older!, newer!]);
    const { user } = await openPast(fake);
    const status = await screen.findByRole("status");
    expect(status).toBeEmptyDOMElement();
    await user.click(screen.getByRole("button", { name: `Delete the life of ${older!.summary.name}` }));
    await user.click(screen.getByRole("button", { name: "Delete this life" }));
    await waitFor(() => expect(screen.getByRole("status")).toBe(status));
    expect(await within(status).findByText(`The life of ${older!.summary.name} was deleted.`)).toBeInTheDocument();
  });

  it("says a life could not be deleted, in the status region, and does not say it was deleted", async () => {
    const [older, newer] = lives();
    const fake = fakePersistence({ status: "none" }, [older!, newer!]);
    const { user } = await openPast(fake);
    fake.persistence.archive.remove = () => Promise.reject(new Error("blocked"));
    const status = await screen.findByRole("status");
    const name = older!.summary.name;
    await user.click(screen.getByRole("button", { name: `Delete the life of ${name}` }));
    await user.click(screen.getByRole("button", { name: "Delete this life" }));
    expect(
      await within(status).findByText(`The life of ${name} could not be deleted.`, { exact: false }),
    ).toBeVisible();
    expect(within(status).getByText(/Some lives could not be saved to or read from/)).toBeInTheDocument();
    expect(screen.getByRole("status")).toBe(status);
    expect(screen.queryByText(`The life of ${name} was deleted.`)).not.toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
  });

  it("says the failure again, as a new node, when a second delete also fails", async () => {
    const [older] = lives();
    const fake = fakePersistence({ status: "none" }, [older!]);
    const { user } = await openPast(fake);
    fake.persistence.archive.remove = () => Promise.reject(new Error("blocked"));
    const status = await screen.findByRole("status");
    const attempt = async () => {
      await user.click(screen.getByRole("button", { name: `Delete the life of ${older!.summary.name}` }));
      await user.click(screen.getByRole("button", { name: "Delete this life" }));
      return within(status).findByText(/could not be deleted\./);
    };
    const first = await attempt();
    const second = await attempt();
    expect(second).not.toBe(first);
  });

  it("lets the deleted notice go when the player moves on", async () => {
    const [older, newer] = lives();
    const fake = fakePersistence({ status: "none" }, [older!, newer!]);
    const { user } = await openPast(fake);
    await user.click(screen.getByRole("button", { name: `Delete the life of ${older!.summary.name}` }));
    await user.click(screen.getByRole("button", { name: "Delete this life" }));
    expect(await screen.findByText(`The life of ${older!.summary.name} was deleted.`)).toBeInTheDocument();
    await user.tab();
    expect(screen.queryByText(`The life of ${older!.summary.name} was deleted.`)).not.toBeInTheDocument();
  });

  it("says deleting all local data failed, in the status region, and stays on the list", async () => {
    const [older] = lives();
    const fake = fakePersistence({ status: "none" }, [older!]);
    fake.persistence.deleteAll = () => Promise.reject(new Error("blocked"));
    const { user } = await openPast(fake);
    const status = await screen.findByRole("status");
    await user.click(await screen.findByRole("button", { name: "Delete all local data" }));
    await user.click(screen.getByRole("button", { name: "Delete everything" }));
    expect(await within(status).findByText(/Your local data could not be deleted\./)).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "Past lives" })).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
  });

  it("says that all local data was deleted in the start screen's status region, which is there before the words", async () => {
    const [older] = lives();
    const fake = fakePersistence({ status: "none" }, [older!]);
    const { user } = await openPast(fake);
    await user.click(await screen.findByRole("button", { name: "Delete all local data" }));
    await user.click(screen.getByRole("button", { name: "Delete everything" }));
    const begin = await screen.findByRole("button", { name: "Begin a life" });
    expect(begin).toBeInTheDocument();
    const status = screen.getByRole("status");
    expect(await within(status).findByText("All local data in this browser was deleted.")).toBeInTheDocument();
    // The words are not there on the first render, so the region is announced as it fills.
    await user.click(screen.getByRole("button", { name: "Past lives" }));
    await user.click(await screen.findByRole("button", { name: "Back to start" }));
    expect(screen.queryByText("All local data in this browser was deleted.")).not.toBeInTheDocument();
  });

  it("says plainly what deleting all local data removes, and does it once confirmed (SAVE-007)", async () => {
    const [older, newer] = lives();
    const fake = fakePersistence({ status: "none" }, [older!, newer!]);
    const { user, store } = await openPast(fake);
    await user.click(await screen.findByRole("button", { name: "Delete all local data" }));
    const dialog = screen.getByRole("alertdialog", { name: "Delete all local data?" });
    expect(dialog).toHaveTextContent(/every past life, the life in progress and the choices you made here/);
    expect(dialog).toHaveTextContent(/cannot be undone/);
    await user.click(within(dialog).getByRole("button", { name: "Delete everything" }));
    await waitFor(() => expect(fake.deleted).toBe(true));
    expect(fake.lives.size).toBe(0);
    expect(await screen.findByRole("button", { name: "Begin a life" })).toBeInTheDocument();
    expect(store.getSnapshot()).toMatchObject({ screen: "start", resume: null, pastLives: [] });
    await user.click(screen.getByRole("button", { name: "Past lives" }));
    expect(await screen.findByText("No lives yet. When a life ends, it is kept here.")).toBeInTheDocument();
  });

  it("shows an empty state, and has nothing to delete", async () => {
    await openPast(fakePersistence());
    expect(await screen.findByText("No lives yet. When a life ends, it is kept here.")).toBeInTheDocument();
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete all local data" })).toBeDisabled();
    expect(screen.getByText("There is nothing stored yet.")).toBeInTheDocument();
  });

  it("can delete all data when only a life in progress is stored", async () => {
    const { fake } = await savedAfter(1);
    await openPast(fake);
    expect(await screen.findByRole("button", { name: "Delete all local data" })).toBeEnabled();
  });

  it("says when the archive could not be read", async () => {
    const fake = fakePersistence();
    fake.failArchive = true;
    await openPast(fake);
    expect(
      await screen.findByText(/Some lives could not be saved to or read from this browser's storage/),
    ).toHaveAttribute("role", "note");
  });

  it("goes back to the start", async () => {
    const { user } = await openPast(fakePersistence());
    await user.click(screen.getByRole("button", { name: "Back to start" }));
    expect(screen.getByRole("button", { name: "Begin a life" })).toBeInTheDocument();
  });

  it("is played with the keyboard: tab to Open, Enter opens", async () => {
    const [older] = lives();
    const { user } = await openPast(fakePersistence({ status: "none" }, [older!]));
    const button = await screen.findByRole("button", { name: /^Open the life of/ });
    for (let i = 0; i < 8 && document.activeElement !== button; i++) await user.tab();
    expect(button).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(await screen.findByRole("heading", { level: 1, name: new RegExp(older!.summary.name) })).toBeInTheDocument();
  });
});
