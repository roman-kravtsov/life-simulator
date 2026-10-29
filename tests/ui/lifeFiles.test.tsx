// @vitest-environment jsdom
// Lives as files (SAVE-006) on the settings and the past lives screens. Everything here is SYNTHETIC.
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { exportText, IMPORT_MAX_LENGTH, SCHEMA_VERSION, type SaveFile } from "../../src/engine/save";
import { App } from "../../src/ui/App";
import { displayStore } from "../../src/ui/display";
import { createGameStore } from "../../src/ui/store";
import { makeCountry, testWorld } from "../fixtures/country";
import { fakePersistence, finishedLife, playYears, type Fake } from "./fakes";

const country = makeCountry({ region: "Western Africa" });

/** The app on a browser that holds `fake`, with a download spy that keeps what it was given. */
function openApp(fake: Fake, world = testWorld(country), succeed = true) {
  displayStore.reset();
  const downloads: { fileName: string; text: string }[] = [];
  const store = createGameStore(() => "files-seed", world, fake.persistence);
  store.init();
  render(
    <App
      store={store}
      save={(fileName, text) => {
        downloads.push({ fileName, text });
        return succeed;
      }}
    />,
  );
  return { store, downloads, user: userEvent.setup() };
}

/** A browser holding a life in progress, and the file that life exports to. */
async function livingBrowser(seed: string, years = 5) {
  const fake = fakePersistence();
  const store = createGameStore(() => seed, testWorld(country), fake.persistence);
  store.init();
  store.setSettings({ pace: "every-year" });
  await store.begin();
  store.startLife();
  playYears(store, years);
  const exported = store.exportCurrent()!;
  return { fake, life: store.getSnapshot().life!, text: exported.text, fileName: exported.fileName };
}

const fileInput = () => document.querySelector("input[type=file]") as HTMLInputElement;
const upload = (user: ReturnType<typeof userEvent.setup>, text: string, name = "life.json") =>
  user.upload(fileInput(), new File([text], name, { type: "application/json" }));

async function openSettings(view: ReturnType<typeof openApp>) {
  await view.user.click(screen.getByRole("button", { name: "Settings" }));
  await screen.findByRole("heading", { level: 1, name: "Settings" });
}

async function openPast(view: ReturnType<typeof openApp>) {
  await view.user.click(screen.getByRole("button", { name: "Past lives" }));
  await screen.findByRole("heading", { level: 1, name: "Past lives" });
}

