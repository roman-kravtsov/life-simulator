# Phase 1: Analysis of the reference game (1 in 8 Billion)

## Read this first: how this analysis was produced

The brief asked for several played-through lives. **That was not possible in this environment.** The sandbox blocks direct browser/HTTP access to 1in8b.life (the proxy returns 403), and the only access route was a text-extraction fetch of the static landing page plus press and blog write-ups. The game itself is a JavaScript app that needs live interaction.

So every "Observed" entry below means **documented**: stated on the landing page or reported by an article that played it. It does **not** mean directly seen by us. Anything about screens, layout, pacing, mobile behaviour, the death screen and the summary is either marked *not documented* or labelled inference. Roman, if you play 3 to 5 lives and send notes or screenshots (different countries, one auto-mode run, one phone run), I will convert the inferred rows into observed ones.

Sources: the landing page (https://1in8b.life/en/) and write-ups at bnext.com.tw, foxcg.com and realsound.jp. Nothing here copies the reference's text, art, code or data.

Legend for the tables: **Doc** = documented by site or press, **Inf** = our inference, **Prop** = what we will build.

---

## 1.1 Product structure

| Part | What the player sees and does | Connects to | Status |
|---|---|---|---|
| Landing page | Single scrolling page. Title, short pitch (a handful of babies are born every second and you become one), two live counters (births and deaths since the page opened), then setup controls, explanatory sections, footer. Version badge, "free, ages 15+", language links (13 languages). | Setup controls sit on the same page and lead straight into a life. | Doc |
| Game setup | Four choices: era (past, today, future, any), how the country is drawn (weighted by annual births, or by current population), life length (about 30 min, 1 h, 1.5 h), and an optional "country you were really born in" for later comparison. Plus toggles for calm music and for leaving out frightening scenes. One "be born" button starts with defaults. | Feeds birth generation and the clock speed. | Doc |
| Birth generation | Country is random and cannot be chosen. Country, sex, name and parental finances are revealed only after starting. Every life starts at age 0. | World data (172 countries). | Doc |
| Character creation | None in the usual sense. The player does not build a character; the character is dealt. | n/a | Doc (absence) |
| Simulation loop | Real-time clock: roughly 40 to 60 seconds per simulated year at baseline, pause and speed-up available. | Yearly progression. | Doc |
| Yearly progression | Each year the player picks a focus (study, work, family, health). Time advances automatically between decisions. | Stats, events, decisions. | Doc |
| Decisions | Offered at milestones: continue school or start work, job category, dating, marriage, children, optional pet, home purchase, emigration, medical treatment. | Education, career, relationships, money, health. | Doc |
| Random events | Hardships and good turns at statistical rates: child death, child marriage, conflict, disease, losing schooling, debt after a disaster. Not graphic; help resources shown for sensitive topics. | Country, age, sex data. | Doc |
| Character stats | Four values: health, happiness, knowledge, relationships. Feed into the ending. Income and wealth also shown (in purchasing-power dollars and at US prices). | All systems. | Doc |
| Relationships | Dating, marriage, children, family. Relationship is one of the four stats. | Decisions, happiness. | Doc (detail Inf) |
| Education | Continue or leave school; schooling levels follow country data; knowledge stat. | Career, income. | Doc |
| Career | Choose a job category; employment rates follow country data. | Income. | Doc |
| Finances | Income drawn from the country's income distribution (Gini-based), shown in two currencies of comparison. Debt exists. | Career, events. | Doc |
| Health | Health stat; medical care is a decision; sex-specific life tables set lifespan; causes of death follow WHO/GBD-style regional and age patterns. | Death. | Doc |
| Death | Life ends at a lifespan drawn from statistics. Suicide is a modelled event from adolescence, without method detail. | Summary. | Doc |
| End-of-life summary | The player can leave a farewell message to the character. A side-by-side with four other people born in the same second is shown. No scores or rankings. Exact layout not documented. | Memorials, sharing. | Doc (layout not documented) |
| Past lives | "Memorials": lives are stored in the current browser only; can browse your own, visit others', or meet a random life. | Persistence. | Doc |
| Sharing | Players widely post results on social media. A built-in share feature is not documented. A posting feature exists (it is disabled in classroom mode). | Summary. | Partial |
| Persistence | Memorials stored in the browser; the optional "real birth country" stays on the device. Whether an in-progress life is saved is not documented. | Settings. | Partial |
| Settings | Life length, calm music, soften scary scenes, language, auto mode (top bar, under a menu on phones). | Everything. | Doc |
| Accessibility | Not documented. | n/a | Not documented |
| Localization | 13 languages including Korean, Japanese, two Chinese scripts, Vietnamese, French, Thai, Spanish, German, Portuguese, Russian, Turkish. | All text. | Doc |
| Content warnings | Page states death, violence, suicide, poverty, addiction and similar occur at realistic rates, not shown graphically; age 15+ recommended; a softening toggle; classroom mode withholds heavier themes. | Events. | Doc |
| Game speed | Pause and speed-up; total length picked at setup. | Clock. | Doc |
| Auto mode | Lets the game decide while you watch, with a yearly focus still selectable; major decisions can still be made by the player. | Decisions. | Doc |
| Pause and resume | Pause exists. Reflection pauses at ages 5, 15, 30, 50, 70, each with one question and an optional note. Resume after leaving the page is not documented. | Persistence. | Partial |

Extras worth noting: the "born in the same second" peers, the live birth/death counters, a data-sources section explaining which real indicators drive the sim, classroom mode, a beta/feedback link, an Add-to-Home-Screen prompt.

---

## 1.2 Game mechanics

Classes: D deterministic, P probabilistic, R random, PC player-controlled, S state-dependent, C country-dependent, A age-dependent, E event-driven.

All "Probability or logic" and "Implementation" cells are inference unless the source documents them. For our game we use **invented, plausible numbers in our own data files**, not the reference's data.

| Mechanic | Class | Input | State affected | Probability / logic (inferred) | Output | Dependencies | Our approach |
|---|---|---|---|---|---|---|---|
| Birth draw | R, P, C | Era and weighting setting | Country, sex, name, family wealth | Weighted random pick over countries (by births or by population); sex roughly 50/50 with regional skew; family wealth drawn from the country's income distribution | "Born" reveal screen | World data | Seeded weighted pick over our own small world table |
| Clock | D, PC | Speed setting | Time | Fixed real seconds per year, scaled by chosen life length / life expectancy | Year counter | Life expectancy | Turn-based by default; optional timer later |
| Yearly focus | PC | Player choice | Knowledge, income, relationships, health | Focus nudges stat deltas for the year | Stat changes | Stats | Focus gives weighted modifiers, never guaranteed outcomes |
| Education path | PC, S, C, A | Age, country schooling data, family wealth | Knowledge, future income | Chance of access/completion depends on country and family; effort improves odds but is capped | School milestones, dropouts | World, family | Staged: primary, secondary, higher, with gate checks |
| Career | PC, S, C, A | Education, job category, local employment | Income, happiness | Job availability from employment rate and education; income scaled from country distribution | Job titles, pay | Education, world | Job table by sector with country multipliers |
| Income / wealth | S, C, P | Job, country, events | Money | Draw from a skewed distribution (Gini-like) plus yearly noise and shocks | Money figures | Career | Log-normal-style draw in our own tables |
| Relationships | PC, P, A | Age, traits, choices | Relationships, happiness | Meeting, dating, marriage chances by age and country norms | Partner, children | Events | Simple relationship objects with a quality value |
| Health and illness | P, S, A, C | Age, health, care access | Health | Yearly illness hazard rises with age and falls with care access | Illness events | World, money | Hazard-rate model |
| Mortality | P, A, C, S | Age, sex, health, region | Death | Yearly death probability from life-table-like curve, shifted by health and events; cause drawn from age/region weights | Death and cause | Health | Hazard curve per region, cause weights |
| Random events | P, E, S | Age, state, country tags | Many | Weighted pool filtered by conditions | Event cards | Everything | Data-driven events with conditions and weights |
| Decisions | PC, E | Milestone triggers | Many | Options carry effects, some with success odds | Choice cards | Events | Same event schema with choices |
| Reflection pauses | D, A | Ages 5, 15, 30, 50, 70 | Optional note only | Fixed ages | Prompt | Persistence | Our own set of pause ages and prompts |
| Peers born together | R | Same draw | none | Extra lives simulated in parallel | Comparison | Engine | Post-MVP: simulate 1 to 4 peers from the same seed family |
| Auto mode | PC | Toggle | none | Engine picks defaults/random | Hands-off play | Decisions | Policy function that chooses options |
| Content softening | PC | Toggle | Event filter | Skips or rephrases flagged events | Gentler run | Events | Per-event `sensitivity` tag |

---

## 1.3 UX

Mostly **not documented**; below is what the sources support and what we infer. Treat the inferred items as hypotheses to confirm by playing.

| Aspect | Documented | Inference |
|---|---|---|
| Information hierarchy | Four stats plus money; age and country are central | Age/country/name on top, stats in a compact panel, events in a log |
| Navigation | One landing page; top bar with language, auto mode, menu on phones | Very shallow: landing, life, ending, memorials |
| Pacing | 40 to 60 s per year; 30/60/90 min lives | Long, contemplative; pauses create breathing room |
| Interaction patterns | Yearly focus, milestone choices, pause/speed | Few taps, mostly watching |
| Feedback | Stat changes, events | Text log plus stat changes |
| Visual hierarchy | Large title with emphasised "1" | Text-forward, minimal art |
| Mobile | Menu collapses to a "more" menu on phones; Add to Home Screen | Mobile-first layout |
| Desktop | Not documented | Same layout, wider |
| Progression | Age 0 to death; no score or rank | The statistics themselves are the point |
| Tension | Hardships arrive quickly; choices don't change fate much | Unfair starts create tension |
| Reflection | Questions at 5/15/30/50/70, farewell note, peer comparison | Core of the emotional design |
| Replayability | Random country each time, peers, memorials, past/future eras | Different birthplace each run |

---

## 1.4 Simulation (conceptual flow)

```
World data (country statistics)
→ Birth draw (era, weighting, seed)
→ Person generated (country, sex, name, family wealth)
→ Initial state (age 0, stats, household)
→ Yearly tick, repeated:
     age +1
     → baseline hazards (illness, death) from age/sex/country
     → milestone check (school, work, marriage, children, move)
     → event selection (conditions + weights, filtered by softening setting)
     → player decision or auto policy
     → effects applied to stats, money, relationships
     → reflection pause at set ages
→ Death roll each year (cause drawn from age/region weights)
→ End-of-life summary (farewell note, peer comparison)
→ Saved as a memorial
```

At each stage the world data constrains outcomes, and player choices shift probabilities rather than setting results. That is the key design idea documented across the sources.

---

## 1.5 Observed vs. inferred vs. proposed

"Observed" here = documented by site or press (see the caveat at the top).

| System | Observed (documented) | Reasonable inference | Our proposed implementation |
|---|---|---|---|
| Birth | Random country from 172, two weighting modes, era choice, sex/name/finances revealed after | Weighted sampling from a country table | Seeded weighted pick over ~20 invented-data countries, era fixed to "today" in MVP |
| Character | Dealt, not built | Traits may be minimal | Small trait set (e.g. temperament, aptitude, resilience) rolled at birth, so lives differ beyond country |
| Clock | Real time, pause, speed, life length setting | Seconds-per-year derived from life expectancy | Turn-based "next year" with optional auto-advance |
| Yearly focus | Study, work, family, health | Focus modifies yearly deltas | Same four idea slots but our own naming and effect sizes |
| Decisions | Milestone choices; outcomes bounded by country | Choices shift odds only | Choices with effects and risk; capped influence of effort |
| Events | Realistic-rate hardships; softening toggle | Conditional weighted pool | Data-driven events with tags, conditions, weights |
| Stats | Health, happiness, knowledge, relationships; money in two measures | Simple 0 to 100 style meters | Our own stat set plus money; defined in design.md |
| Education/Career | Choices and country-based outcomes | Gate checks by country and wealth | Staged education, sector-based careers |
| Mortality | Sex-specific life tables; cause from region/age patterns | Hazard by age with cause weights | Hazard curves in our own data |
| Reflection | Pauses at 5/15/30/50/70, optional note | Fixed triggers | Own prompts, optional journal |
| Summary | Farewell note, peers side by side, no score | Text timeline | Timeline, key moments, stat curves, comparison with peers (post-MVP) |
| Persistence | Memorials stored in browser | localStorage | Versioned saves, in-progress resume, past-lives list |
| Sharing | Social posting by players; built-in unclear | Probably screenshots or links | Copyable text card, no accounts |
| Localization | 13 languages | Text in string tables | English MVP, string keys from day one |
| Auto mode | Hands-off with optional yearly focus | Policy picks | Policy function |
| Accessibility | Not documented | Unknown | Keyboard, reduced motion, screen-reader labels from the start |

---

## 1.6 Originality notes

**Do differently or better**
- Give the character **traits and a personality**, not just a country, so two people from the same place diverge.
- Make **choices matter visibly**: show which odds your choice changed, instead of leaving the player feeling choices are cosmetic.
- Offer **turn-based play by default** with an optional timer; real-time pacing at 40 to 60 s per year is slow for many players.
- Add **resume of an in-progress life**, which is not documented for the reference.
- Build **accessibility** in from the start (keyboard, contrast, reduced motion, screen readers).
- Use an **in-game seed** so a life can be replayed or shared exactly.
- Keep content warnings and a softening mode, but put them in an upfront, clear setup step.

**Avoid (too close to the reference)**
- The name, the "1 in N" framing, the exact "born in the same second" peer gimmick as the main hook, and the live birth/death counters.
- The same reflection ages (5/15/30/50/70) and same setup options in the same wording; choose our own ages and prompts.
- The same four stats under the same names; vary the model.
- The "172 countries / real statistics" claim and any of their data tables, text, or layout.
- Real-time clock numbers (40 to 60 s per year) and life-length presets (30/60/90 min) copied one for one.
- Their visual identity (large title with an emphasised first character).

**Legal and ethical:** use invented or clearly attributed public data only; do not scrape the reference; write all text ourselves; keep sensitive topics non-graphic with help resources.

---

## Decisions from Roman's review (2026-10-23)

- **Real statistics**, not an invented world. Sources are in 1.7.
- **Turn-based / event-based** pacing, no real-time clock.
- **Sensitive content is in scope** (child death, suicide, war, violence), non-graphic, with a softening toggle and help resources.
- **Tone:** reflective and literary, with an in-depth game feel (systems that reward understanding, not just a story).

These override the "invented data" and "turn-based by default with optional timer" proposals above.

---

## 1.7 Where to get the real numbers

Approach: a build-time **data pipeline** (a script in the repo) downloads the raw files from each source, picks the indicators we need, fills gaps with regional averages, and writes small versioned JSON files the game loads. Every value keeps its source and year, and an in-game "Sources" screen lists the attributions. We never copy the reference's data; we go to the primary publishers.

Licence status: **Verified** = read on the publisher's page during this research. **To verify** = my understanding, to confirm before we ship.

| Need in the game | Primary source | What we take | Licence | Status |
|---|---|---|---|---|
| Births per country (birth draw), population, life expectancy, life tables by age and sex (yearly death risk), fertility (siblings, own children), infant/child mortality | **UN World Population Prospects 2024** (UN DESA), [population.un.org/wpp](https://population.un.org/wpp/) | Abridged or single-age life tables (qx by age, sex), annual births, TFR, under-5 mortality | CC BY 3.0 IGO | To verify (the dataset page itself does not state it) |
| Income distribution (family wealth at birth, adult income draws) | **World Bank Poverty and Inequality Platform, percentiles** ([data catalog](https://datacatalog.worldbank.org/search/dataset/0063646/poverty-and-inequality-platform-pip-percentiles)) | 100 percentiles of daily income/consumption per country, in PPP$ | CC BY 4.0 | Verified |
| GDP per capita, poverty rate, urbanisation, health spending, out-of-pocket health costs, access to electricity/water, internet | **World Bank World Development Indicators** ([data.worldbank.org](https://data.worldbank.org)) | Country-year indicators | CC BY 4.0 | To verify (standard WDI terms) |
| School enrolment, completion, literacy, years of schooling | **UNESCO Institute for Statistics** ([bulk download](https://databrowser.uis.unesco.org/documentation/bulk)), plus the same series mirrored in WDI | SDG 4 indicators by level and sex | CC BY-SA 3.0 IGO (UIS) / CC BY 4.0 via WDI | To verify; prefer the WDI mirror if share-alike is a problem |
| Employment, unemployment, sector of work, informal work, child labour, wages | **ILOSTAT** ([bulk download](https://ilostat.ilo.org/data/bulk/)) | Labour-force rates by age and sex, employment by sector | CC BY 4.0 | To verify (bulk page states no licence) |
| Causes of death by age, sex, region; disease incidence; suicide rates | **WHO Global Health Estimates / Global Health Observatory** ([terms](https://www.who.int/about/policies/publishing/data-policy/terms-and-conditions)) | Cause-of-death shares by age band and sex | WHO's own terms: free use **for public health purposes**, attribution required, not for promoting a commercial product | Verified (restrictive) |
| Same, more detailed (cause, injury, disability, risk factors) | **IHME Global Burden of Disease** ([GHDx](https://ghdx.healthmetricsandevaluation.org/gbd-2021)) | Cause-specific death rates | **Non-commercial only** (IHME free-of-charge non-commercial agreement) | Verified (restrictive) |
| Marriage age, share married, child marriage | **UN World Marriage Data** (UN DESA) and UNICEF child-marriage data | Mean age at first marriage, % married by 18 | UN DESA open terms; UNICEF data terms | To verify |
| Armed conflict and conflict deaths by country and year | **UCDP** (Uppsala Conflict Data Program, [ucdp.uu.se](https://ucdp.uu.se)) | Conflict presence and intensity per country-year | CC BY 4.0 | To verify |
| Migration (moving abroad) | **UN DESA International Migrant Stock** | Emigration shares and main destinations | UN open terms | To verify |
| Life satisfaction | **World Happiness Report** country averages (data from Gallup World Poll) | Country-average life evaluation only | Gallup microdata is proprietary; published country averages need a terms check | To verify, possibly skip |
| Convenience layer | **Our World in Data** ([ourworldindata.org](https://ourworldindata.org)) | Cleaned, merged series with documented provenance | CC BY 4.0 for OWID's own work; the underlying source's licence still applies | Use as a cross-check, not a source |

### The licence issue to decide

Everything except health causes-of-death has open, attribution-only licences. **Cause-of-death data is the problem:** WHO limits use to public-health purposes and bars commercial promotion, and IHME GBD is non-commercial only. That is fine for a free, non-commercial, educational game. If the game might ever earn money (ads, paid tier, store release), we should either ask WHO/IHME for permission or derive cause-of-death mixes from openly licensed sources (UN WPP gives overall mortality; cause mix could come from WHO only with permission).

### Practical notes

- **Coverage:** WPP covers ~237 countries and areas. Income percentiles and labour data are thinner, so we will need regional fallbacks and a "data year" per indicator. Start with a curated set of countries and widen later.
- **Size:** keep the shipped data small (one compact JSON per country, loaded on demand) so the game stays fast on phones.
- **Honesty in the game:** show the source and year when the game cites a number (for example "1 in 14 children here die before age 5, UN WPP 2024").
- **Reproducibility:** the pipeline pins source versions and records download dates, so data updates are deliberate PRs.

---

## Open questions for Roman

1. Can you play 3 to 5 lives and share notes or screenshots so we can upgrade inferred rows to observed? (Ideal mix: one rich country, one poor, one auto-mode, one phone.)
2. ~~Will the game stay free and non-commercial?~~ **Answered 2026-10-23: yes, free and non-commercial.** WHO GHE/GHO and IHME GBD cause-of-death data can be used under their non-commercial terms, with attribution, and with no WHO/IHME logos or implied endorsement.
