// The life screen (UI-004, UI-010): a header that stays at the top, and below it, in the wide layout, three columns
// that scroll as one page: about you on the left, the ledger of years in the middle, around you on the right. The
// side columns stay in place and fit a short window; the plan sits in a tray under the ledger. Below 900 px it is one
// column with a bar of tabs, Story, You and Around you, one shown at a time.
//
// The story comes first in the page, then the two columns, so a screen reader and the keyboard meet the year before the
// reference material; the columns are placed side by side with CSS grid. Everything here only displays what the store
// derives from the life.
import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { DecisionCard } from "../engine/decisions";
import type { CountryIndex, Country } from "../engine/world/types";
import type { LifeState, Plan, Settings } from "../engine/types";
import { countryName } from "../format";
import { t } from "../i18n";
import { AroundColumn } from "./AroundColumn";
import { DecisionCardView } from "./DecisionCardView";
import { EventLine } from "./EventLine";
import { JournalLine, NotesPanel } from "./Journal";
import { TabPanel, Tabs } from "./kit";
import { Ledger } from "./Ledger";
import { LifeHeader } from "./LifeHeader";
import styles from "./LifeScreen.module.css";
import { Page } from "./Page";
import { PlanWidget } from "./PlanWidget";
import {
  countryFacts,
  lifeOverview,
  lifeRings,
  lifeStrip,
  planToSend,
  type GameSnapshot,
  type PlanOverview,
  type QuietRun,
  type ReflectionView,
  type StatChange,
} from "./store";
import { useFocusOn } from "./useFocusOn";
import { useNarrow } from "./useNarrow";
import { eventWords, quietRunLine, statChangesLine } from "./words";
import { YouColumn } from "./YouColumn";

export interface LifeScreenProps {
  life: LifeState;
  country: Country;
  sources: CountryIndex["sources"];
  showUsPrices: boolean;
  /** The decision the year is waiting on, if any (DEC-001). */
  card: DecisionCard | null;
  /** The focus plan to place, if one is asked for this year (DEC-003). */
  plan: PlanOverview | null;
  /** Years that just passed in one step without anything to tell (TIME-002). */
  quietRun: QuietRun | null;
  /** Set when the life was resumed from something other than its saved copy (SAVE-005, RNG-004). */
  restored: GameSnapshot["restored"];
  /** Set when the browser would not keep this life, so it will be lost with the tab (SAVE-001). */
  problem: GameSnapshot["problem"];
  /** The reflection prompt for the year just lived, if it has one (UI-007). */
  reflection: ReflectionView | null;
  /** The stats that moved by much over the step just taken, said to a screen reader (A11Y-002). */
  statChanges: readonly StatChange[];
  onToggleUsPrices: () => void;
  /** `plan` is set only when the player changed it; otherwise the plan carries over. */
  onContinue: (plan?: Plan) => void;
  onChoose: (choiceId: string) => void;
  /** Writes a journal line at the current age, answering the prompt `prompt` or one of the player's own (UI-007). */
  onJournal: (text: string, prompt?: string) => void;
  onSettings: (changes: Partial<Settings>) => void;
  onBack: () => void;
}

type View = "story" | "you" | "around";

/** The journal lines being written and not saved yet, by prompt id ("" for the player's own), for one age only. */
interface Drafts {
  age: number;
  lines: Readonly<Record<string, string>>;
}

/** The draft key of the player's own line, which answers no prompt. */
const OWN = "";

