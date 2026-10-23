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
| **Driftwood** (recommended) | A life is carried by currents it did not choose (birthplace, family, history) and steered a little by the one riding it. Short, memorable, no numbers, nothing like the reference's framing. Pairs naturally with the visual idea of growth rings (1.3). |
| **Growth Rings** | Every year leaves a ring; the finished life is a cross-section you can read. Very visual, slightly descriptive. |
| **The Long Year** | Literary; each turn is a year, and a life is one long year seen from far away. |
| **Ledger of Days** | A life as an account book of gains and losses; fits the money and odds mechanics, a bit colder. |
| **Undertow** | Emphasises the hidden pull of circumstance; darker in tone. |

All five are working titles. Before we commit, we should do a quick search for existing games and trademarks with the chosen name.

### 1.2 Tone and voice

- **Second person, present tense, short.** "You are four. The well is an hour's walk; your sister carries the water now, and soon you will."
- **Literary but plain.** Concrete images over adjectives. No melodrama, no jokes at a character's expense.
- **Grounded in numbers, gently.** When the data matters, the game says so in one quiet line with its source: "Here, about 1 in 14 children die before age five (UN WPP 2024)." Numbers explain, they do not lecture.
- **Hard things are named, not shown.** Death, violence, suicide and abuse are stated honestly and briefly, never described graphically. Each is followed by a pause and, where relevant, a help resource.
- **No score, but real stakes.** The game never ranks lives. Depth comes from systems the player can learn to read (see 3.3, the odds lens) rather than from points.

### 1.3 Visual direction

- **Core motif: growth rings.** The life is drawn as a tree cross-section that grows one ring per year. Ring thickness reflects how good the year was (wellbeing), colour reflects the year's dominant theme (study, work, love, loss, illness, migration), and marks on a ring show key events. The final cross-section is the summary image and the shareable card. This is our signature and has nothing in common with the reference's look.
- **Palette:** warm paper background, ink-dark text, muted natural colours for themes (moss, ochre, river blue, rust, slate). A proper dark mode ("night paper").
- **Type:** a readable serif for narrative text, a clean sans for numbers and controls. Generous line height, a 60 to 70 character column on desktop.
- **Layout:** one column on phones; on desktop the rings and stats sit on the left and the story column on the right.
- **Motion:** slow, small transitions (a ring growing, a card settling). Fully disabled under `prefers-reduced-motion`.
- **Art:** no illustrations of people in the MVP; the rings, simple line icons and typography carry the identity. This avoids stereotyped depictions of countries.

---

## 2. Data model

TypeScript is the source of truth for types. Everything below is a sketch to be refined during the build.

### 2.1 World data (built by the pipeline)

One compact JSON file per country, plus a small index file. Every indicator carries its source and year.

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
    wellbeing: number;          // mood and meaning combined
    bonds: number;              // quality of close relationships
    skills: number;             // education plus practical know-how
  };

  money: {
    householdPercentile: number;   // 1..100 within the country distribution
    savings: number;               // PPP$
    debt: number;                  // PPP$
  };

  education: { level: "none" | "primary" | "lower-secondary" | "upper-secondary" | "tertiary"; inSchool: boolean };
  work: { status: "child" | "student" | "employed" | "informal" | "unemployed" | "caregiver" | "retired"; sector?: Sector; incomePercentile?: number };
  location: "rural" | "urban";

  relationships: Relationship[];
  conditions: Condition[];      // chronic illness, disability, addiction; each with severity
  flags: Record<string, number | boolean>;  // story memory: "lost_sibling", "moved_abroad", ...
  journal: JournalEntry[];      // the player's own notes and reflections
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

- **localStorage** `driftwood:current` holds the life in progress (small).
- **IndexedDB** `driftwood` / `pastLives` holds finished lives (the archive can grow).

```ts
interface SaveFile {
  schemaVersion: 1;
  dataVersion: string;      // world data used
  contentVersion: string;   // events and text used
  seed: string;             // e.g. "amber-river-4821"
  settings: { softening: "off" | "on"; pace: "every-year" | "quiet-years" };
  decisions: { year: number; eventId: string; choiceId: string }[];   // the full player input log
  snapshot: Person;         // latest state, so loading is instant
  createdAt: string; updatedAt: string;
}
```

The **seed plus decision log** is the real save; the snapshot is a cache. If the snapshot fails to load (or a migration is missing), the engine replays the life from seed and decisions. Saves are written after every resolved turn, so closing the tab never loses more than the current screen. Export and import as a JSON file are cheap to add once this exists.

---

## 3. Simulation engine

The engine is a pure TypeScript module with no DOM access, so it can be tested and run headless. The UI calls `advance(state, input)` and renders what comes back.

### 3.1 Time steps

