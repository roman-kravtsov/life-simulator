// @vitest-environment jsdom
// The settings screen (UI-009) and the display preferences on it (A11Y-004, A11Y-005, UI-011). Everything here is
// SYNTHETIC.
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../../src/ui/App";
import { DisplaySettings } from "../../src/ui/DisplaySettings";
import { createDisplayStore, DEFAULT_DISPLAY, displayStore } from "../../src/ui/display";
import { createGameStore } from "../../src/ui/store";
import { makeCountry, testWorld } from "../fixtures/country";
import { fakePersistence, finishedLife, type Fake } from "./fakes";

const country = makeCountry({ region: "Western Africa" });

/** A display store of its own, on a page element that is not the document's. */
function detached() {
  localStorage.clear();
  const root = document.createElement("html");
  const store = createDisplayStore(
    () => root,
    () => localStorage,
  );
  return { root, store };
}

function openApp(fake: Fake = fakePersistence()) {
  const store = createGameStore(() => "settings-seed", testWorld(country), fake.persistence);
  store.init();
  render(<App store={store} />);
  return { store, user: userEvent.setup() };
}

async function openSettings(fake?: Fake) {
  const view = openApp(fake);
  await view.user.click(screen.getByRole("button", { name: "Settings" }));
  await screen.findByRole("heading", { level: 1, name: "Settings" });
  return view;
}

beforeEach(() => {
  localStorage.clear();
  displayStore.reset();
});

afterEach(() => {
  displayStore.reset();
  localStorage.clear();
});