describe("SAVE-006: the settings screen", () => {
  it("explains what a file holds, and has the save button off, with the reason, when no life is in progress", async () => {
    const view = openApp(fakePersistence());
    await openSettings(view);
    expect(screen.getByText(/never sent anywhere/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save the life in progress to a file" })).toBeDisabled();
    expect(screen.getByText("There is no life in progress to save.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Load a life from a file" })).toBeEnabled();
  });

  it("saves the life in progress to a file named for its seed, and says so", async () => {
    const { fake, fileName } = await livingBrowser("river-1");
    const view = openApp(fake);
    await openSettings(view);
    await view.user.click(screen.getByRole("button", { name: "Save the life in progress to a file" }));
    expect(view.downloads).toHaveLength(1);
    expect(view.downloads[0]!.fileName).toBe(fileName);
    expect((JSON.parse(view.downloads[0]!.text) as SaveFile).seed).toBe("river-1");
    expect(screen.getByText(`Saved as ${fileName}.`)).toBeInTheDocument();
  });

  it("says when the browser would not save the file", async () => {
    const { fake } = await livingBrowser("river-2");
    const view = openApp(fake, testWorld(country), false);
    await openSettings(view);
    await view.user.click(screen.getByRole("button", { name: "Save the life in progress to a file" }));
    expect(screen.getByText("Your browser would not save the file.")).toBeInTheDocument();
  });

  it("loads a life in progress into a clean browser, which then offers to continue it", async () => {
    const { text, life } = await livingBrowser("river-3", 7);
    const clean = fakePersistence();
    const view = openApp(clean);
    await openSettings(view);
    await upload(view.user, text);
    expect(
      await screen.findByText(
        `${life.person.name}, ${life.person.age}, is now the life you can continue from the start screen.`,
      ),
    ).toBeInTheDocument();
    // The save button now has a life to save.
    expect(screen.getByRole("button", { name: "Save the life in progress to a file" })).toBeEnabled();
    await view.user.click(screen.getByRole("button", { name: "Back" }));
    const card = screen.getByRole("region", { name: "Continue your life" });
    expect(await within(card).findByText(`${life.person.name}, ${life.person.age}, in Testland`)).toBeInTheDocument();
    await view.user.click(within(card).getByRole("button", { name: "Continue" }));
    expect(
      await screen.findByRole("heading", { level: 1, name: new RegExp(`^Age ${life.person.age}`) }),
    ).toBeInTheDocument();
  });

  it("adds that the life was saved with other data or an older game when it was", async () => {
    const { text } = await livingBrowser("river-4");
    const older = JSON.stringify({ ...(JSON.parse(text) as SaveFile), contentVersion: "older" });
    const view = openApp(fakePersistence());
    await openSettings(view);
    await upload(view.user, older);
    expect(await screen.findByText(/It was saved with other data or an older version of the game/)).toBeInTheDocument();
  });

  it("asks before replacing a life in progress: keeping it changes nothing, by keyboard", async () => {
    const { text } = await livingBrowser("incoming-1");
    const { fake } = await livingBrowser("mine-1", 3);
    const before = fake.saved.length;
    const view = openApp(fake);
    await openSettings(view);
    await upload(view.user, text);
    const dialog = await screen.findByRole("alertdialog", { name: "Replace the life in progress?" });
    expect(dialog).toHaveAccessibleDescription(
      /replaces it, and it cannot be brought back unless you have saved it to a file/,
    );
    expect(within(dialog).getByRole("button", { name: "Keep mine" })).toHaveFocus();
    await view.user.keyboard("{Enter}");
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(fake.saved).toHaveLength(before);
    expect(screen.queryByText(/is now the life you can continue/)).not.toBeInTheDocument();
  });

  it("replaces the life in progress when the player says so, by keyboard", async () => {
    const { text, life } = await livingBrowser("incoming-2", 6);
    const { fake } = await livingBrowser("mine-2", 3);
    const view = openApp(fake);
    await openSettings(view);
    await upload(view.user, text);
    await screen.findByRole("alertdialog", { name: "Replace the life in progress?" });
    await view.user.keyboard("{Tab}{Enter}");
    expect(
      await screen.findByText(new RegExp(`^${life.person.name}, ${life.person.age}, is now the life`)),
    ).toBeInTheDocument();
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(fake.saved.at(-1)?.seed).toBe("incoming-2");
  });

  it.each([
    ["not json", "That file could not be read as a life. It should be the .json file this game saved."],
    ["[]", "That file is not a life this game can read. It may be damaged, or it may not be from this game."],
    [" ".repeat(IMPORT_MAX_LENGTH + 1), "That file is too big to be a life."],
  ])("says why a file of %.12s… is not a life, and keeps nothing", async (text, words) => {
    const fake = fakePersistence();
    const view = openApp(fake);
    await openSettings(view);
    await upload(view.user, text);
    expect(await screen.findByText(words)).toBeInTheDocument();
    expect(fake.saved).toHaveLength(0);
    expect(fake.puts).toHaveLength(0);
  });

  it("turns down a file far too big to be a life without reading it", async () => {
    const view = openApp(fakePersistence());
    await openSettings(view);
    const big = new File(["{}"], "big.json", { type: "application/json" });
    Object.defineProperty(big, "size", { value: 9_000_000 });
    big.text = () => Promise.reject(new Error("must not be read"));
    await view.user.upload(fileInput(), big);
    expect(await screen.findByText("That file is too big to be a life.")).toBeInTheDocument();
  });

  it("says when a life is from a newer game, from an unknown country and when the browser will not keep it", async () => {
    const { text } = await livingBrowser("river-5");
    const file = JSON.parse(text) as SaveFile;
    const view = openApp(fakePersistence());
    await openSettings(view);
    await upload(view.user, JSON.stringify({ ...file, schemaVersion: SCHEMA_VERSION + 1 }));
    expect(await screen.findByText(/saved by a newer version of the game/)).toBeInTheDocument();
    await upload(view.user, JSON.stringify({ ...file, countryIso3: "ZZZ" }));
    expect(await screen.findByText(/no data for the country that life was lived in/)).toBeInTheDocument();
    const refusing = fakePersistence();
    refusing.refuseCurrent = true;
    cleanup();
    const second = openApp(refusing);
    await openSettings(second);
    await upload(second.user, text);
    expect(await screen.findByText(/Your browser would not keep the life/)).toBeInTheDocument();
  });
});

describe("SAVE-006: the past lives screen", () => {
  it("saves a finished life to a file from its card, and says so", async () => {
    const { past } = finishedLife("done-1", country, "Kept bees");
    const view = openApp(fakePersistence({ status: "none" }, [past]));
    await openPast(view);
    await view.user.click(
      await screen.findByRole("button", { name: `Save to file: the life of ${past.summary.name}` }),
    );
    await waitFor(() => expect(view.downloads).toHaveLength(1));
    expect(view.downloads[0]!.fileName).toBe("birthright-done-1.json");
    expect(JSON.parse(view.downloads[0]!.text)).toEqual(JSON.parse(exportText(past.save)));
    expect(
      await screen.findByText(`The life of ${past.summary.name} was saved as birthright-done-1.json.`),
    ).toBeInTheDocument();
  });

  it("says when the file could not be made", async () => {
    const { past } = finishedLife("done-2", country);
    const view = openApp(fakePersistence({ status: "none" }, [past]), testWorld(country), false);
    await openPast(view);
    await view.user.click(
      await screen.findByRole("button", { name: `Save to file: the life of ${past.summary.name}` }),
    );
    expect(await screen.findByText("Your browser would not save the file.")).toBeInTheDocument();
  });

  it("loads a finished life into the list, and says when it was there already", async () => {
    const { past, life } = finishedLife("done-3", country, "Kept bees");
    const text = exportText(past.save);
    const view = openApp(fakePersistence());
    await openPast(view);
    expect(await screen.findByText(/No lives yet/)).toBeInTheDocument();
    await upload(view.user, text);
    expect(
      await screen.findByText(
        new RegExp(`^${life.person.name}'s life, lived to ${life.person.age}, is in your past lives\\.`),
      ),
    ).toBeInTheDocument();
    expect(await screen.findByRole("heading", { level: 2, name: life.person.name })).toBeInTheDocument();
    await upload(view.user, text);
    expect(
      await screen.findByText(
        new RegExp(
          `^${life.person.name}'s life was already in your past lives, and the copy here is as new as the file\\.`,
        ),
      ),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("heading", { level: 2, name: life.person.name })).toHaveLength(1);
  });

  it("asks before a life in progress is replaced, here too", async () => {
    const { text } = await livingBrowser("incoming-3");
    const { fake } = await livingBrowser("mine-3", 3);
    const view = openApp(fake);
    await openPast(view);
    await upload(view.user, text);
    expect(await screen.findByRole("alertdialog", { name: "Replace the life in progress?" })).toBeInTheDocument();
    await view.user.keyboard("{Escape}");
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(fake.saved.at(-1)?.seed).toBe("mine-3");
  });
});

vi.setConfig({ testTimeout: 15000 });