- **One turn is one year.** Turn-based: nothing happens until the player acts.
- **Event-driven pacing:** a year with no decision and no notable event is a "quiet year". With the default pace setting, quiet years are batched ("Three quiet years pass. You learn to read.") so the game moves fast through calm stretches and slows down at turning points. The player can switch to "every year".
- **Life stages** group years into chapters: infancy (0 to 2), childhood (3 to 11), adolescence (12 to 17), youth (18 to 29), adulthood (30 to 49), midlife (50 to 64), elder (65+). Stage changes are natural reflection points.

### 3.2 Order of one year

```
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

### 3.3 Player agency: the yearly plan and the odds lens

This is where the "in-depth game feeling" comes from.

- **Yearly plan.** From age 6, each year the player spends a small budget of focus points (three by default) across **Learn, Earn, Care (for others), Bond (relationships), Rest (health)**. Circumstances can take points away: a child who must work loses a point to Earn, a caregiver to Care, an ill person to Rest. That makes poverty and duty felt in play, not just described.
- **Decisions** at turning points (school, work, partner, children, migration, treatment, crises). Options can be hidden or locked by money, education or local conditions, and the game says why ("There is no secondary school within reach").
- **The odds lens.** Before confirming a decision, the player can see roughly how each option shifts the odds of what matters ("Leaving for the city: steady work about 4 in 10, up from 2 in 10. Health risk higher."). Numbers are shown in plain words and in bands, not decimals. This is the main difference from the reference, where choices can feel cosmetic: here the player learns that choices shift odds, and how much the starting point limits that shift.

### 3.4 Event selection

1. Build the candidate list: every event whose stage and conditions match and whose `once` and cooldown rules allow it. Remove events above the softening threshold if softening is on (statistical deaths still happen, but are told more briefly).
2. **Statistical events** are rolled independently, each against its own probability from world data (for example, the yearly chance of marriage at this age, sex and country).
3. **Narrative events** are drawn from weighted pools. Weight = base × modifiers (traits, stats, flags, world indicators). One draw from the major pool (if any qualifies, with a pacing rule that guarantees a major event at least every few years) and up to two from the minor pool.
4. Scheduled follow-ups (from earlier `schedule` effects) come first when due.

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

- Reflection moments come from **events**, not fixed ages: the first loss, leaving home, a child's birth, a migration, a diagnosis, retirement, and each life-stage change. Each offers a short prompt and an optional journal line saved to the life.
- At the end, the player may write an epitaph.

### 3.8 End of life and summary

- A closing passage, the cause and age of death, and where that sits against the country's life expectancy.
- **The cross-section**: the full growth-ring image of the life.
- **Key moments**: a short timeline of the most significant years.
- **Chance, choice and circumstance**: a breakdown of what shaped this life, built from the effect tags (2.3). For example: "Most of your health came from where you were born; most of your bonds came from your choices."
- **Your notes**: the journal entries and the epitaph.
- Post-MVP ideas, our own take on comparison: **"The other shore"** (the same seed and traits, born in a different country) and **"The road not taken"** (replay from a past decision and change it).

### 3.9 Randomness and replay

- **Seed:** a readable string (three words or two words plus digits), stored with the life and shown on the summary.
- **PRNG:** a small, fast, well-tested generator (sfc32 or similar), seeded by hashing the seed string (cyrb128-style hash). No `Math.random()` anywhere in the engine; a lint rule enforces it.
- **Independent streams:** each subsystem draws from its own stream derived from `hash(seed, stream name, year)`: `birth`, `family`, `mortality`, `events`, `outcomes`, `money`, `names`. Adding a new event to the content therefore does not change when someone dies, and replays stay stable across small content updates.
- **Replay guarantee:** the same seed, data version, content version and decision log always produce the same life. Tested directly (same inputs, identical history, run many times).
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

- **Stack:** Vite, TypeScript, no UI framework (small render helpers over the DOM), Vitest, GitHub Pages. Same as Roman's defaults.
- **Layout of the repo:**

```
scripts/data/      pipeline: download, clean, fill gaps, write public/data/*.json
public/data/       baked world data (committed, versioned)
src/engine/        pure simulation: rng, world, person, events, effects, mortality, money, replay
src/content/       events, names, text (English)
src/ui/            screens: start, life, decision, reflection, summary, past lives, settings
src/save/          localStorage and IndexedDB adapters, migrations
tests/             engine tests, replay tests, calibration tests
```

- **Data size target:** under 15 KB gzipped per country, loaded on demand.

## 7. Open questions for Roman

1. **Name:** do you like Driftwood, or one of the other four, or none?
2. **Yearly plan:** is the focus-points system (3.3) the depth you want, or should yearly input be lighter?
3. **Country set for the MVP:** all countries with complete data (likely 150+), or a curated 20 to 30 to start, with more content per country?
