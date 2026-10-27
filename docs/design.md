# Phase 2: Design

This document turns the Phase 1 analysis (`docs/analysis.md`) and Roman's decisions into a design we can build: identity, data model and simulation engine.

Decisions this design rests on (from Phase 1 review, 2026-10-23):
- **Real statistics** from primary publishers (UN, World Bank, UNESCO, ILO, WHO, IHME, UCDP), baked by a build-time pipeline.
- **Turn-based and event-driven**: no real-time clock.
- **Sensitive content in scope**, non-graphic, with a softening option and help resources.
- **Reflective and literary tone, with real game depth.**
- **Free and non-commercial**, so non-commercial health data is allowed.

---

## 1. Identity

### 1.1 Name ideas

| Name | Idea behind it |
|---|---|
**Name: Birthright** (chosen by Roman, 2026-10-23). What you are handed at birth, fairly or not; the word names the game's central question.

Name check (2026-10-23): "Birthright" is also the name of a Dungeons & Dragons campaign setting from the 1990s (now owned by Wizards of the Coast) and of a 1996 Sierra PC game based on it, *Birthright: The Gorgon's Alliance*. Our game is free, non-commercial and unrelated in genre, so the risk of confusion is low. To keep it distinct, we use a descriptive subtitle in the page title and store listings, for example **"Birthright: a life simulation"**, and never use fantasy styling.

Other ideas from the naming rounds, kept for reference: Heartwood, The Drawn Lot, Almanac, Growth Rings, The Long Year, Ledger of Days, Undertow (Driftwood declined).

Code and storage keys use the prefix `birthright`.

### 1.2 Tone and voice

- **Second person, present tense, short.** "You are four. The well is an hour's walk; your sister carries the water now, and soon you will."
- **Literary but plain.** Concrete images over adjectives. No melodrama, no jokes at a character's expense.
- **Grounded in numbers, gently.** When the data matters, the game says so in one quiet line with its source: "Here, about 1 in 14 children die before age five (UN WPP 2024)." Numbers explain, they do not lecture.
- **Hard things are named, not shown.** Death, violence, suicide and abuse are stated honestly and briefly, never described graphically. Each is followed by a pause and, where relevant, a help resource.
- **No score, but real stakes.** The game never ranks lives. Depth comes from systems the player can learn to read (see 3.3, the odds lens) rather than from points.

### 1.3 Visual direction

- **Core motif: growth rings.** The life is drawn as a tree cross-section that grows one ring per year. Ring thickness reflects how good the year was (happiness), colour reflects the year's dominant theme (study, work, love, loss, illness, migration), and marks on a ring show key events. The final cross-section is the summary image and the shareable card. This is our signature and has nothing in common with the reference's look.
- **Palette:** warm paper background, ink-dark text, muted natural colours for themes (moss, ochre, river blue, rust, slate). A proper dark mode ("night paper").
- **Type:** a readable serif for narrative text, a clean sans for numbers and controls. Generous line height, a 60 to 70 character column on desktop.
- **Layout:** the life screen (UI-004, UI-010) is Ledger C1 Compact. A header stays at the top: wordmark, name, age and country, Journal, settings, the help link and Continue, with a strip of the years so far (key moments marked) beneath it. At 900 px and up there are three columns that scroll as one page: About you on the left (rings thumbnail, the four stats, tabs for school and work, money and health), the ledger of years in the middle (the year now, then the earlier years, newest first, with the plan in a tray under it), Around you on the right (tabs for family, country and notes). The side columns are sticky and each tab fits a window 640 px tall without scrolling. Below 900 px it is one column with a bar of tabs at the bottom (Story, You, Around you), and the header keeps only the wordmark, the help link, settings and Continue. In the page the story comes first, then the two columns, so a screen reader meets the year before the reference material. 1440 px is the floor for the wide layout, about 400 px (390 to 430) the floor for phones.
- **Motion:** slow, small transitions (a ring growing, a card settling). Fully disabled under `prefers-reduced-motion`. The birth reveal (UI-016, concept "the turning line") is the one longer sequence: after Begin, 6 to 10 countries drawn by births per year cross-fade in the story face, slowing from about 340 ms to about 900 ms, then the real country stays with an ink rule and one line ("About 1 in N of the year's births..."), about 6 s in all. It is timed with CSS delays (no timers), is skippable, and is not shown at all under reduced motion (the birth screen then adds a line that the country was drawn by chance). The country is drawn first, so the reel is only a presentation: no flags, sound, near-miss slow-down or verdict, and the same sequence and ink for every birth.
- **Art:** no illustrations of people in the MVP; the rings, simple line icons and typography carry the identity. This avoids stereotyped depictions of countries.

---

## 2. Data model

TypeScript is the source of truth for types. Everything below is a sketch to be refined during the build.

### 2.1 World data (built by the pipeline)

One compact JSON file per country, plus a small index file. Every indicator carries its source and year.

**Country coverage (decided 2026-10-23): every country with complete data is included.** "Complete" means the country has its own values for the **core indicators** that decide life and death: a UN WPP life table by sex, annual births, World Bank PIP income percentiles and a WHO/IHME cause-of-death mix. Countries missing any core indicator are left out, and the pipeline reports which ones and why. **Secondary indicators** (education, labour, marriage, migration, conflict) may be filled from the regional or income-group average when missing. Those values are flagged `estimated: true`, and the game never cites an estimated value as a fact about that country. The birth draw uses births per year across all included countries, so the excluded countries' share is redistributed, and the Sources screen says so.

```ts
interface Sourced<T> { value: T; source: SourceId; year: number; estimated?: boolean }
// estimated = filled from a regional or income-group average because the country has no data

interface CountryIndex {
  dataVersion: string;              // e.g. "2026.10.1"
  countries: { iso3: string; name: string; region: RegionId; birthsPerYear: number; population: number }[];
  sources: Record<SourceId, { title: string; publisher: string; url: string; licence: string; accessed: string }>;
}

interface Country {
  iso3: string;
  name: string;
  region: RegionId;               // UN M49 region
  incomeGroup: "low" | "lower-middle" | "upper-middle" | "high";
  demography: {
    lifeTable: { male: number[]; female: number[] }; // qx: probability of dying within the year, ages 0..100 (UN WPP)
    sexRatioAtBirth: Sourced<number>;
    tfr: Sourced<number>;                            // children per woman
    meanAgeAtBirth: Sourced<number>;
  };
  money: {
    percentiles: Sourced<number[]>;   // 100 values, daily income per person, PPP$ (World Bank PIP)
    welfareType: "income" | "consumption";
    intergenerationalPersistence: Sourced<number>; // 0..1, World Bank GDIM; regional fallback
    healthOutOfPocketShare: Sourced<number>;
  };
  education: {                        // by sex
    primaryCompletion: Sourced<{ male: number; female: number }>;
    lowerSecondaryCompletion: Sourced<{ male: number; female: number }>;
    upperSecondaryCompletion: Sourced<{ male: number; female: number }>;
    tertiaryEnrolment: Sourced<{ male: number; female: number }>;
    literacy: Sourced<{ male: number; female: number }>;
  };
  work: {
    labourParticipation: Sourced<{ male: number; female: number }>;
    unemployment: Sourced<number>;
    sectorShares: Sourced<{ agriculture: number; industry: number; services: number }>;
    informalShare: Sourced<number>;
    childLabour: Sourced<number>;
  };
  family: {
    meanAgeFirstMarriage: Sourced<{ male: number; female: number }>;
    childMarriageBy18: Sourced<number>;  // share of women married before 18
  };
  health: {
    causeMix: {                          // share of deaths by cause, per age band and sex (WHO GHE / IHME GBD)
      bands: [number, number][];         // e.g. [0,1],[1,5],[5,15],[15,30],[30,50],[50,70],[70,101]
      male: Record<CauseId, number>[];
      female: Record<CauseId, number>[];
    };
    suicideRate: Sourced<number>;        // per 100,000
  };
  conflict: Sourced<"none" | "minor" | "war">;   // UCDP, latest year
  migration: { emigrantShare: Sourced<number>; topDestinations: Sourced<string[]> };
}
```