export function LifeScreen({
  life,
  country,
  sources,
  showUsPrices,
  card,
  plan,
  quietRun,
  restored,
  problem,
  reflection,
  statChanges,
  onToggleUsPrices,
  onContinue,
  onChoose,
  onJournal,
  onSettings,
  onBack,
}: LifeScreenProps) {
  const { person } = life;
  const narrow = useNarrow();
  const pauseId = useId();
  // While a decision waits its card takes focus instead.
  const heading = useFocusOn<HTMLHeadingElement>(life.history.length, !card);
  // The player's unsent plan, kept only for the age it was made at, so a new year starts from the plan as it stands.
  const [edit, setEdit] = useState<{ age: number; draft: Plan } | null>(null);
  // Which tab each part is on, and which part the narrow layout shows. Kept here, in the page, and not saved.
  const [view, setView] = useState<View>("story");
  const [youTab, setYouTab] = useState("school");
  const [aroundTab, setAroundTab] = useState("family");
  // The Journal button counts its presses so focus goes into the notes' field each time, even when they are open.
  const [journalPresses, setJournalPresses] = useState(0);
  const notes = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (journalPresses > 0) notes.current?.focus();
  }, [journalPresses]);
  // Lines being written are kept here, not in their fields, so they survive a tab being left and a new snapshot of
  // the same year; they belong to the age they were written at, so the next year starts empty.
  const [drafts, setDrafts] = useState<Drafts>({ age: person.age, lines: {} });
  const draftOf = (key: string) => (drafts.age === person.age ? drafts.lines[key] : undefined);
  const setDraft = (key: string, text: string | undefined) =>
    setDrafts((was) => {
      const lines = { ...(was.age === person.age ? was.lines : {}) };
      if (text === undefined) delete lines[key];
      else lines[key] = text;
      return { age: person.age, lines };
    });

  const draft = plan && edit?.age === person.age ? edit.draft : plan?.chosen;
  const last = life.history.at(-1);
  const story = !last
    ? ""
    : last.stageChanged
      ? t("life.stageReached", { stage: t(`life.stage.${last.stage}`) })
      : t("life.yearPassed", { age: last.age });
  const events = last?.events ?? [];
  // While a decision waits the page tells the wait, not the last year, so that year goes into the ledger with the rest.
  // The panels only change with the life, not with a plan being placed.
  const overview = useMemo(() => lifeOverview(life, country), [life, country]);
  const facts = useMemo(() => countryFacts(person.sex, country), [person.sex, country]);
  const strip = useMemo(() => lifeStrip(life), [life]);
  const rings = useMemo(() => lifeRings(life.history), [life.history]);
  const where = t("life.where", { country: countryName(country), place: t(`life.place.${person.location}`) });

  /**
   * Keeps every line being written this year before the life moves on or is left, so nothing typed is lost; in the
   * year a person dies this is the last chance, as a finished life takes no more lines. An empty draft is not saved.
   */
  const saveDrafts = () => {
    if (drafts.age !== person.age) return;
    for (const [key, text] of Object.entries(drafts.lines)) {
      if (text.trim() === "") continue;
      if (key === OWN) onJournal(text);
      else onJournal(text, key);
    }
    setDrafts({ age: person.age, lines: {} });
  };
  const sendPlan = () => {
    saveDrafts();
    // The new year is told in the story, so that is where the narrow layout goes back to.
    setView("story");
    onContinue(plan && draft ? planToSend(plan, draft) : undefined);
  };
  const leave = () => {
    saveDrafts();
    onBack();
  };
  const openJournal = () => {
    setAroundTab("notes");
    setView("around");
    setJournalPresses((presses) => presses + 1);
  };

  const storyColumn = (
    <Ledger
      age={person.age}
      earlier={card ? life.history : life.history.slice(0, -1)}
      narrow={narrow}
      tray={
        plan && draft && !card ? (
          <PlanWidget plan={plan} draft={draft} onChange={(next) => setEdit({ age: person.age, draft: next })} />
        ) : null
      }
    >
      <h1 ref={heading} tabIndex={-1} className={styles.title}>
        {t("life.age", { age: person.age })}
        <span className="subtitle">{t(`life.stage.${person.stage}`)}</span>
      </h1>
      {/* The header has no room for the name in the narrow layout, so it is told here. */}
      {narrow && <p className={`small ${styles.line}`}>{person.name}</p>}
      <p className={`small ${styles.line}`}>{where}</p>
      {restored && (
        <p className="note" role="note">
          {t(`life.restored.${restored}`)}
        </p>
      )}
      {/* A save that fails mid-life is said politely, once; the notes above and below stay as they are. */}
      <div aria-live="polite">
        {problem === "current" && (
          <p className="note" role="note">
            {t("life.problem.current")}
          </p>
        )}
      </div>
      {/* What the live region below says, for the eye; not live itself, so nothing is read twice. */}
      <div>
        {quietRun && <p className={styles.storyLine}>{quietRunLine(quietRun)}</p>}
        {card ? (
          <p className={styles.storyLine}>{t("decision.waiting")}</p>
        ) : (
          <>
            <p className={styles.storyLine}>{story}</p>
            {last && (
              <>
                <h2 className={`eyebrow ${styles.sectionHeading}`}>{t("life.thisYear")}</h2>
                {events.length === 0 ? (
                  <p>{t("life.quietYear")}</p>
                ) : (
                  <ul className={styles.events}>
                    {events.map((event, index) => (
                      <EventLine key={`${index}-${event.id}`} event={event} sources={sources} />
                    ))}
                  </ul>
                )}
              </>
            )}
          </>
        )}
      </div>
      {/* After the year and outside the live region: an offer, never a demand, and Continue does not wait for it. */}
      {reflection && (
        <section aria-labelledby={pauseId} className={styles.pause}>
          <h2 id={pauseId} className={`eyebrow ${styles.sectionHeading}`}>
            {t("reflection.heading")}
          </h2>
          <JournalLine
            key={`${reflection.age}-${reflection.id}`}
            label={t(reflection.textKey)}
            labelStyle="prose"
            written={reflection.written}
            draft={draftOf(reflection.id)}
            onDraft={(text) => setDraft(reflection.id, text)}
            onSave={(text) => onJournal(text, reflection.id)}
          />
        </section>
      )}
      {card && <DecisionCardView key={card.eventId} card={card} sources={sources} onChoose={onChoose} />}
    </Ledger>
  );
  const youColumn = (
    <YouColumn
      stats={person.stats}
      rings={rings}
      overview={overview}
      showUsPrices={showUsPrices}
      onToggleUsPrices={onToggleUsPrices}
      tab={youTab}
      onTab={setYouTab}
      narrow={narrow}
    />
  );
  const aroundColumn = (
    <AroundColumn
      family={overview.family}
      facts={facts}
      sex={person.sex}
      country={country}
      sources={sources}
      tab={aroundTab}
      onTab={setAroundTab}
      notes={
        <NotesPanel
          journal={life.journal ?? []}
          age={person.age}
          draft={draftOf(OWN)}
          onDraft={(text) => setDraft(OWN, text)}
          onSave={(text) => onJournal(text)}
          inputRef={notes}
          narrow={narrow}
        />
      }
      narrow={narrow}
    />
  );

  const header = (
    <LifeHeader
      name={person.name}
      age={person.age}
      where={where}
      strip={strip}
      narrow={narrow}
      waiting={card !== null}
      settings={life.settings}
      onSettings={onSettings}
      onJournal={openJournal}
      onContinue={sendPlan}
      onBack={leave}
    />
  );

  // The one live region of the screen (A11Y-002), outside the tabs so it speaks whichever part a phone shows. It is
  // on the page from the first render; its contents are keyed by the years lived and the wait, so a year told in
  // the same words as the one before is new nodes, and is said again.
  const live = (
    <div role="status" className="visually-hidden">
      <div key={`${life.history.length}-${card ? "waiting" : "told"}`}>
        {quietRun && <p>{quietRunLine(quietRun)}</p>}
        {card ? (
          <p>{t("decision.waiting")}</p>
        ) : (
          last && (
            <>
              <p>{story}</p>
              {events.length === 0 ? (
                <p>{t("life.quietYear")}</p>
              ) : (
                events.map((event, index) => {
                  const words = eventWords(event, sources);
                  return words && <p key={`${index}-${event.id}`}>{words}</p>;
                })
              )}
              {/* Said only to a screen reader: the bars in the column show it to the eye. */}
              {statChanges.length > 0 && <p>{statChangesLine(statChanges)}</p>}
            </>
          )
        )}
      </div>
    </div>
  );

  return (
    <Page header={header} layout="wide">
      {live}
      {narrow ? (
        <Tabs
          label={t("life.nav.label")}
          variant="bar"
          selectedKey={view}
          onSelectionChange={(key) => setView(key as View)}
          tabs={[
            { id: "story", label: t("life.nav.story") },
            { id: "you", label: t("life.nav.you") },
            { id: "around", label: t("life.nav.around") },
          ]}
          className={styles.narrow}
        >
          {/* All three stay in the page, so what is in them keeps its place; the two not shown are out of sight and reach. */}
          <TabPanel id="story" forceMount className={styles.pane}>
            {storyColumn}
          </TabPanel>
          <TabPanel id="you" forceMount className={styles.pane}>
            {youColumn}
          </TabPanel>
          <TabPanel id="around" forceMount className={styles.pane}>
            {aroundColumn}
          </TabPanel>
        </Tabs>
      ) : (
        <div className={styles.columns}>
          {storyColumn}
          {youColumn}
          {aroundColumn}
        </div>
      )}
    </Page>
  );
}
