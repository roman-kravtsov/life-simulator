// App shell (UI-001): one screen at a time, rendered into <main>.
import { advance, newLife } from "../engine/life";
import type { LifeState, StatId } from "../engine/types";
import { t } from "../i18n";
import { h } from "./dom";
import { toggleTheme } from "./theme";

const STATS: readonly StatId[] = ["health", "wellbeing", "bonds", "skills"];

export function startApp(root: HTMLElement): void {
  const show = (screen: HTMLElement) => {
    root.replaceChildren(screen);
    // Move focus to the new screen's heading so keyboard and screen-reader users follow along.
    screen.querySelector<HTMLElement>("h1, h2")?.focus();
  };

  const header = () =>
    h(
      "header",
      { class: "site-header" },
      h("span", { class: "wordmark" }, t("app.title")),
      themeButton(),
    );

  const startScreen = (): HTMLElement =>
    h(
      "section",
      { class: "screen start" },
      header(),
      h("h1", { tabindex: "-1" }, t("app.title"), h("span", { class: "subtitle" }, t("app.subtitle"))),
      h("p", { class: "lead" }, t("start.intro")),
      h("p", { class: "note", role: "note" }, t("start.contentNote")),
      h("button", { class: "primary", type: "button", onclick: () => show(lifeScreen(beginLife())) }, t("start.begin")),
      h("p", { class: "small" }, t("start.privacy")),
      h("p", { class: "small" }, t("start.preview")),
    );

  const lifeScreen = (state: LifeState): HTMLElement => {
    const { person } = state;
    const last = state.history.at(-1);
    const story = last
      ? last.stageChanged
        ? t("life.stageReached", { stage: t(`life.stage.${last.stage}`) })
        : t("life.yearPassed", { age: last.age })
      : "";

    return h(
      "section",
      { class: "screen life" },
      header(),
      h(
        "h1",
        { tabindex: "-1" },
        t("life.age", { age: person.age }),
        h("span", { class: "subtitle" }, t(`life.stage.${person.stage}`)),
      ),
      h(
        "dl",
        { class: "stats" },
        ...STATS.flatMap((id) => [
          h("dt", {}, t(`life.stat.${id}`)),
          h(
            "dd",
            {},
            h("meter", { min: "0", max: "100", value: String(person.stats[id]), "aria-label": t(`life.stat.${id}`) }),
            h("span", { class: "value" }, String(person.stats[id])),
          ),
        ]),
      ),
      h("p", { class: "story", "aria-live": "polite" }, story),
      h(
        "div",
        { class: "actions" },
        h(
          "button",
          { class: "primary", type: "button", onclick: () => show(lifeScreen(advance(state, { kind: "continue" }).state)) },
          t("life.continue"),
        ),
        h("button", { class: "ghost", type: "button", onclick: () => show(startScreen()) }, t("life.backToStart")),
      ),
    );
  };

  show(startScreen());
}

function themeButton(): HTMLButtonElement {
  const button = h("button", { class: "ghost icon", type: "button", "aria-label": t("theme.toggle"), onclick: toggleTheme });
  // Half-filled circle, drawn with currentColor so it follows the theme.
  button.innerHTML =
    '<svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="8" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M10 2a8 8 0 0 1 0 16z" fill="currentColor"/></svg>';
  return button;
}

function beginLife(): LifeState {
  // Preview only: the real birth (country, sex, name, family) arrives in M3.
  // The seed comes from the browser here, outside the engine; the engine itself is fully seeded.
  const seed = crypto.getRandomValues(new Uint32Array(1))[0]!.toString(36);
  return newLife({ seed, sex: "female", name: "You" });
}