MVP uses one era ("today", latest available year). The structure allows a year dimension later for past and future eras.

### 2.2 The person

```ts
interface Person {
  name: string;                 // from per-region name lists we write ourselves
  sex: "female" | "male";
  birthYear: number;            // in-world calendar, matches data year
  countryIso3: string;
  currentCountryIso3: string;   // changes on migration
  age: number;
  alive: boolean;

  // Dealt at birth, mostly hidden, revealed through play
  traits: {
    temperament: number;        // -2..2, calm to volatile
    curiosity: number;          // -2..2
    resilience: number;         // -2..2, how hard setbacks hit
    sociability: number;        // -2..2
    aptitude: number;           // -2..2, learning speed
    constitution: number;       // -2..2, baseline health
  };

  // Visible meters, 0..100
  stats: {
    health: number;
    happiness: number;          // mood and meaning combined
    belonging: number;          // quality of close relationships
    skills: number;             // education plus practical know-how
  };

  money: {
    householdPercentile: number;   // 1..100 within the country distribution, drawn at birth
    percentile: number;            // where the person stands now: the household's until adulthood, then their own
    luck: number;                  // standard normal draw at birth, part of the adult mix
    savings: number;               // PPP$
    debt: number;                  // PPP$
  };

  education: { level: "none" | "primary" | "lower-secondary" | "upper-secondary" | "tertiary"; inSchool: boolean; years: number; literate?: boolean };
  work: { status: "child" | "student" | "employed" | "informal" | "unemployed" | "caregiver" | "retired"; sector?: Sector; formal?: boolean; yearsWorked: number; attachment: number };
  location: "rural" | "urban";

  relationships: Relationship[];
  conditions: Condition[];      // chronic illness, disability, addiction; each with severity
  flags: Record<string, number | boolean>;  // story memory: "lost_sibling", "moved_abroad", ...
  journal?: JournalEntry[];     // the player's own notes and reflections (UI-007), absent when none; not input to a replay
  history: YearRecord[];        // one per year: stats, events, decisions, ring data
}

interface Relationship {
  id: string;
  kind: "mother" | "father" | "sibling" | "partner" | "spouse" | "child" | "friend" | "mentor";
  name: string;
  age: number;
  alive: boolean;
  closeness: number;            // 0..100
}
```

Parents and siblings are generated at birth from the country's fertility, mean age at birth and the household percentile. Family members age and can die each year using the same life tables, which makes loss arrive at believable times.

### 2.3 Events

Content lives in data files (`content/events/*.ts`), written by us. Two families of events share one schema:

- **Statistical events** whose yearly probability comes straight from world data: death, a sibling being born, leaving school, marriage, childbirth, job loss, migration, conflict reaching you.
- **Narrative events** written for texture and choice, with authored weights adjusted by state: a teacher noticing you, a flood, a first love, a friend's betrayal.

```ts
interface EventDef {
  id: string;                         // "edu.leave_school_for_work"
  stage: LifeStage[];                 // infancy, childhood, adolescence, youth, adulthood, midlife, elder
  conditions: Condition[];            // all must hold; see below
  chance: Chance;                     // how likely per eligible year
  once?: boolean;
  cooldownYears?: number;
  zoom?: boolean;                     // true = this event zooms its year into quarters (3.1.1, trigger Z12)
  tags?: ("crisis" | string)[];       // "crisis" events trigger zoom-in (Z8)
  sensitivity?: "none" | "difficult" | "severe";   // drives softening and help resources
  helpTopic?: "suicide" | "violence" | "abuse" | "grief" | "addiction";
  text: TextKey;                      // localisable string id, supports variables
  dataNote?: { text: TextKey; indicator: IndicatorPath };   // the quiet "here, 1 in N..." line
  choices?: Choice[];                 // none = something that happens to you
  effects?: Effect[];                 // applied when there are no choices
}

type Chance =
  | { kind: "fixed"; p: number }                                    // authored probability
  | { kind: "indicator"; path: IndicatorPath; scale?: number }      // from world data, e.g. childMarriageBy18 spread across ages
  | { kind: "weight"; base: number; modifiers: Modifier[] };        // relative weight within a pool

interface Choice {
  id: string;
  text: TextKey;
  requires?: Condition[];             // hidden if not met (e.g. need savings)
  outcomes: { p: number | ProbabilityExpr; effects: Effect[]; text: TextKey }[];   // sums to 1
}

type Condition =
  | { stat: StatId; op: "<" | ">" | "between"; value: number | [number, number] }
  | { trait: TraitId; op: "<" | ">"; value: number }
  | { flag: string; is: boolean | number }
  | { world: IndicatorPath; op: "<" | ">"; value: number }
  | { has: "partner" | "child" | "job" | "savings" }
  | { age: [number, number] };

type Effect =
  | { stat: StatId; add: number }                 // clamped 0..100
  | { money: "savings" | "debt"; add: number | MoneyExpr }
  | { set: string; value: number | boolean }      // flag
  | { relationship: "add" | "remove" | "closeness"; kind?: Relationship["kind"]; amount?: number }
  | { condition: "add" | "remove"; id: string; severity?: number }
  | { schedule: string; inYears: number }         // follow-up event
  | { education: Person["education"]["level"] } | { work: Partial<Person["work"]> }
  | { migrate: "destination" };
```

Each effect also records **why** it happened: `circumstance` (dealt by birth or world), `choice` (the player picked it) or `chance` (a dice roll). The summary uses these tags (3.6).

### 2.4 Save format

Two stores, both local to the browser:

- **localStorage** `birthright:current` holds the life in progress (small). Every key the game writes starts with `birthright:`, so "delete all local data" finds them (SAVE-007).
- **IndexedDB** `birthright` holds finished lives (the archive can grow): `pastLives` holds each life (its summary and its save) and `listings` holds the small records the past-lives list shows. One life per seed.

```ts
interface SaveFile {
  schemaVersion: number;    // 1 today; readSave migrates older ones (MIGRATIONS) and refuses newer ones
  dataVersion: string;      // world data used (the country index's dataVersion)
  contentVersion: string;   // events and text used (CONTENT_VERSION in src/content/version.ts)
  seed: string;             // e.g. "amber-river-4821"
  countryIso3: string;      // the country the birth drew, which the replay and the resume need before the snapshot is read
  settings: Settings;       // the settings the life began with: { softening, pace }
  decisions: { year: number; eventId: string; choiceId: string }[];   // the full player input log
  settingsLog: { age: number; changes: Partial<Settings> }[];         // settings changed mid-life (softening changes which events can come)
  planLog: { age: number; plan: Plan }[];                             // every plan the player set; plans carry over until the next
  years: number;            // years recorded: where a replay stops
  waiting: boolean;         // a decision was waiting: the replay takes one more step, to the decision, and does not answer it
  epitaph?: string;         // the player's few words, at most 140 characters (DEATH-004)
  journal?: JournalEntry[]; // the lines the player wrote along the way (UI-007), absent when none: saves made before it load unchanged
  snapshot: LifeState;      // latest state (person, history, plan, a waiting turn, the logs), so loading is instant
  createdAt: string; updatedAt: string;
}
```

The **seed plus the decision, plan and settings logs** are the real save; the snapshot is a cache. `settings` is the initial settings, and `settingsLog` is applied on top of it at the age each entry names. Saves are written after every resolved turn (and when the drawn birth is shown), so closing the tab never loses more than the current screen; a browser that refuses the write (full, blocked, private mode) is told to the player.