describe("how it looks (UI-009, A11Y-004, A11Y-005)", () => {
  it("has a labelled choice of theme and of text size, each with a line that says what it does", () => {
    const { store } = detached();
    render(<DisplaySettings store={store} />);
    const section = screen.getByRole("region", { name: "How it looks" });
    const theme = within(section).getByRole("radiogroup", { name: "Theme" });
    expect(theme).toHaveAccessibleDescription(/this device/);
    expect(
      within(theme)
        .getAllByRole("radio")
        .map((radio) => radio.closest("label")?.textContent),
    ).toEqual(["System", "Light", "Dark"]);
    expect(within(theme).getByRole("radio", { name: "System" })).toBeChecked();
    const size = within(section).getByRole("radiogroup", { name: "Text size" });
    expect(size).toHaveAccessibleDescription(/browser/);
    expect(within(size).getAllByRole("radio")).toHaveLength(3);
    expect(within(size).getByRole("radio", { name: "Default" })).toBeChecked();
    const motion = within(section).getByRole("switch", { name: "Reduce motion" });
    expect(motion).not.toBeChecked();
    expect(motion).toHaveAccessibleDescription(/\S/);
  });

  it("changes the theme with the arrow keys and puts it on the page", async () => {
    const user = userEvent.setup();
    const { store, root } = detached();
    render(<DisplaySettings store={store} />);
    await user.tab();
    expect(screen.getByRole("radio", { name: "System" })).toHaveFocus();
    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("radio", { name: "Light" })).toBeChecked();
    expect(root.dataset.theme).toBe("light");
    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("radio", { name: "Dark" })).toBeChecked();
    expect(root.dataset.theme).toBe("dark");
    expect(localStorage.getItem("birthright:theme")).toBe("dark");
    await user.keyboard("{ArrowUp}{ArrowUp}");
    expect(root.dataset.theme).toBeUndefined();
    expect(store.getSnapshot().theme).toBe("system");
  });

  it("makes the text larger and largest, as an attribute on the page", async () => {
    const user = userEvent.setup();
    const { store, root } = detached();
    render(<DisplaySettings store={store} />);
    await user.tab();
    await user.tab();
    expect(screen.getByRole("radio", { name: "Default" })).toHaveFocus();
    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("radio", { name: "Larger" })).toBeChecked();
    expect(root.getAttribute("data-text-size")).toBe("large");
    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("radio", { name: "Largest" })).toBeChecked();
    expect(root.getAttribute("data-text-size")).toBe("larger");
  });

  it("holds back motion with a switch, and lets it go again", async () => {
    const user = userEvent.setup();
    const { store, root } = detached();
    render(<DisplaySettings store={store} />);
    await user.tab();
    await user.tab();
    await user.tab();
    const motion = screen.getByRole("switch", { name: "Reduce motion" });
    expect(motion).toHaveFocus();
    await user.keyboard(" ");
    expect(motion).toBeChecked();
    expect(root.getAttribute("data-motion")).toBe("reduced");
    await user.keyboard(" ");
    expect(motion).not.toBeChecked();
    // The system asks for nothing (jsdom has no matchMedia), so off is the default again.
    expect(root).not.toHaveAttribute("data-motion");
  });

  it("follows the system's motion preference while the page is open", () => {
    let reduces = false;
    const listeners = new Set<() => void>();
    vi.stubGlobal("matchMedia", () => ({
      get matches() {
        return reduces;
      },
      addEventListener: (_type: string, listener: () => void) => listeners.add(listener),
      removeEventListener: (_type: string, listener: () => void) => listeners.delete(listener),
    }));
    try {
      const { store } = detached();
      const { unmount } = render(<DisplaySettings store={store} />);
      const motion = screen.getByRole("switch", { name: "Reduce motion" });
      expect(motion).not.toBeChecked();
      act(() => {
        reduces = true;
        listeners.forEach((listener) => listener());
      });
      expect(motion).toBeChecked();
      unmount();
      expect(listeners.size).toBe(0);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("shows a choice made elsewhere, such as with the header's quick toggle", () => {
    const { store } = detached();
    render(<DisplaySettings store={store} />);
    store.set({ theme: "dark", textSize: "larger", motion: "reduced" });
    return waitFor(() => {
      expect(screen.getByRole("radio", { name: "Dark" })).toBeChecked();
      expect(screen.getByRole("radio", { name: "Largest" })).toBeChecked();
      expect(screen.getByRole("switch", { name: "Reduce motion" })).toBeChecked();
    });
  });

  it("uses the page's own display preferences by default", async () => {
    const user = userEvent.setup();
    render(<DisplaySettings />);
    await user.click(screen.getByRole("radio", { name: "Dark" }));
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(displayStore.getSnapshot().theme).toBe("dark");
  });
});

describe("the settings screen (UI-009)", () => {
  it("opens from the start screen with its heading in focus, and has three sections", async () => {
    await openSettings();
    expect(screen.getByRole("heading", { level: 1, name: "Settings" })).toHaveFocus();
    const main = within(screen.getByRole("main"));
    const play = main.getByRole("region", { name: "How you want to play" });
    expect(within(play).getByRole("switch", { name: "Softer telling" })).toBeInTheDocument();
    expect(within(play).getByRole("switch", { name: "Skip quiet years" })).toBeInTheDocument();
    expect(play).toHaveTextContent(/lives you begin from now/);
    expect(play).toHaveTextContent(/A life in progress keeps its own/);
    expect(main.getByRole("region", { name: "How it looks" })).toBeInTheDocument();
    // On the screen of their own the parts are sections under the h1.
    expect(main.getByRole("heading", { level: 2, name: "How you want to play" })).toBeInTheDocument();
    expect(main.getByRole("heading", { level: 2, name: "How it looks" })).toBeInTheDocument();
    const stored = main.getByRole("region", { name: "What is stored on this device" });
    expect(within(stored).getByRole("button", { name: "Delete all local data" })).toBeInTheDocument();
  });

  it("changes the settings for the next life", async () => {
    const { store, user } = await openSettings();
    await user.click(screen.getByRole("switch", { name: "Softer telling" }));
    expect(store.getSnapshot().settings.softening).toBe(true);
  });

  it("goes back to the start screen", async () => {
    const { store, user } = await openSettings();
    await user.click(screen.getByRole("button", { name: "Back" }));
    expect(store.getSnapshot().screen).toBe("start");
    expect(screen.getByRole("button", { name: "Begin a life" })).toBeInTheDocument();
  });

  it("is reached and left with the keyboard", async () => {
    const { user } = openApp();
    const settings = screen.getByRole("button", { name: "Settings" });
    for (let i = 0; i < 20 && document.activeElement !== settings; i++) await user.tab();
    expect(settings).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(await screen.findByRole("heading", { level: 1, name: "Settings" })).toHaveFocus();
    const back = screen.getByRole("button", { name: "Back" });
    for (let i = 0; i < 20 && document.activeElement !== back; i++) await user.tab();
    expect(back).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Birthright");
  });

  it("deletes all local data, display preferences too, and says so on the start screen", async () => {
    const { past } = finishedLife("kept-seed", country);
    const fake = fakePersistence({ status: "none" }, [past]);
    const { user } = await openSettings(fake);
    await user.click(screen.getByRole("radio", { name: "Dark" }));
    await user.click(screen.getByRole("radio", { name: "Largest" }));
    expect(document.documentElement.dataset).toMatchObject({ theme: "dark", textSize: "larger" });
    await user.click(screen.getByRole("button", { name: "Delete all local data" }));
    const dialog = screen.getByRole("alertdialog", { name: "Delete all local data?" });
    await user.click(within(dialog).getByRole("button", { name: "Delete everything" }));
    await waitFor(() => expect(fake.deleted).toBe(true));
    expect(
      await within(screen.getByRole("status")).findByText("All local data in this browser was deleted."),
    ).toBeInTheDocument();
    expect(displayStore.getSnapshot()).toEqual(DEFAULT_DISPLAY);
    expect(document.documentElement).not.toHaveAttribute("data-theme");
    expect(document.documentElement).not.toHaveAttribute("data-text-size");
  });

  it("resets the display preferences after deleting from the past lives screen too", async () => {
    const { past } = finishedLife("kept-seed", country);
    const fake = fakePersistence({ status: "none" }, [past]);
    displayStore.set({ theme: "dark", motion: "reduced" });
    const { user } = openApp(fake);
    await user.click(screen.getByRole("button", { name: "Past lives" }));
    await user.click(await screen.findByRole("button", { name: "Delete all local data" }));
    await user.click(screen.getByRole("button", { name: "Delete everything" }));
    await screen.findByRole("button", { name: "Begin a life" });
    await waitFor(() => expect(displayStore.getSnapshot()).toEqual(DEFAULT_DISPLAY));
    expect(document.documentElement).not.toHaveAttribute("data-motion");
  });

  it("says when deleting failed, and keeps the preferences", async () => {
    const fake = fakePersistence();
    fake.persistence.deleteAll = () => Promise.reject(new Error("blocked"));
    displayStore.set({ theme: "dark" });
    const { user } = await openSettings(fake);
    await user.click(screen.getByRole("button", { name: "Delete all local data" }));
    await user.click(screen.getByRole("button", { name: "Delete everything" }));
    // The files part has a status region of its own, so the one that says this is found among them.
    await waitFor(() =>
      expect(
        screen
          .getAllByRole("status")
          .some((region) => /Your local data could not be deleted/.test(region.textContent ?? "")),
      ).toBe(true),
    );
    expect(screen.getByRole("heading", { level: 1, name: "Settings" })).toBeInTheDocument();
    expect(displayStore.getSnapshot().theme).toBe("dark");
  });

  it("can delete from here while the past lives have not been looked at, as some may be stored", async () => {
    await openSettings();
    expect(screen.getByRole("button", { name: "Delete all local data" })).toBeEnabled();
    expect(screen.getByText("Removes everything this game keeps in your browser.")).toBeInTheDocument();
  });

  it("has nothing to delete when no life and no preference is stored", async () => {
    const { user } = openApp();
    await user.click(screen.getByRole("button", { name: "Past lives" }));
    await screen.findByText("No lives yet. When a life ends, it is kept here.");
    await user.click(screen.getByRole("button", { name: "Back to start" }));
    await user.click(screen.getByRole("button", { name: "Settings" }));
    expect(await screen.findByRole("button", { name: "Delete all local data" })).toBeDisabled();
    expect(screen.getByText("There is nothing stored yet.")).toBeInTheDocument();
    // A display preference is stored data too.
    await user.click(screen.getByRole("radio", { name: "Dark" }));
    expect(screen.getByRole("button", { name: "Delete all local data" })).toBeEnabled();
  });
});