**Loading** (`readSave`, `restoreLife` in `src/engine/save.ts`): a save of a newer schema is "unsupported" and one with no seed or logs is "damaged", and neither is deleted unasked. A save that passes goes through the migrations from its version to the current one (SAVE-004). The snapshot is used when it has the shape of a life that matches the logs beside it (the same seed, country, years, waiting and answered decisions). It is trusted over a replay even when the data and content versions match, because only data and content are versioned: a change to the engine itself would make a replay of a life in progress a different life from the one the player has been living. When the snapshot is missing or unsound, the engine replays the life from seed and logs (SAVE-005). When the versions differ, the player is told the life may play out a little differently from here, because a replay is exact only for the same data, content and engine. A waiting decision whose event this version no longer has is dropped, and the year starts again when the player continues. A save no replay can rebuild is "damaged". Because a sound snapshot is trusted, a change to the shape of `LifeState` could strand every life in progress, so `tests/engine/save.test.ts` pins the key sets of a life and a save file and fails until the change is made a decision about migrations. Export and import as a JSON file are cheap to add once this exists.

**The archive** keeps what the summary showed (`LifeSummary`, plain data) beside the save, so a life opens exactly as it was seen even if the engine or the content moves on. Adding an epitaph writes the life again.

---

## 3. Simulation engine

The engine is a pure TypeScript module with no DOM access, so it can be tested and run headless. The UI calls `advance(state, input)` and renders what comes back.

### 3.1 Time steps

- **One turn is one year.** Turn-based: nothing happens until the player acts.
- **Event-driven pacing:** a year with no decision and no notable event is a "quiet year". With the default pace setting, quiet years are batched ("Three quiet years pass. You learn to read.") so the game moves fast through calm stretches and slows down at turning points. The player can switch to "every year".
- **Life stages** group years into chapters: infancy (0 to 2), childhood (3 to 11), adolescence (12 to 17), youth (18 to 29), adulthood (30 to 49), midlife (50 to 64), elder (65+). Stage changes are natural reflection points.
- **Zoom-in quarters** (decided 2026-10-23): a crisis or turning-point year splits into four quarterly turns (3.1.1). Everything else stays yearly.

#### 3.1.1 Zoom-in quarters

A zoomed year is played as four quarters (Q1 to Q4). In each quarter the player re-sets the focus plan and may face decisions, so a hard year is lived through step by step instead of resolved in one roll.

**When a year zooms.** A year zooms if **any** trigger below holds, subject to the limits after the table. Triggers come in two kinds:

- **Foreseeable triggers** are checked at the start of the year, before the plan is set. The year opens zoomed and the player is told why ("This year, the baby is due").
- **Shock triggers** are checked when the year's events are rolled. The shock lands in a quarter drawn at random (`events` stream). Quarters before it resolve automatically with the current plan and are summarised in one line, and the year continues zoomed from the shock's quarter to Q4.

| # | Trigger | Kind | Exact condition |
|---|---|---|---|
| Z1 | Serious illness | Shock | A condition with severity ≥ 2 (scale 1 to 3) is added this year |
| Z2 | Ongoing illness under treatment | Foreseeable | A condition with severity ≥ 2 is active and the person chose treatment last year |
| Z3 | Health collapse | Foreseeable | Health stat < 25 at the start of the year, and the previous year was not zoomed for Z3 |
| Z4 | Childbirth | Foreseeable | The person or their partner is pregnant at the start of the year (birth falls this year) |
| Z5 | Job loss | Shock | The person's job ends involuntarily this year, and savings cover less than 6 months of household costs |
| Z6 | Migration | Foreseeable | The player chose to move abroad (or was displaced) and the move happens this year |
| Z7 | War reaches you | Foreseeable or shock | The current country's conflict level becomes `war` this year (foreseeable if it was already `war` and the person is newly displaced) |
| Z8 | Disaster | Shock | A major event tagged `crisis` fires (flood, drought, fire, epidemic) |
| Z9 | Bereavement | Shock | A relationship with closeness ≥ 60 dies (parent, partner, child, close sibling) |
| Z10 | Money crisis | Foreseeable | Debt > 12 months of household income, or savings < 0 with no income at the start of the year |
| Z11 | Decisive school year | Foreseeable | Final year of a school level whose continuation is uncertain (continuation odds between 10% and 90%) |
| Z12 | Authored | Either | An event declares `zoom: true` in its data and fires |

**Limits** (so zoomed years stay special):
- No zoom before age 6, when the yearly plan starts. Crises in early childhood are told at yearly scale.
- At most **12 zoomed years per life**. When the cap is reached, only Z1, Z4, Z6 and Z7 can still zoom.
- No two zoomed years in a row, unless the second one has a trigger from Z1, Z4, Z6 or Z7.
- The age-related rise in death risk is **not** a trigger. Otherwise every year in old age would zoom.
- Auto mode and the player's "keep it yearly" setting play zoomed years with the carried-over plan and no quarterly stops. The odds are identical, so a life replays the same either way.

**How the numbers work in a quarter.** The data is yearly, so quarterly play must not change the overall odds:
- Each yearly probability p becomes a quarterly probability `1 − (1 − p)^(1/4)`, rolled once per quarter. Over four quarters the total risk equals the yearly risk, and a choice made in Q2 can change the odds for Q3 and Q4.
- Yearly stat changes, income and costs are split into quarters (a quarter of each).
- Each quarter draws from its own RNG streams, derived from `hash(seed, stream, year, quarter)` (3.9).
- Mortality is checked every quarter, so a death can happen mid-year and the summary shows the quarter.

**What the player sees.** The year's ring is drawn in four segments. A zoomed year's summary line reads like a short chapter ("The year of the flood: spring, summer, autumn, winter").

### 3.2 Order of one year

For a zoomed year (3.1.1), steps 2 to 8 run once per quarter with quarterly probabilities, and step 0 decides whether the year zooms.

```
0. Check foreseeable zoom triggers (Z2, Z3, Z4, Z6, Z7, Z10, Z11, Z12 when scheduled).
1. Age everyone by one year (person, family).
2. Apply the year's plan (3.3): the focus points the player allocated.
3. Baseline drift: stats move a little toward country- and age-dependent norms
   (health declines with age, skills grow in school, etc.).
4. Statistical checks, using world data:
   family births and deaths, schooling continuation, work entry, marriage odds,
   conditions, conflict exposure, migration pressure.
5. Event selection (3.4): at most one major event and up to two minor ones.
6. If an event has choices, pause and ask the player; resolve the chosen outcome.
7. Apply effects, clamp stats, update money (income draw for the year, costs, shocks).
8. Mortality check (3.5). If the person dies, go to the end of life.
9. Record the year (stats, events, decisions, ring data) and save.
```

**Built in M3 (2026-10-24):** the year is the one the person is living at their current age, and the birthday comes at its end. So drift, checks, events and mortality all use the age the person has now (mortality uses the life table's `qx` for that age), the record is written with the new age, and a death records the age at death (the infant who dies in year one dies at age 0). Steps without a system yet (the plan, decisions) are no-ops until M5.

**Built in M4 (2026-10-24):** step 4 now runs, in this order: family deaths, a younger sibling's birth, child labour, school, work, money, conditions, then the closeness of the people around the person. Each reads the person as the earlier ones left them, so a child who leaves school this year is a worker next year, and a condition that begins this year already counts in the mortality check.

**Built in M5 (2026-10-24):** the year is now two phases, because a decision stops it. `advance(state, {kind: "continue", plan?})` runs steps 2 to 6 (the plan, drift, the checks and event selection) and, if a decision comes up, returns with `state.turn` set: the person after the year's checks and the events still to apply. `advance(state, {kind: "choose", choiceId})` then rolls the choice's outcome and runs steps 7 to 9. Continuing while a turn waits, or choosing when none does, throws. The year has room for one decision: each system step is told whether it is free (`open`) and a second decision waits for another year or falls back to the course the calibrated models assume. Step 4 also now runs partners, children and friends, the care of ill parents and partners, unemployment spells, treatment decisions and the pressure to leave school. `advanceAuto` takes the default course at every decision; it is what the calibration harness and auto play use. While the pace is "quiet years", one `continue` lives on through years that are only quiet texture (at most 12).

### 3.3 Player agency: the yearly plan and the odds lens

This is where the "in-depth game feeling" comes from.

- **Yearly plan.** From age 6, each year the player spends a small budget of focus points (three by default) across five areas:
  - **Learn**: school, reading, training. Raises skills; affects education outcomes.
  - **Earn**: work, trade, saving. Raises income and savings.
  - **Health**: exercise, medical care, eating well, avoiding risk. Raises health; lowers illness and death risk.
  - **Belonging**: family, friends, partner, children, and caring for relatives. Raises the Belonging stat and relationship odds.
  - **Rest**: play, leisure, faith, solitude. Raises happiness; buffers stress.

  Each point is a nudge to that area's yearly change and to the odds of related events. Several points in one area give diminishing returns, so spreading is often wiser than stacking. Circumstances can take points away before the player chooses. A child who must work loses a point to Earn. Someone caring for a sick parent loses one to Belonging. An ill person loses one to Health. Poverty and duty are therefore felt in play, not just described. The plan carries over to the next year unless the player changes it, so it costs no clicks when nothing has changed.
- **Alternatives considered for yearly input** (for Roman's choice, see section 7):
  1. **Focus points** (above). Medium depth, one quick screen per year, carries over by default.
  2. **Single yearly focus**: pick one area per year. Lightest, but it is what the reference does, and it gives less room for trade-offs.
  3. **Life priorities**: set a standing priority order (for example Health > Learn > Earn) that holds for years, and only revisit it at turning points. Very light and good for auto mode; less sense of yearly struggle.
  4. **Time budget**: split a typical week's hours across school or work, family, rest and so on with sliders. The deepest and most realistic, but fiddly on phones and slow over 70+ turns.
  5. **Situation cards**: each year draws three or four situation cards based on your life ("Harvest is late", "A cousin offers work in the city"), and you play two. The most game-like and the most varied, but needs much more written content.
- **Decisions** at turning points (school, work, partner, children, migration, treatment, crises). Options can be hidden or locked by money, education or local conditions, and the game says why ("There is no secondary school within reach").
- **The odds lens.** Before confirming a decision, the player can see roughly how each option shifts the odds of what matters ("Leaving for the city: steady work about 4 in 10, up from 2 in 10. Health risk higher."). Numbers are shown in plain words and in bands, not decimals. This is the main difference from the reference, where choices can feel cosmetic: here the player learns that choices shift odds, and how much the starting point limits that shift.

### 3.4 Event selection

1. Build the candidate list: every event whose stage and conditions match and whose `once` and cooldown rules allow it. Remove events above the softening threshold if softening is on (statistical deaths still happen, but are told more briefly).
2. **Statistical events** are rolled independently, each against its own probability from world data (for example, the yearly chance of marriage at this age, sex and country).
3. **Narrative events** are drawn from weighted pools. Weight = base × modifiers (traits, stats, flags, world indicators). One draw from the major pool (if any qualifies, with a pacing rule that guarantees a major event at least every few years) and up to two from the minor pool.
4. Scheduled follow-ups (from earlier `schedule` effects) come first when due.

**Built in M5 (2026-10-24):** a draw brings an event with a fixed share of the time (0.25 for the major pool, 0.3 for each of the two minor draws) when any event can happen, and "nothing happens" weighs a share of the candidates' base weights so that adding events changes which ones come and not how often. A modifier or a focus point that raises an event's weight still raises its chance. A major draw cannot come up empty after four years without a major event. Softening skips severe narrative events and tells hard ones in their `softText`. An event with `roles` casts a living relative or friend for each role and needs one for each; its text uses `{friend}`, `{mother}` and so on, and a `closeness` effect with a role moves that person. Events that are only texture are marked `quiet`. A repeatable notable event cannot come round more often than every six years, and a test checks it.

### 3.5 Mortality and health

- Base yearly death probability = the country life table's `qx` for this age and sex (UN WPP).
- Adjusted by a **hazard multiplier** from state: health stat, chronic conditions, household percentile, conflict exposure. Multipliers are bounded (for example 0.5x to 4x) and calibrated so that a population of simulated people from a country reproduces that country's life expectancy within a small tolerance. A calibration test enforces this.
- On death, the cause is drawn from the country's **cause mix** for the age band and sex (WHO GHE / IHME GBD), nudged by the person's conditions (someone with a heart condition is more likely to die of heart disease).
- Suicide is part of the cause mix and is modelled the same way: never as a player choice, never described, always followed by a help resource line.

### 3.6 Money

- At birth, the household is placed at a percentile of the country's income distribution (World Bank PIP percentiles), drawn uniformly so that the whole distribution is represented.
- In adulthood, the person's own percentile is a mix of their family's percentile (weighted by the country's intergenerational persistence), their education and skills, their work, and luck. Yearly income is read from the percentile table, so amounts are realistic for that country.
- Savings, debt and shocks (illness, disaster, job loss) move money year to year; health costs scale with the country's out-of-pocket share.
- Money is shown in local-feel PPP dollars, with a one-line comparison ("about what $X buys in the US") for players who want it.

### 3.7 Reflection

- Reflection moments come from **events**, not fixed ages: the first loss, leaving home, a child's birth, a migration, a diagnosis, retirement, and each life-stage change. Each offers a short prompt and an optional journal line saved to the life. Built in M7 (see the decisions log).
- At the end, the player may write an epitaph.

### 3.8 End of life and summary

- A closing passage, the cause and age of death, and where that sits against the country's life expectancy.
- **The closing passage** (DEATH-002) is one of 13 cause groups (infection, early life, childbirth, hunger, cancer, heart, lungs, long illness, accident, violence, war, self-harm, other; `deathGroup` maps the WHO causes into them), each in a normal and a softened telling (softening on), followed by a line for the stage of life the person dies in. Nothing of the body, the method or the place is shown. A death by suicide is stated plainly and always carries the help line. Other deaths carry help only through the events of the last year that have a help topic; the passage itself carries none. This is a judgement call that Roman may revisit.
- **Against life expectancy** (DEATH-003): the life expectancy at birth of the person's sex from the country's life table (UN WPP, source and year shown), the years more or fewer (within 5 years counts as "about the same", authored), and the share of people of that sex in the country who live to that age.
- **The cross-section** (SUM-002): the full growth-ring image of the life, one ring per year lived (a death year included). The thickness runs from 0.2 of the thickest ring (happiness 0) to 1 (happiness 100), a floor so a bleak year still shows. The theme of a year (`yearTheme`, recorded on the year) is, in order: loss (a death in the family), illness (a condition begins, or one is serious, severity 2 or more), love (a partner, spouse or child comes into the life), move (between countryside and city), study (in school), work (in a job) and otherwise plain. Colour is never the only signal: each theme has its own pattern and label, and a table of the years sits beside the image.
- **Key moments** (SUM-003): each year is scored by what happened in it (quiet texture counts for nothing; an event 1, a decision 3, a severe event 4 and a difficult one 2.5, a condition 3, a partner or child 3, a wedding 4, a finished school level 2.5, leaving school 2, a job gained or lost 2.5, a move 2, up to 3 for the size of the changes to the stats, 1 for a new stage of life; all authored). The years that score 4 or more make the key moments, the best 12 at most; when fewer than 5 do, the best years with something to tell fill up to 5, and a short life shows every year it has. The year of death is left to the closing passage. The marks on the rings are numbered like the moments.
- **Chance, choice and circumstance** (SUM-004): each stat's level is carried on from year to year and pulled toward a norm (`src/engine/drift.ts`, SIM-004). The summary follows each source through the same yearly filter: what the person was dealt (the norm for the person against the norm for a neutral person with no traits, a middle household, a city, no job, no debt and no conditions: circumstance), the plan the player lived by (choice), conditions and the year's random swing (chance), and every effect of an event or decision with its own tag. The average size of each source's share of the level over the life gives three shares per stat, summing to 1; a cause behind at least half is "the main one", otherwise the stat is "mixed". The words are one sentence per stat and cause: "Most of your health came from where and when you were born." The records of what moved the stats (`YearRecord.drift`) and of each year's theme are stored with the history.
- **Your notes**: the journal entries and the epitaph. The epitaph (DEATH-004, at most 140 characters) is written on the summary, saved with the life and can be edited from the archive; the journal (UI-007) is shown beside it under "Your notes".
- Post-MVP ideas, our own take on comparison: **"The other shore"** (the same seed and traits, born in a different country) and **"The road not taken"** (replay from a past decision and change it).

### 3.9 Randomness and replay

- **Seed:** a readable string (three words or two words plus digits), stored with the life and shown on the summary.
- **PRNG:** a small, fast, well-tested generator (sfc32 or similar), seeded by hashing the seed string (cyrb128-style hash). No `Math.random()` anywhere in the engine; a lint rule enforces it.
- **Independent streams:** each subsystem draws from its own stream derived from `hash(seed, stream name, year)`: `birth`, `person`, `names`, `parents`, `siblings`, `siblings:birth`, `family`, `closeness`, `drift`, `labour`, `education`, `work`, `money`, `events`, `event:<id>`, `pool:major`, `pool:minor`, `condition:<id>`, `mortality`, `cause`, `outcomes` (the roll of a chosen outcome), `care`, `friends`, `romance`, `fertility` and `reveal` (the countries that pass in the birth reveal, UI-016, which never touches the life). Names (`names`, `siblings`, `friends`, `romance`, `fertility`) use their one roll through `pickName`, which skips taken names without drawing again (CHAR-007). Adding a new event to the content therefore does not change when someone dies, and replays stay stable across small content updates.
- **Replay guarantee** (RNG-004): the same seed, data version, content version and decision, plan and settings logs always produce the same life. `replay` (`src/engine/replay.ts`) lives the life again from the seed: at each age it applies the settings changes logged at or before it, sets the logged plan, answers each decision from the log, and stops at the recorded years (one step further when a decision was waiting). Tested directly: many lives played by a player who sets plans, changes settings and answers decisions at random, in three real countries and a synthetic one, give identical full histories when replayed, whole or stopped at any year, with or without a decision waiting. Adding or changing content bumps `CONTENT_VERSION`, which a test pins to a fingerprint of the events and conditions.
- **Auto mode:** an auto-player chooses for the player using a simple policy (weighted by traits), drawing from its own `autoplay` stream, so auto lives are also replayable.

---

## 4. Sensitive content and safety

- An honest, upfront **content note** before the first life, with the softening setting next to it.
- **Softening on:** severe narrative events are skipped, and statistical deaths and violence are told in one plain sentence.
- **Help resources:** events tagged with a `helpTopic` show a short, calm line pointing to an international helpline directory (for example findahelpline.com) and, where available, a country-specific number from a small list we maintain. A "Need to talk?" link is always available from the menu.
- Recommended age 15+.

## 5. Accessibility and localisation (built in from the start)

- Full keyboard play, visible focus, semantic HTML, screen-reader announcements for new events and stat changes, colour never the only signal (ring colours also have patterns and labels), reduced motion, scalable text.
- All player-facing text goes through string keys (`t("event.edu.leave_school.text", vars)`), English first, other languages later. Country names come from the browser's `Intl.DisplayNames` where possible.

## 6. Technical outline

- **Stack (React chosen by Roman, 2026-10-23):**
  - **UI:** React 19 single-page app built with Vite (`@vitejs/plugin-react`), TypeScript strict. No Next.js: there is no server, and the site is static on GitHub Pages.
  - **State:** the engine stays pure TypeScript with no React or DOM imports. A small store (`src/ui/store.ts`) holds the current state and exposes actions; components read it with `useSyncExternalStore`. No Redux or Zustand unless state grows beyond this.
  - **Screens:** switched by game state, with no router library. Hash routing is an option later for shareable links.
  - **Styling:** design tokens and shared base in `src/styles.css`, component styles in CSS Modules. System fonts only, no third-party requests.
  - **Components:** React Aria Components (Adobe), unstyled, wrapped in `src/ui/kit/` and styled with CSS Modules and the tokens (chosen by Roman, 2026-10-24). See `docs/design-system.md`.
  - **Graphics:** the growth rings are plain React SVG, with no chart library.
  - **Persistence:** localStorage for the current life, IndexedDB (via `idb`) for past lives.
  - **Text:** `t(key, vars)` over English string files; `react-i18next` is an option when a second language arrives.
  - **Quality:** Vitest with React Testing Library and jsdom; Playwright end-to-end at phone (about 400 px) and desktop (1440 px); ESLint (typescript-eslint, React Hooks, `Math.random` banned in the engine); Prettier.
  - **Data pipeline:** Node scripts run with `tsx`.
  - **CI and hosting:** GitHub Actions (lint, format, typecheck, unit tests, build, end-to-end) and GitHub Pages deploy on merge to `main`.
  - The repo's `vercel-react-best-practices` skill is trimmed to the client-side rules (bundle size, re-renders, rendering, JS hot paths); its server and Next.js rules were removed (see its `SOURCE.md`).
- **Layout of the repo:**

```
scripts/data/      pipeline: download, clean, fill gaps, write public/data/*.json
public/data/       baked world data (committed, versioned)
src/engine/        pure simulation: rng, world, person, events, effects, mortality, money, replay
src/content/       events, names, text (English)
src/ui/            React components and the game store: start, life, decision, reflection, summary, past lives, settings
src/save/          localStorage and IndexedDB adapters, migrations
tests/             engine, replay, calibration and component tests
e2e/               Playwright end-to-end tests (phone and desktop)
```

- **Data size target:** under 15 KB gzipped per country, loaded on demand.

## 7. Decisions log

None. Decided 2026-10-23: the name is **Birthright** (1.1); yearly input is **focus points** (3.3), played **yearly with zoom-in quarters** in crisis and turning-point years (3.1.1); the focus area "Care" is renamed **Health** (3.3), and the MVP includes **every country with complete data** (2.1); the UI uses **React with Vite** (6).

Decided 2026-10-24: interactive controls use **React Aria Components**, wrapped in `src/ui/kit/` and styled with **CSS Modules**, not Tailwind (6, `docs/design-system.md`).

Built in M2 (2026-10-24), where the data pipeline settled details the sketch in 2.1 left open:

- **Reference year.** Everything uses the latest estimate year of each source (WPP 2023, WHO GHE 2023, latest PIP survey from 2000 on, latest value from 2000 on for the rest). Each value keeps its own year.
- **Region** is the UN M49 sub-region from WPP (for example "Western Africa"). Fallbacks use it first, then the income group, then the world.
- **Income percentiles** use PIP 2021 PPP, national reporting level only. Countries whose survey covers only urban areas (Argentina) or that have no recent survey (Afghanistan) are excluded rather than shown with a distribution that is not national.
- **Cause of death** uses WHO GHE 2023 (IHME GBD needs a login, so it is not used). Bands are 0-4, 5-14, 15-29, 30-49, 50-59, 60-69 and 70+, by sex, with 15 cause ids plus `other` (the remainder). GHE covers 185 countries and areas, which caps coverage.
- **Intergenerational persistence** is the parent-child correlation of years of schooling in GDIM (1980 cohort), a proxy: GDIM's income elasticity is not available for most countries.
- **Gross ratios** (tertiary enrolment, completion rates) can exceed 100% because of over-age pupils; they are capped at 1.
- **Not in M2:** conflict (UCDP) and migration are not in the files yet. They arrive with WORLD-010 and DEC-008, which add their schema fields. The `iso2` code is stored so country names come from `Intl.DisplayNames`.
- **Licence note.** UNESCO UIS data is CC BY-SA 3.0 IGO. Its share-alike term applies to the education values in the country files, which the Sources screen states. WHO data is used under WHO's terms for public health purposes with attribution.

Decided 2026-10-24: the visible stats **Bonds** and **Wellbeing** are renamed **Belonging** and **Happiness** (2.2). The code ids are `belonging` and `happiness`, and all docs, feature rows, strings and tests use the new names. The yearly focus area **Bond** (3.3) was first left as it was; Roman then renamed it too (2026-10-24), so **Belonging** is both a stat and a focus area (ids `belonging`), and the Belonging focus raises the Belonging stat. The two sit side by side on the plan screen (DEC-003) and the life screen. The reference analysis (`docs/analysis.md`) still says "happiness" and "relationships" where it describes the reference game's own stats. Saves arrived in M6, after the rename, so no saved life uses the old ids.

Decided 2026-10-24: **WHO GHE is the only cause-of-death source for the MVP**; IHME GBD is not used (it needs an account). Revisit for finer causes or more countries after the MVP.

Built in M3 (2026-10-24), where the engine settled details the sketch left open:

- **Engine API.** `advance(state, input, country, catalog?)` takes the loaded country; the engine does no I/O. `newLife({ seed, country })` draws sex (from the sex ratio), place (urban share), household percentile (uniform 1 to 100), traits, name and parents from separate streams.
- **Traits** are integers from -2 to 2 with weights 1:4:6:4:1. Constitution moves the health norm and mortality; aptitude and curiosity move skill growth; sociability moves belonging; resilience moves happiness and cushions negative happiness effects; temperament widens happiness swings.
- **Mortality** is the life table's `qx` times a hazard multiplier (0.5 to 4) built from health against its age norm, constitution, household percentile, place and conditions, with a small calibration offset. Simulated life expectancy is within about 1 year of the source for the sampled countries; the test limit is 2.
- **Cause of death** is drawn from the WHO GHE mix for the age band and sex; each condition's `raises` cause gets weight x (1 + 1.5 x severity).
- **Child labour** uses the ILO share for ages 7 to 14. Poorer households are far more likely (the weight runs from 2x to 0 and averages 1, so the country share holds); a working child stops with probability 0.2 a year.
- **Family:** parents are alive at the birth (mother's age around the country's mean age at birth, father a few years older) and then die by the life table, with a grief event.
- **Events:** each statistical event has its own stream (`event:<id>`); narrative events are drawn from a major pool (at most one a year) and a minor pool (at most two), each with a "nothing happens" weight of 8. Events with choices are skipped until M5.
- **Skills and school** use a stand-in in M3: yearly gain by age band, scaled by the country's completion rate for that age, place and child labour. M4 (EDU-001) replaces it.

Built in M4 (2026-10-24), where the life systems settled these details:

- **School.** Primary runs from 6 to 11, lower secondary 12 to 14, upper secondary 15 to 17 and tertiary 18 to 21, the same for every country. Every child starts at six; each year they stay or leave. The chance to finish a level, given reaching it, is the ratio of the country's completion rates (capped so they never rise with level), spread as a yearly hazard over the level's years. A child's own hazard is the country's times a factor for household (strength 0.9 times the country's schooling persistence, mean 1 over the 100 percentiles), place (the gap between a rural and an urban child's hazard is 30% of the national one, split so that the mean over urban and rural children holds) and aptitude (12% per point). The hazard is scaled per country and sex so that the average over its children, level by level and among those who reached the level, is the published rate; completion rates for five countries are reproduced within 5 points. Tertiary uses enrolment times an **authored 70% completion share**, because UNESCO gives enrolment, not completion. Child labour does not yet change school odds (EDU-004 and CAREER-004, M5).
- **Literacy** is set at 12. Completers of primary school can read with probability 0.97 (authored) or less where the country's adult rate is lower than that; the chance for non-completers is whatever makes the country's adult rate hold. Today's children are compared with today's adults, a simplification. Illiteracy adds 1 to the log odds that a job is informal.
- **Work.** Each person is dealt a fixed attachment from 0 to 1 at birth and works, when out of school, at the ages where the country's participation rate for their sex is above it. The age shape is authored (a rise from 15 to 25, a plateau, a fall that starts at 55 plus up to 8 years where all work is informal) and scaled per country so the rate holds across a life-table population. Unemployment spells are not modelled yet (CAREER-003), so the unemployed count as in work. A health below 25 from age 45 takes a worker out of work. Not in the labour force: retired from 65, or from 55 for someone who has worked, otherwise "caregiver" (looking after home and family) from 18.
- **Jobs.** The first job draws a sector and formal or informal status from logistic models with authored weights for place, schooling and illiteracy, whose intercepts are solved per country so the average over its people hits the published sector and informal shares. Dangerous and informal work lowers the health norm.
- **Money.** The adult percentile is the household's (weighted by 0.7 times the persistence, authored) mixed with the standardised schooling rank, skills against what that schooling usually brings, job and luck. The mix keeps the whole 1 to 100 range populated; adult standing follows the household within 0.12 of the source's persistence in the batch. Income is the country table at that percentile times 365 (retired: 70%, caregiver or unemployed: 50%, both authored; a child or student is shown the household's). Spending is 102% of income at the bottom and 78% at the top (authored) with 6% yearly noise; surplus first repays debt (6% yearly interest, authored), then saves; deficits draw savings, then borrow. A debt of half a year's income or more weighs on happiness and health.
- **Siblings.** Births to a mother form a steady stream over ages 15 to 45 at the total fertility rate divided by 30 a year. The number of older siblings is Poisson with that rate times the mother's years behind her, those who died young are counted in `flags.siblingsLost` and not listed, and younger siblings arrive year by year while the mother is alive and under 45. Siblings per person then match fertility within 12% in the batch. No younger sibling is born in the person's first year.
- **Relationships.** Closeness moves a fifth of the way to a norm each year (by kind, plus 4 per point of sociability, minus 10 for parents during the teenage years) with a little noise. `relationship` effects add, remove or move relatives, and `condition` effects add (with severity) or remove conditions.
- **Conditions.** Fourteen conditions (the list is `src/content/healthConditions.ts`), each with an authored yearly onset chance scaled by age, household, place, job and the country's own cause-of-death mix, plus yearly worsening and easing chances, a hazard per severity point, a health penalty and a focus cost. None of the onset numbers is a published statistic and none is shown as one. Because the life table already contains the effect of disease, the average hazard the conditions add at an age and sex is divided out of the mortality multiplier using a cohort model of the conditions (`expectedHazardFactor`), so conditions decide who dies at an age and not how many. With that, simulated life expectancy is within 1 year of the source for the sampled countries.
- **Money display.** Every amount goes through `formatMoney`. Income is described in words by bands: below 3.00, 4.20 and 8.30 are the World Bank international poverty lines (2021 PPP); 20 and 60 are the game's own thresholds. The optional comparison says that international dollars buy at home what they buy in the United States, which is what PPP dollars are; it does not add data.
- **Streams.** New: `siblings` (yearly births), `siblings:birth` (the older siblings at the birth), `closeness`, `education`, `work`, `money` and `condition:<id>`. The newborn's luck and work attachment are drawn at the end of the `person` stream, after the earlier draws.

Built in M5 (2026-10-24), where events, decisions and the yearly plan settled these details. None of the numbers named "authored" is a published statistic and none is shown as one.

- **The plan.** Three points over Learn, Earn, Health, Belonging and Rest from age 6. A unit is measured against the default plan for the person's situation (school age: Learn, Health, Belonging; working age: Earn, Health, Belonging; retired: Health, Belonging, Rest), so the default is neutral and the calibrated models hold. A point is worth 1, then 0.6 of the one before it. Authored effects per unit: Learn adds 30% to the yearly skill gain and takes 12% off the odds of leaving school; Earn saves 3% more of income, adds 35% to the odds of finding work and takes 15% off those of losing it; Health adds 3 points to the health norm, takes 10% off the log hazard of death and 12% off the onset of conditions; Belonging adds 4 to the belonging norm and 3 to closeness, and adds 30% to the odds of making friends and meeting a partner; Rest adds 3 to the happiness norm and takes 10% off the sting of bad news. Circumstance takes points first, at most two in all: illness (a condition's focus cost), child labour (one on Earn) and caring for a sick parent or partner, or for a baby or a young sibling (one on Belonging). Earn is locked for under-15s who are not working and for the retired; points in a locked area, and points left over, go to Rest. Until the player changes it the plan follows the default and carries over.
- **Decisions.** A choice has outcomes with probabilities (a number, a weight with modifiers, or a function of the person for the engine's own decisions), effects, an optional cost, `requires` (hidden) and `locks` (shown with the reason). The odds lens reads the same probabilities the engine rolls and says them in bands ("about 1 in 3", never decimals); a choice with several outcomes needs a lens phrase for each. A choice with one outcome is the player's doing in the summary, one with several is chance shaped by the choice. Resolving always draws exactly one number from `outcomes`, so the stream stays in step whatever is chosen.
- **The engine's own decisions** are in `src/engine/systemDecisions.ts`: leaving school for work (EDU-004: from 12, households under the 70th percentile; a child working in the poorest households cannot stay; staying works with authored odds 0.55 less 0.25 for child labour, plus 0.004 a percentile above 40, 0.05 an aptitude point and 0.1 a Learn unit, bounded 0.1 to 0.9), tertiary school (EDU-003: after upper secondary, with fees an authored 40% of a year's income at the middle of the country, the odds of finishing from the model's own yearly odds, a scholarship with authored odds of 0.08 at skills 50, bounded 0.03 to 0.6, that needs skills above 55), how to see to a serious condition (HEALTH-005), meeting a partner (REL-003) and an arranged marriage under 18 (REL-004).
- **Care and costs.** Each condition has authored care costs, as a share of a year's income at the middle of the country, scaled by the country's out-of-pocket share of health spending over a reference 30% (bounded 0.2 to 2.5). The usual care changes nothing in the odds and is what the calibration assumes; the best care halves the chance of getting worse, raises the chance of getting better by half and takes 20% off the hazard; waiting does the opposite (worsen x1.5, recover x0.6, hazard x1.25). A person is asked from age 12, when a condition becomes serious (severity 2 or more) and the year has room; otherwise the usual care happens, and children's care is the household's. Money effects (`cost`, `windfall`, as a share of a year's income) only touch people on their own money; a cost comes out of savings first, then debt.
- **Work and unemployment (CAREER-003, CAREER-004).** Unemployed people look for work and find it at a yearly rate of 0.45 (authored); the loss rate is derived so that the share out of work holds at the country's unemployment rate. The harness counts the unemployed as part of the labour force; the share out of work is compared with the source (4 points).
- **Partners and children (REL-003, REL-004, FAM-004).** Partners are other-sex only in the MVP (an open question for Roman). The age at first marriage is lognormal from 12, fitted per country and sex to the published mean age and, for women, the share married before 18; 6% never marry (authored). A courtship starts a year before the wedding. Under 18 a marriage may be arranged, and the person is asked whether to ask to wait (authored odds that waiting works, 0.25 at the middle of the country, bounded 0.05 to 0.75, higher with a better-off household, aptitude and schooling). Where the published mean and the share married before 18 cannot both hold for one lognormal (Niger, Chad, Barbados), the model keeps the mean and the harness compares the share with the closest the spread reaches. Births come from a yearly chance at ages 15 to 44, scaled per country so that children per woman who lives to 45 are within 15% of the total fertility rate.
- **Friends and family (REL-002, FAM-005).** A friend is made from age 5 with an authored yearly chance of 0.2 (likelier at school and work, for the sociable and with points in Belonging, less likely the more friends there are); a friendship that fades below 18 ends. Parents and partners fall ill with an authored chance that rises with age, recover with 0.35 a year, and an ill one takes a point of Belonging. Grief has its own text for a mother, father, child, partner, friend and other relatives, and is heavier the closer they were.
- **Sensitive content.** Every event with `sensitivity` "difficult" or "severe" has a `helpTopic` and a `softText`; the validator in `src/engine/validate.ts` (ADMIN-001) checks text keys, probabilities, lens phrases, help topics, world paths, roles, follow-ups and illness ids over everything that ships, in the tests. Suicide enters only through the cause-of-death mix, from age 12, and is never a choice. No country helplines are shipped: the numbers cannot be verified from the sources the project may use, so every help line points to the international directory (findahelpline.com) until Roman supplies verified lines.
- **The event set.** 167 events across the stages with 35 decisions (at least five at every stage from 6), ten money shocks, 25 data notes and 37 events about named people, 14 of them about friends. A typical life sees about one notable event a year, a decision about every six years and few repeats.
- **Streams.** New: `outcomes`, `care`, `friends`, `romance`, `fertility`. The newborn's marriage draw is drawn at the end of the `person` stream.
- **Review fixes (M5).** A student at tertiary level who takes the fees on (flag `tuition`) borrows each year's fees, authored at 0.4 of a year's middle-of-the-country income; one with a scholarship does not. Other costs on a decision card (care, a course) fall on the household of a child or a student and are not shown to them. The usual care's odds are shown at the level it sets (0), even for someone who had the best care. Possible partners get an id by age (`partner-<age>`), so one who dies before the wedding does not block the next. A life's replay input is the decision log, the plan log and the settings log (2.4); `planLog` and `settingsLog` are optional on `LifeState`. A settings change made while a decision waits is logged at the next age, because that year's events are already chosen. Fees are borrowed in each year the student starts in school, the last year of the course included, and stop once the studies end; a student's debt counts toward debt stress against the household's income, which weighs on the poorest students (an authored simplification). Content validation also requires that a decision has a choice that is always open, and no effects on the event itself.
- **Open for Roman:** other-sex partners only; the default pace ("quiet years" on, to confirm); no country-specific help lines; the authored numbers above.

Built in M6 (2026-10-25), where the end of a life, the summary and the saves settled these details. None of the numbers named "authored" is a published statistic and none is shown as one.

- **Death.** The record (`deathRecord`) adds the calendar year, the cause group, the stage of life, the keys of the closing passage and the comparison with life expectancy to the engine's age and cause. Thirteen cause groups; 13 normal and 13 softened passages and 7 stage lines are in `src/content/strings/death.ts`. The cause `maternal` (WHO) had no text and now has one.
- **The summary** is a pure function of the finished life and its country (`summarize`), plain data that the archive stores. Its rules (ring thickness 0.2 to 1, the order of the themes, the weights of the key moments, the threshold of 4 and the limits of 5 and 12, the 5-year "about the same") are authored and written out in 3.8.
- **What shaped a life** compares sources through the stat's own yearly filter rather than adding up the sizes of yearly changes, because stats track a norm that circumstances set: summing yearly changes would credit almost everything to chance. The neutral person it measures against (no traits, the middle household, a city, no job, no debt, no conditions, parents of closeness 50, an upper-middle-income country, so no care bonus or penalty) is authored. A player who keeps the default plan has almost nothing credited to choice, because the plan's effects are small by design (3.3); decisions with a choice of outcome carry the `choice` tag.
- **Year records** now carry `theme` and `drift` (the norm shifts by source and the random swing); `Turn` carries `drift` across a waiting decision. The drift record costs a few extra evaluations of the stat norms a year and draws nothing new from any stream.
- **Saves** are in 2.4. `LifeState` gained `startSettings` (the settings the life began with, which `settings` is `settingsLog` applied to) and `epitaph`. Version 1 is the first schema, so `MIGRATIONS` is empty; the machinery is tested with an invented older schema, and `tests/engine/save.test.ts` says so. A save of a newer schema is never deleted unasked.
- **Content version.** `CONTENT_VERSION` ("2026.10.2") is in `src/content/version.ts`. `tests/engine/content.test.ts` pins a fingerprint of the events and conditions as data (not their functions), so a change makes the test fail until the version is bumped and the pin updated.
- **Browser storage** uses `idb` for the archive; tests use `fake-indexeddb`. Storage that is missing or refuses writes never throws: the player is told when a life could not be saved. "Delete all local data" removes every `birthright:` key and the database.
- **Soft tellings of conditions.** The beginning and worsening of a sensitive condition (depression, cancer) now have a softer telling, used when softening is on. Chronic back pain, named in the M5 follow-up, is not tagged sensitive and needs none.
- **Streams.** None new: the drift record reads the `drift` stream a second time, from the same start.
- **Open for Roman:** the passages and shaping sentences are written in the game's voice but not yet read by you; the 5-year and threshold numbers above; whether a life that was saved and then loaded with other content should say so more loudly; the rings' colours and patterns once seen.

Life screen layout (2026-10-25).

- **Ledger C1 Compact chosen.** Roman chose "Ledger variant C1 Compact" from the mockup `birthright-ledger-variants.html`, kept in the project files (not in this repo), for the life screen (UI-004, UI-010). 360 px phones are dropped: the smallest phone is about 390 to 430 px, and the e2e phone project is 400 x 860. 1440 px is the floor for the wide layout. Windows 600 to 640 px tall must show the side columns without scrolling.
- **How it is built.** `LifeScreen` composes `LifeHeader`, `Ledger` (with `PlanWidget` as its tray), `YouColumn` and `AroundColumn`; the side columns' tabs are the kit's `Tabs`. Below 900 px (`useNarrow`, a `matchMedia` hook that is false where `matchMedia` is missing) the three parts are force-mounted tab panels under a fixed bar. The store derives what the screen shows (`lifeStrip`, `lifeRings`, `statBand`, `countryFacts`); the engine and the save format are unchanged.
- **Space.** A panel with more than about 8 relatives, or an unusually long list of conditions, may scroll inside its tab as a safety net. What is tested: `e2e/loop.spec.ts` plays one fixed life (the family it draws, up to age 30) and, at 1440 x 640 and 1440 x 600, opens every tab of both side columns, with and without a decision waiting, checking that neither the column nor the tab scrolls. What is only measured by hand: a crowded worst case (14 relatives, 3 conditions, the US comparison on, savings and debt) was measured on a temporary harness, since removed, and fitted at 600 px tall with about 3 px to spare in Money and Family; no committed test builds such a life, because the app cannot be started from a made-up one without engine changes. At 1300 px wide or less, or 700 px tall or less, the plan tray is an ordinary block between this year and the earlier ones; above both it is docked at the foot of the window. The side columns are as wide as the smaller of 18rem and 28% of the window, and the one-column layout starts at 56.25em (900 px at the usual text size, sooner when the reader's text is larger). (Update, M7: the Family tab now shows at most 8 people with a dialog for the rest, so it fits by construction; the Journal button and the Notes tab hold the journal, and the header is outside `<main>`. At the Larger and Largest text sizes the columns can still scroll, see the M7 notes below.)
- **Open for Roman (settled in M7, see below):** the header was inside `<main>` and the Journal button and Notes tab were a placeholder; `plan.intro` is read to screen readers but hidden from sighted players to save room; widths from 900 to 1439 px are best effort.

Built in M7 (2026-10-25), where the last screens, reflection and accessibility settled these details. None of the numbers named "authored" is a published statistic and none is shown as one.

- **Reflection prompts** (UI-007, `src/engine/reflection.ts`, `src/content/reflections.ts`): 23 prompts, each waiting for something that happened in a year and never for an age: the first loss and later losses of a parent, partner or child, a first condition, losing work, a wedding, meeting a partner, a first child, a grandchild, a new brother or sister, a move between countryside and city, retirement, school started, finished (once) and left, a first job, the first debt pressure, a first friend, and each of the six stages from childhood on. A year gets one prompt at most, the first that fits in the catalog's order (the most personal first); "first" prompts are offered once in a life. The year a person dies has none, and none is offered while a decision waits. Prompts are a pure function of the years lived, draw nothing from any random stream and do not change a replay. In lives played out by the auto-player about a quarter of the years offer one (authored by the catalog, not a target). "Leaving home" has no event in the game yet, so it has no prompt of its own (a move does). A decision answered is not a prompt: it came to every sixth year and crowded the others out.
- **The journal** is one single-line entry (at most 200 characters, tidied) for an age and a prompt, or a line of the player's own; writing the same again replaces it and an empty line removes it. It lives on `LifeState.journal` and in `SaveFile.journal`, both optional and absent when empty, so no schema change was needed: a test pins that an older save loads. A replay does not carry it (it is not input to the life), so `restoreLife` puts it back from the save. The summary and the archive keep it (`LifeSummary.journal`).
- **Display preferences** (`src/ui/display.ts`): theme (system, light, dark), text size (default, larger 112.5%, largest 125% of the browser's own size) and reduced motion (system, reduced, full) are kept in this browser under `birthright:theme`, `birthright:text-size` and `birthright:motion`, apply through attributes on `<html>`, and are not part of any save. Media queries in em follow only the browser's own text size, not the setting, so at 125% a short window may rely on the side columns' scroll safety net.
- **Accessibility.** One live region on the life screen announces the year, its events and, in words hidden from sight, the stats that moved by 3 points or more (authored). Colour contrast is checked from the style sheets (WCAG AA). The whole loop is played with the keyboard alone by `e2e/keyboard.spec.ts`. Not verified: screen readers (NVDA, VoiceOver) and browsers other than Chromium.
- **Layout.** Every screen renders through one shell (`Page`) with the header outside `<main>`, which settles the landmark question left open in the layout notes above. A large family shows 8 people in the Family tab, with a dialog for everyone (authored). The household sentence on the birth screen now reads "Of all the households in {country}, yours is in the {band}", and a first child is told "You have no older brothers or sisters" because siblings who died before the birth are not listed.
- **Text size and the side columns.** At the Larger (112.5%) and Largest (125%) settings the side columns can need more than a 640 or 600 px tall window in some tabs (Money, Notes, School & work, and a large family), and the panel then scrolls inside itself (the safety net; there is no horizontal scroll and nothing becomes unreachable). The text-size setting scales rem, but media queries in em follow only the browser's own size, so the layout does not switch to one column sooner. The 640/600 rule is tested at the default size only. This is a limit to confirm with Roman: either accept it, or make the narrow layout and the plan tray follow the setting.
- **Back navigation (UI-001).** The game has no router (6): every screen has a Back or "Back to start" inside the page, and the browser's own Back button leaves the site. Whether the browser Back button should step through the game's screens is open for Roman.
- **A prompt marked "first"** is used up only when it was actually offered, so one outranked by a more personal prompt in its year comes at its next turn.
- **Birth reveal (UI-016, 2026-10-26).** Roman chose concept A, "the turning line" (2026-10-25). Authored, not statistics: 6 to 10 passing countries drawn by births per year from their own `reveal` stream (the country itself is drawn first from `birth`, so the reveal never changes a life), names that stay 340 ms rising to 900 ms, about 6 s in all, the "1 in N" figure rounded to the nearest whole number over the countries in the game. Timed in CSS only (TIME-001). Not decided: a setting to skip it (UI-009) and whether the chance line should show on every birth screen, not only under reduced motion.
- **Distinct names (CHAR-007, 2026-10-27).** The person, the parents, every sibling, friend, partner and child take names that no living relative or the person already has, compared without regard to case or sex (`src/engine/names.ts`). The roll the code already drew points at a name in the region's list; if that name is taken the next free one is used, wrapping at the end. No stream gains a draw, so the other rolls do not move, and a life with no clash keeps every name it had. Names are reserved against relatives that the same year's events are about to add (a friend, a baby and a person met in one year), and a person met who is declined or never answered still has a name that was free when they appeared. The dead free their name (a child may be named for a lost grandparent), and a sibling who did not live takes none. Because a replay of an older life that had a clash names someone differently, `CONTENT_VERSION` went to 2026.10.2; a saved snapshot is still trusted over a replay, so lives in progress keep their names and later relatives are chosen without clashes. Tested by `tests/engine/distinctNames.test.ts` over 12 countries covering the name groups (every year of 25 lives each, and the questions that wait).
- **Deploy.** Every merge to main runs `deploy.yml` (tests, build, upload, deploy to GitHub Pages under `/life-simulator/`); runs 9 to 13 were green.
- **Open for Roman:** the 23 prompts and the eyebrow "A pause" are authored and unread by you; the 3-point threshold for announcing a stat; the text-size limit and browser Back button above; the cap of 8 people; the journal button reading "Read the line in full" from the first line; the household wording; the authored closing passages and shaping sentences from M6 are still unread; and screen-reader checks with a real reader.
