# Birthright: feature inventory

This is the project's source of truth. Every piece of work traces back to a feature here. It is derived from `docs/analysis.md` and `docs/design.md`.

**Priority:** P0 (must have), P1 (should have), P2 (nice to have), P3 (later)
**Complexity:** S, M, L, XL
**Scope:** MVP, post-MVP. The MVP line is set in `docs/mvp.md` (confirmed 2026-10-23). The order and priority of post-MVP work is in `ROADMAP.md`.
**Status:** not started, in progress, done, dropped (with the PR link once one exists)

IDs are a category prefix plus a three-digit number. They never change and are never reused, even when a feature is dropped. New features get the next free number in their category.

Design references like (3.3) point to sections of `docs/design.md`.

---

## Core simulation (SIM)

| ID | Name | Description | Priority | Dependencies | Complexity | Scope | Status |
|---|---|---|---|---|---|---|---|
| SIM-001 | Engine core | A pure TypeScript engine with no DOM access: `advance(state, input)` returns the new state and what to show. Done when the engine runs headless in tests and the UI only calls this API. | P0 | RNG-001 | M | MVP | done ([#5](https://github.com/roman-kravtsov/life-simulator/pull/5)) |
| SIM-002 | Yearly turn order | Runs one year in the fixed order of design 3.2: ageing, plan, drift, statistical checks, events, decisions, effects, mortality, record. Done when a life runs from birth to death with no player input and every step is covered by a test. | P0 | SIM-001, SIM-005, SIM-006 | L | MVP | done ([#11](https://github.com/roman-kravtsov/life-simulator/pull/11), [#15](https://github.com/roman-kravtsov/life-simulator/pull/15)): the yearly turn runs plan, events, decision and ageing, and stops for the player at a decision |
| SIM-003 | Life stages | Groups years into infancy, childhood, adolescence, youth, adulthood, midlife and elder (3.1). Events and prompts can target stages. Done when every year has a stage and stage changes are recorded in history. | P0 | SIM-001 | S | MVP | done ([#5](https://github.com/roman-kravtsov/life-simulator/pull/5)) |
| SIM-004 | Baseline stat drift | Each year stats move a little towards age- and country-dependent norms (health declines with age, skills grow in school). Done when drift curves are data-driven and tested for each stage. | P0 | SIM-002, CHAR-004 | M | MVP | done ([#11](https://github.com/roman-kravtsov/life-simulator/pull/11)) |
| SIM-005 | Statistical checks | Rolls yearly probabilities taken straight from world data (marriage, childbirth, school continuation, job loss and so on). Done when each check reads its indicator from country data, uses its own RNG stream, and a batch test reproduces the source rate within tolerance. | P0 | WORLD-002, RNG-002 | L | MVP | done ([#11](https://github.com/roman-kravtsov/life-simulator/pull/11), [#14](https://github.com/roman-kravtsov/life-simulator/pull/14), [#15](https://github.com/roman-kravtsov/life-simulator/pull/15)): family deaths, child labour, sibling births, schooling, work entry, conditions, marriage, childbirth and unemployment read country data, each with its own stream and a batch test |
| SIM-006 | Effects engine | Applies effects (stats, money, flags, relationships, conditions, schedule, education, work) with clamping, and tags each with circumstance, choice or chance (2.3). Done when every effect type is tested and tags are stored in history. | P0 | SIM-001 | M | MVP | done ([#5](https://github.com/roman-kravtsov/life-simulator/pull/5), [#14](https://github.com/roman-kravtsov/life-simulator/pull/14), [#15](https://github.com/roman-kravtsov/life-simulator/pull/15)): stat, flag, relationship, condition, money, schedule, education and work effects are in |
| SIM-007 | Calibration harness | Simulates thousands of lives per country headless and compares life expectancy, school completion, marriage age and income spread with the source data. Done when it runs in CI for a sample of countries and fails if life expectancy is off by more than 2 years. | P0 | SIM-002, HEALTH-002 | M | MVP | done ([#11](https://github.com/roman-kravtsov/life-simulator/pull/11), [#14](https://github.com/roman-kravtsov/life-simulator/pull/14), [#15](https://github.com/roman-kravtsov/life-simulator/pull/15)): life expectancy, school completion, literacy, labour participation, sector and informal shares, unemployment, marriage age, fertility, siblings and schooling persistence are calibrated (`npm run calibrate`) |
| SIM-008 | Zoom-in quarters | Crisis and turning-point years split into four quarterly turns according to triggers Z1 to Z12 and their limits (3.1.1). Done when every trigger is tested, the limits hold, and yearly totals of risk match the unzoomed year within tolerance. | P1 | SIM-002, TIME-003 | L | post-MVP | not started |

## Character (CHAR)

| ID | Name | Description | Priority | Dependencies | Complexity | Scope | Status |
|---|---|---|---|---|---|---|---|
| CHAR-001 | Person generation | Creates the person at birth: sex (from the country's sex ratio), name, birth year, country, rural or urban. Done when generation is seeded and deterministic and every field is shown on the birth screen. | P0 | WORLD-005, RNG-002, CHAR-002 | M | MVP | done ([#11](https://github.com/roman-kravtsov/life-simulator/pull/11)) |
| CHAR-002 | Name lists | Our own name lists per region and sex, written for the project, for the person and family. Done when every included country maps to a list with at least 40 names per sex. | P0 | WORLD-002 | M | MVP | done ([#11](https://github.com/roman-kravtsov/life-simulator/pull/11)) |
| CHAR-003 | Traits | Six hidden traits (temperament, curiosity, resilience, sociability, aptitude, constitution) rolled at birth, which shape drift, event weights and outcome odds. Done when every trait has at least one engine effect and tests show it changes outcomes. | P0 | CHAR-001 | M | MVP | done ([#11](https://github.com/roman-kravtsov/life-simulator/pull/11)) |
| CHAR-004 | Visible stats | Health, happiness, belonging and skills on a 0 to 100 scale (2.2). Done when they are clamped, recorded every year and shown on the life screen. | P0 | SIM-001 | S | MVP | done ([#5](https://github.com/roman-kravtsov/life-simulator/pull/5)) |
| CHAR-005 | Trait reveal | Traits are revealed in words as the player sees them act ("You have always been quick to anger"). Done when each trait has reveal texts and a reveal is triggered by relevant events. | P2 | CHAR-003, EVENT-001 | M | post-MVP | not started |
| CHAR-006 | Portrait | A simple, non-stereotyped abstract portrait or emblem per life. | P3 | UI-011 | M | post-MVP | not started |
| CHAR-007 | Distinct names | Names of people in one life are distinct: a new friend, partner, sibling or child never takes the name of a living relative or of the person. Found in the 2026-10-26 audit (`ROADMAP.md` D-001): 55% of sampled lives had two living relatives with one name. Done when a batch test over many lives and countries finds no living relatives sharing a name or the person's name, and the change is handled for replay (`CONTENT_VERSION`). | P0 | CHAR-002, FAM-001, REL-002, REL-003, FAM-002, FAM-004 | S | MVP | done ([#24](https://github.com/roman-kravtsov/life-simulator/pull/24)) |

## World/country (WORLD)

| ID | Name | Description | Priority | Dependencies | Complexity | Scope | Status |
|---|---|---|---|---|---|---|---|
| WORLD-001 | Data pipeline | Scripts that download pinned versions of UN WPP, World Bank PIP and WDI, UNESCO UIS, ILOSTAT, WHO GHE and GHO, and GDIM, and extract the indicators in design 2.1. Cause of death comes from WHO GHE only (Roman, 2026-10-24); IHME GBD is not used. Done when one command rebuilds all country files from scratch and records source versions and access dates. | P0 | none | XL | MVP | done ([#7](https://github.com/roman-kravtsov/life-simulator/pull/7)) |
| WORLD-002 | Country data files | One compact JSON per country plus an index, following the schema in design 2.1, with source and year on every value. Loaded on demand. Done when files validate against the schema and each is under 15 KB gzipped. | P0 | WORLD-001 | L | MVP | done ([#7](https://github.com/roman-kravtsov/life-simulator/pull/7)) |
| WORLD-003 | Completeness filter | Includes every country with all core indicators (life table, births, income percentiles, cause mix) and reports the excluded ones with reasons. Done when the report is generated by the pipeline and committed. | P0 | WORLD-001 | S | MVP | done ([#7](https://github.com/roman-kravtsov/life-simulator/pull/7)) |
| WORLD-004 | Regional fallback | Fills missing secondary indicators from the regional or income-group average and flags them as estimated. Done when every fallback value carries `estimated: true` and the game never cites an estimated value as a country fact. | P0 | WORLD-001 | M | MVP | done ([#7](https://github.com/roman-kravtsov/life-simulator/pull/7)) |
| WORLD-005 | Birth draw | Picks the birth country weighted by annual births across included countries. Done when a batch test of 100,000 draws matches the birth shares within 0.5 percentage points. | P0 | WORLD-002, RNG-002 | S | MVP | done ([#7](https://github.com/roman-kravtsov/life-simulator/pull/7)) |
| WORLD-006 | Population-weighted draw | Optional setting to draw by current population instead of births. | P2 | WORLD-005 | S | post-MVP | not started |
| WORLD-007 | Sources screen | In-game list of every source with publisher, licence, version and access date, plus the note on excluded countries. Required by the data licences. Done when every source used by the data files appears, and WHO/IHME terms are respected (no logos, no endorsement). | P0 | WORLD-002, UI-001 | S | MVP | done ([#7](https://github.com/roman-kravtsov/life-simulator/pull/7)) |
| WORLD-008 | Country panel | A short "where you were born" panel with a few key facts (life expectancy, schooling, income) and their sources. Done when it appears on the birth screen and is reachable during play. | P1 | WORLD-002, UI-003 | S | MVP | done ([#19](https://github.com/roman-kravtsov/life-simulator/pull/19)): "Where you were born" on the birth screen and the Country tab during play, each value with its source and year, estimated values left out |
| WORLD-009 | Rural and urban | Places the person in a rural or urban area based on the country's urban share; it affects schooling, work and health access. Done when it is used by at least education, work and health checks. | P1 | WORLD-002, CHAR-001 | M | MVP | done ([#14](https://github.com/roman-kravtsov/life-simulator/pull/14)): rural and urban children leave school at different odds (education), the sector and informality of work differ (work), and health, conditions and mortality carry the place |
| WORLD-010 | Conflict data | Country conflict level from UCDP, with war exposure, displacement and conflict deaths. Done when conflict affects mortality and events, and Z7 can trigger. | P1 | WORLD-001, EVENT-003 | M | post-MVP | not started |
| WORLD-011 | Past eras | Births in earlier decades using historical WPP data and historical events. | P3 | WORLD-001 | XL | post-MVP | not started |
| WORLD-012 | Future era | Births using WPP projections. | P3 | WORLD-001 | L | post-MVP | not started |
| WORLD-013 | Data update process | Documented steps to bump a source version, regenerate data and review differences in a PR. | P2 | WORLD-001 | S | post-MVP | not started |
| WORLD-014 | Method note | A "How this works" part of the sources screen that says which parts are published data and which are the game's own model, lists the authored assumptions (from `docs/design.md` section 7), and states how many births a year fall in the countries left out. Found in the 2026-10-26 audit (`ROADMAP.md` D-004). Done when the screen lists every authored assumption group, the data report gives the excluded countries' share of births, and the start screen's claim of "real odds" matches. | P0 | WORLD-007, WORLD-003 | S | MVP | done ([#26](https://github.com/roman-kravtsov/life-simulator/pull/26)): "How this works" on the sources screen names the seven groups of authored assumptions (no numbers, Roman 2026-10-28), the data report and the screen give the excluded countries' 3.9% of births, and the start and sources intros no longer claim "the real odds" or that every value has a source |

## Family (FAM)

| ID | Name | Description | Priority | Dependencies | Complexity | Scope | Status |
|---|---|---|---|---|---|---|---|
| FAM-001 | Parents | Generates mother and father (ages from mean age at birth, alive status, closeness). Done when parents appear on the life screen and in events. | P0 | CHAR-001, WORLD-002 | S | MVP | done ([#11](https://github.com/roman-kravtsov/life-simulator/pull/11)) |
| FAM-002 | Siblings | Generates older siblings at birth and younger siblings over time from the country's fertility. Done when sibling counts across a batch match the country's fertility within tolerance and siblings appear in events. | P1 | FAM-001, SIM-005 | M | MVP | done ([#14](https://github.com/roman-kravtsov/life-simulator/pull/14)): older siblings at birth and younger ones year by year, from the country's fertility (batch test within 12%); sibling arrivals and deaths are events |
| FAM-003 | Family ageing and death | Every family member ages and can die each year using the same life tables. Done when deaths are recorded, trigger grief events, and a batch test shows parents' death ages follow the life table. | P0 | FAM-001, HEALTH-002 | M | MVP | done ([#11](https://github.com/roman-kravtsov/life-simulator/pull/11)) |
| FAM-004 | Own children | Births to the person or partner from age-specific fertility, children's ageing and child mortality. Done when the number of children across a batch tracks country fertility and child deaths follow under-5 mortality. | P0 | REL-003, SIM-005, HEALTH-002 | M | MVP | done ([#15](https://github.com/roman-kravtsov/life-simulator/pull/15)) |
| FAM-005 | Caregiving duty | A sick parent, a young sibling or a child can take a focus point to Belonging (3.3). Done when the rule is tested and the plan screen says why the point is missing. | P1 | DEC-003, FAM-003 | S | MVP | done ([#15](https://github.com/roman-kravtsov/life-simulator/pull/15)) |
| FAM-006 | Inheritance | Money and debts passed on when parents die. | P2 | MONEY-004, FAM-003 | S | post-MVP | not started |
| FAM-007 | Grandchildren | Children's own children appear later in life. | P3 | FAM-004 | M | post-MVP | not started |
| FAM-008 | Family tree view | A visual tree of the family across the life. | P2 | FAM-004, UI-001 | M | post-MVP | not started |

## Relationships (REL)

| ID | Name | Description | Priority | Dependencies | Complexity | Scope | Status |
|---|---|---|---|---|---|---|---|
| REL-001 | Relationship model | Relationships with kind, name, age, alive and closeness (2.2); closeness changes with focus and events. Done when the model is tested and shown on the life screen. | P0 | SIM-006 | S | MVP | done ([#14](https://github.com/roman-kravtsov/life-simulator/pull/14)): closeness drifts toward a norm by kind and sociability and the effect language supports moving it (`relationship` effects, used by events from M5); shown on the life screen. Focus moves it too ([#15](https://github.com/roman-kravtsov/life-simulator/pull/15)) |
| REL-002 | Friends | Friends made through school, work and events; friendships fade without Belonging focus. Done when at least 8 events involve friends. | P1 | REL-001, EVENT-001 | M | MVP | done ([#15](https://github.com/roman-kravtsov/life-simulator/pull/15)) |
| REL-003 | Romance and partner | Meeting, dating and partnering, with odds by age, traits and focus. Done when partner formation odds are data-informed and the player can accept or decline. | P0 | REL-001, DEC-001 | M | MVP | done ([#15](https://github.com/roman-kravtsov/life-simulator/pull/15)) |
| REL-004 | Marriage | Marriage odds by age, sex and country (mean age at first marriage, child marriage by 18). Done when a batch test matches the country's mean marriage age within 2 years. | P0 | REL-003, SIM-005 | M | MVP | done ([#15](https://github.com/roman-kravtsov/life-simulator/pull/15)) |
| REL-005 | Separation and divorce | Relationships can end, with country- and state-dependent odds. | P1 | REL-004 | M | post-MVP | not started |
| REL-006 | Mentor | A teacher or elder who can change the course of an education or career. | P2 | REL-001, EDU-001 | S | post-MVP | not started |
| REL-007 | Domestic violence | Non-graphic events about violence at home, with help resources. | P1 | REL-004, EVENT-006, UI-012 | M | post-MVP | not started |

## Education (EDU)

| ID | Name | Description | Priority | Dependencies | Complexity | Scope | Status |
|---|---|---|---|---|---|---|---|
| EDU-001 | School stages | Primary, lower secondary, upper secondary and tertiary, with continuation odds by country, sex, wealth, location and skills. Done when a batch test reproduces each country's completion rates within tolerance. | P0 | SIM-005, MONEY-001, CHAR-004 | L | MVP | done ([#14](https://github.com/roman-kravtsov/life-simulator/pull/14)): four school levels with yearly dropout odds by household, place and aptitude, scaled so each country's completion rates hold (batch tests for five countries); the assumed shares are in `docs/design.md` section 7 |
| EDU-002 | Literacy | Literacy as an outcome of schooling and country rates; it gates some events and jobs. Done when literacy is set for every adult and used by at least career checks. | P1 | EDU-001 | S | MVP | done ([#14](https://github.com/roman-kravtsov/life-simulator/pull/14)): literacy is set at 12 from school completion and the country's adult rate, and raises the odds of formal work |
| EDU-003 | Higher education choice | At the end of secondary school, the player chooses whether to try for tertiary education, with access shaped by money and skills. Done when the choice appears with odds and costs. | P0 | EDU-001, DEC-001 | M | MVP | done ([#15](https://github.com/roman-kravtsov/life-simulator/pull/15)) |
| EDU-004 | Leaving school to work | The pressure to leave school for work, based on income and child labour rates, offered as a decision or forced by circumstance. Done when it fires at country-realistic rates. | P0 | EDU-001, CAREER-001 | M | MVP | done ([#15](https://github.com/roman-kravtsov/life-simulator/pull/15)) |
| EDU-005 | Study abroad | Studying in another country. | P2 | EDU-003, DEC-008 | M | post-MVP | not started |
| EDU-006 | Adult learning | Returning to study or retraining as an adult. | P2 | EDU-001 | S | post-MVP | not started |

## Career (CAREER)

| ID | Name | Description | Priority | Dependencies | Complexity | Scope | Status |
|---|---|---|---|---|---|---|---|
| CAREER-001 | Work entry | Entering work from labour participation rates by age and sex. Done when a batch test reproduces participation within tolerance. | P0 | SIM-005, WORLD-002 | M | MVP | done ([#14](https://github.com/roman-kravtsov/life-simulator/pull/14)): work from the country's participation rate by sex, out of school, with a working life that rises, holds and falls with age (batch tests within 8 points) |
| CAREER-002 | Sectors and informal work | Jobs in agriculture, industry or services, formal or informal, drawn from country shares and education. Done when the job is shown with a sector and affects income and health risk. | P0 | CAREER-001 | M | MVP | done ([#14](https://github.com/roman-kravtsov/life-simulator/pull/14)): a first job with a sector and formal or informal status, matching the country's shares on average; it shifts income standing and health risk |
| CAREER-003 | Job loss and unemployment | Losing work at country unemployment rates, plus job search. Done when unemployment spells occur at realistic rates and affect money and happiness. | P0 | CAREER-001, MONEY-004 | M | MVP | done ([#15](https://github.com/roman-kravtsov/life-simulator/pull/15)) |
| CAREER-004 | Child labour | Children working, from country child labour rates; takes a focus point to Earn. Done when it occurs at realistic rates and links to EDU-004. | P1 | CAREER-001, DEC-004 | S | MVP | done ([#15](https://github.com/roman-kravtsov/life-simulator/pull/15)) |
| CAREER-005 | Career progression | Promotions, setbacks and job changes driven by skills, focus and luck. | P1 | CAREER-002 | M | post-MVP | not started |
| CAREER-006 | Retirement | Stopping work in old age, by country norms and health. Done when retirement happens for working adults and changes income and focus. | P1 | CAREER-001 | S | MVP | done ([#14](https://github.com/roman-kravtsov/life-simulator/pull/14), [#15](https://github.com/roman-kravtsov/life-simulator/pull/15)): retirement happens for working adults and frees the Earn focus point |
| CAREER-007 | Entrepreneurship | Starting a small business, with risk and reward. | P2 | CAREER-002, MONEY-004 | M | post-MVP | not started |

## Money (MONEY)

| ID | Name | Description | Priority | Dependencies | Complexity | Scope | Status |
|---|---|---|---|---|---|---|---|
| MONEY-001 | Household at birth | Places the household at a percentile of the country's income distribution (World Bank PIP). Done when a batch shows a uniform spread of percentiles and the birth screen describes the household in words. | P0 | WORLD-002, RNG-002 | S | MVP | done ([#11](https://github.com/roman-kravtsov/life-simulator/pull/11)) |
| MONEY-002 | Yearly income | The person's own income read from the percentile table, by job and work status. Done when incomes match the country table for the drawn percentile. | P0 | MONEY-001, CAREER-002 | M | MVP | done ([#14](https://github.com/roman-kravtsov/life-simulator/pull/14)): yearly income is the country table's value at the person's percentile, by work status: workers get all of it, retired people 70%, and caregivers and unemployed adults 50% (authored shares), and children and students are shown the household's |
| MONEY-003 | Mobility | The adult percentile mixes the family's percentile (weighted by intergenerational persistence), education, skills and luck. Done when a batch shows the configured persistence within tolerance. | P0 | MONEY-002, EDU-001 | M | MVP | done ([#14](https://github.com/roman-kravtsov/life-simulator/pull/14)): adult standing mixes the household's percentile (by the country's persistence), schooling, skills, job and luck; the batch correlation is within 0.12 of the source |
| MONEY-004 | Savings, debt and costs | Household costs, savings and debt that change each year. Done when money can go negative into debt and debt has consequences. | P0 | MONEY-002 | M | MVP | done ([#14](https://github.com/roman-kravtsov/life-simulator/pull/14)): each year's income and spending move savings and debt; debt carries interest, falls first from surplus, and weighs on happiness and health |
| MONEY-005 | Health costs | Medical costs scaled by the country's out-of-pocket share. Done when treatment decisions show costs and can push the household into debt. | P1 | MONEY-004, HEALTH-005 | S | MVP | done ([#15](https://github.com/roman-kravtsov/life-simulator/pull/15)) |
| MONEY-006 | Money shocks | Disasters, theft and illness that cost money. Done when at least 6 shock events exist. | P1 | MONEY-004, EVENT-001 | S | MVP | done ([#15](https://github.com/roman-kravtsov/life-simulator/pull/15)) |
| MONEY-007 | Money display | Amounts in PPP dollars, described in words, with an optional comparison to US prices. Done when every amount on screen uses one formatter. | P1 | MONEY-002, L10N-003 | S | MVP | done ([#14](https://github.com/roman-kravtsov/life-simulator/pull/14)): every amount goes through `formatMoney`, with the income described in words and an optional line on US prices |
| MONEY-008 | Home ownership | Buying a home, with savings and debt. | P2 | MONEY-004 | M | post-MVP | not started |
| MONEY-009 | Remittances | Money sent home after migrating. | P2 | DEC-008, MONEY-004 | S | post-MVP | not started |

## Health (HEALTH)

| ID | Name | Description | Priority | Dependencies | Complexity | Scope | Status |
|---|---|---|---|---|---|---|---|
| HEALTH-001 | Health stat | Health from constitution, age, focus and events, declining with age. Done when health is tested across stages. | P0 | CHAR-004, SIM-004 | S | MVP | done ([#11](https://github.com/roman-kravtsov/life-simulator/pull/11), [#15](https://github.com/roman-kravtsov/life-simulator/pull/15)): the focus term comes from the yearly plan; forced health points for illness are not a bonus |
| HEALTH-002 | Mortality | Yearly death probability from the life table, adjusted by a bounded hazard multiplier (3.5). Done when SIM-007 shows life expectancy within 2 years for sampled countries. | P0 | WORLD-002, RNG-002 | M | MVP | done ([#11](https://github.com/roman-kravtsov/life-simulator/pull/11)) |
| HEALTH-003 | Cause of death | The cause is drawn from the cause mix by age band and sex, nudged by conditions. Done when a batch reproduces the cause mix within tolerance. | P0 | HEALTH-002 | M | MVP | done ([#11](https://github.com/roman-kravtsov/life-simulator/pull/11)) |
| HEALTH-004 | Conditions | Chronic illnesses and injuries with severity 1 to 3 that affect health, focus and mortality. Done when at least 10 conditions exist and each changes the hazard multiplier. | P1 | HEALTH-001, SIM-006 | M | MVP | done ([#14](https://github.com/roman-kravtsov/life-simulator/pull/14)): 14 conditions with severity 1 to 3, yearly onset, worsening and easing, each raising the hazard and the cause of death it points to; the focus they take from the yearly plan applies from M5 |
| HEALTH-005 | Treatment decisions | Seeking care, with access and cost shaped by country and money. Done when treatment changes outcome odds and the odds lens shows it. | P1 | HEALTH-004, DEC-001 | M | MVP | done ([#15](https://github.com/roman-kravtsov/life-simulator/pull/15)) |
| HEALTH-006 | Suicide | Suicide modelled through the cause mix from adolescence, never a player choice, stated without detail, always followed by help resources. Done when it follows country rates and the help line always appears. | P0 | HEALTH-003, UI-012 | S | MVP | done ([#15](https://github.com/roman-kravtsov/life-simulator/pull/15)) |
| HEALTH-007 | Pregnancy and childbirth risk | Maternal health risks around childbirth, from WHO maternal mortality data. | P1 | FAM-004, WORLD-001 | M | post-MVP | not started |
| HEALTH-008 | Addiction | Alcohol and drug dependence as a condition with events. | P2 | HEALTH-004 | M | post-MVP | not started |
| HEALTH-009 | Disability | Long-term disability that changes options. | P2 | HEALTH-004 | M | post-MVP | not started |
| HEALTH-010 | Epidemics | Outbreaks affecting the country for a period. | P2 | EVENT-003 | M | post-MVP | not started |

## Events (EVENT)

| ID | Name | Description | Priority | Dependencies | Complexity | Scope | Status |
|---|---|---|---|---|---|---|---|
| EVENT-001 | Event schema and loader | Events as typed TS data files (2.3), loaded and indexed by stage. Done when the schema type-checks all content and the loader is tested. | P0 | SIM-001 | M | MVP | done ([#11](https://github.com/roman-kravtsov/life-simulator/pull/11)) |
| EVENT-002 | Conditions | The condition language (stats, traits, flags, world indicators, has, age). Done when every condition type has tests. | P0 | EVENT-001 | M | MVP | done ([#11](https://github.com/roman-kravtsov/life-simulator/pull/11)) |
| EVENT-003 | Event selection | Statistical events rolled independently; narrative events drawn from major and minor pools with weights and a pacing guarantee (3.4). Done when tests cover weights, pools and the guarantee. | P0 | EVENT-002, RNG-002 | M | MVP | done ([#11](https://github.com/roman-kravtsov/life-simulator/pull/11), [#15](https://github.com/roman-kravtsov/life-simulator/pull/15)): pools, a proportional "nothing happens" weight and the pacing guarantee |
| EVENT-004 | Once, cooldowns and follow-ups | Events that happen once, cool down, or schedule a follow-up. Done when all three are tested. | P0 | EVENT-003 | S | MVP | done ([#15](https://github.com/roman-kravtsov/life-simulator/pull/15)) |
| EVENT-005 | Data notes | The quiet "here, about 1 in N..." line with source, shown with some events. Done when notes read live data, skip estimated values and show the source. | P1 | EVENT-001, WORLD-004 | S | MVP | done ([#15](https://github.com/roman-kravtsov/life-simulator/pull/15)) |
| EVENT-006 | Sensitivity and softening | Sensitivity tags and the softening filter (4). Done when softening removes severe narrative events and shortens statistical ones, tested. | P0 | EVENT-003 | S | MVP | done ([#15](https://github.com/roman-kravtsov/life-simulator/pull/15)) |
| EVENT-007 | MVP event set | The written events for the MVP across all stages (count set in `docs/mvp.md`). Done when every stage has enough events that a typical life sees few repeats. | P0 | EVENT-001, L10N-001 | XL | MVP | done ([#15](https://github.com/roman-kravtsov/life-simulator/pull/15)) |
| EVENT-008 | Regional events | Events specific to regions or climates. | P2 | EVENT-007 | L | post-MVP | not started |
| EVENT-009 | Crisis events | Disasters tagged `crisis` that trigger zoom-in (Z8). | P1 | EVENT-003, SIM-008 | M | post-MVP | not started |

## Decisions (DEC)

| ID | Name | Description | Priority | Dependencies | Complexity | Scope | Status |
|---|---|---|---|---|---|---|---|
| DEC-001 | Choice cards | Events with choices; each choice has outcomes with probabilities and effects. Done when the player can choose and the outcome is applied and logged. | P0 | EVENT-001, SIM-006 | M | MVP | done ([#15](https://github.com/roman-kravtsov/life-simulator/pull/15)) |
| DEC-002 | Locked options | Options hidden or locked by money, education or location, with the reason shown. Done when locked options explain themselves. | P1 | DEC-001 | S | MVP | done ([#15](https://github.com/roman-kravtsov/life-simulator/pull/15)) |
| DEC-003 | Yearly focus plan | From age 6, three focus points across Learn, Earn, Health, Belonging, Rest, with diminishing returns, carried over by default (3.3). Done when each area changes outcomes in tests and the plan costs no clicks when unchanged. | P0 | SIM-002 | M | MVP | done ([#15](https://github.com/roman-kravtsov/life-simulator/pull/15)) |
| DEC-004 | Circumstance takes points | Child labour, caregiving and illness remove focus points before the player chooses. Done when each rule is tested and explained on screen. | P1 | DEC-003 | S | MVP | done ([#15](https://github.com/roman-kravtsov/life-simulator/pull/15)) |
| DEC-005 | Odds lens | Before confirming a choice, shows in plain words how each option shifts the odds of what matters. Done when every choice with probabilistic outcomes shows banded odds that match the engine. | P1 | DEC-001 | M | MVP | done ([#15](https://github.com/roman-kravtsov/life-simulator/pull/15)) |
| DEC-006 | Auto mode | An auto-player picks plans and choices using a trait-weighted policy on its own RNG stream. | P2 | DEC-003, RNG-002 | M | post-MVP | not started |
| DEC-007 | Quarterly plan | In zoomed years, the player re-sets the plan each quarter. | P1 | SIM-008, DEC-003 | S | post-MVP | not started |
| DEC-008 | Migration | Choosing to move abroad (or being displaced), with destinations from migration data; the person then lives under the new country's data. | P1 | WORLD-002, DEC-001 | L | post-MVP | not started |

## Randomness (RNG)

| ID | Name | Description | Priority | Dependencies | Complexity | Scope | Status |
|---|---|---|---|---|---|---|---|
| RNG-001 | Seeded PRNG | sfc32 (or similar) seeded by a cyrb128-style hash of the seed string. Done when known-answer tests pass. | P0 | none | S | MVP | done ([#5](https://github.com/roman-kravtsov/life-simulator/pull/5)) |
| RNG-002 | Independent streams | Separate streams per subsystem from `hash(seed, stream, year)` (3.9). Done when a test shows that adding an event does not change mortality draws. | P0 | RNG-001 | S | MVP | done ([#5](https://github.com/roman-kravtsov/life-simulator/pull/5)) |
| RNG-003 | Readable seeds | Seeds like "amber-river-4821", shown on the summary. Done when every life has one. | P1 | RNG-001 | S | MVP | done ([#11](https://github.com/roman-kravtsov/life-simulator/pull/11), [#16](https://github.com/roman-kravtsov/life-simulator/pull/16)): the seed is shown on the birth screen and on the summary |
| RNG-004 | Replay | Same seed, data version, content version and decision, plan and settings logs give the same life. Done when a test replays many lives and compares full histories. | P0 | RNG-002, SAVE-001 | M | MVP | done ([#16](https://github.com/roman-kravtsov/life-simulator/pull/16)) |
| RNG-005 | No unseeded randomness | A lint rule forbids `Math.random()` in the engine. Done when CI fails on a violation. | P1 | BE-002 | S | MVP | done ([#5](https://github.com/roman-kravtsov/life-simulator/pull/5)) |
| RNG-006 | Play a given seed | Enter or open a seed to live that same starting life. | P2 | RNG-003 | S | post-MVP | not started |

## Time progression (TIME)

| ID | Name | Description | Priority | Dependencies | Complexity | Scope | Status |
|---|---|---|---|---|---|---|---|
| TIME-001 | Turn-based advance | Nothing happens until the player continues; one turn is one year. Done when no timer exists and every turn waits for input. | P0 | SIM-002 | S | MVP | done ([#11](https://github.com/roman-kravtsov/life-simulator/pull/11)) |
| TIME-002 | Quiet years | Years without decisions or notable events are batched into one line. Done when batching is tested and can be turned off. | P1 | TIME-001, EVENT-003 | S | MVP | done ([#15](https://github.com/roman-kravtsov/life-simulator/pull/15)) |
| TIME-003 | Quarterly sub-steps | Engine support for quarters: yearly probabilities converted with `1 − (1 − p)^(1/4)`, quarterly effects and streams (3.1.1). Done when a test shows four quarters equal one year's risk within tolerance. | P1 | SIM-002, RNG-002 | M | post-MVP | not started |
| TIME-004 | Pace setting | Choose "every year" or "quiet years". | P2 | TIME-002, UI-009 | S | post-MVP | not started |
| TIME-005 | Keep-yearly setting | Play zoomed years without quarterly stops. | P2 | SIM-008, UI-009 | S | post-MVP | not started |

## Death (DEATH)

| ID | Name | Description | Priority | Dependencies | Complexity | Scope | Status |
|---|---|---|---|---|---|---|---|
| DEATH-001 | Death resolution | Ends the life with age and cause, and moves to the summary. Done when every death produces a complete record. | P0 | HEALTH-002, HEALTH-003 | S | MVP | done ([#16](https://github.com/roman-kravtsov/life-simulator/pull/16)) |
| DEATH-002 | Death passage | A short, non-graphic closing passage per cause group, in the game's voice. Done when every cause group has a passage and a softened version. | P0 | DEATH-001, L10N-001 | M | MVP | done ([#16](https://github.com/roman-kravtsov/life-simulator/pull/16)) |
| DEATH-003 | Life expectancy comparison | Places the age at death against the country's life expectancy, with source. Done when shown on the summary. | P1 | DEATH-001, WORLD-002 | S | MVP | done ([#16](https://github.com/roman-kravtsov/life-simulator/pull/16)) |
| DEATH-004 | Epitaph | The player may write a few words for the person at the end. Done when it is saved with the life. | P1 | DEATH-001, SAVE-003 | S | MVP | done ([#16](https://github.com/roman-kravtsov/life-simulator/pull/16)) |

## Life summary (SUM)

| ID | Name | Description | Priority | Dependencies | Complexity | Scope | Status |
|---|---|---|---|---|---|---|---|
| SUM-001 | Summary screen | The end-of-life screen: closing passage, age and cause, key facts, start-again button. Done when it works on mobile and desktop. | P0 | DEATH-001, UI-001 | M | MVP | done ([#16](https://github.com/roman-kravtsov/life-simulator/pull/16)) |
| SUM-002 | Growth-ring cross-section | The life drawn as tree rings: thickness from happiness, colour from the year's theme, marks for key events, with patterns and labels for accessibility (1.3). Done when every finished life renders its rings in SVG. | P1 | SUM-001, UI-011 | L | MVP | done ([#16](https://github.com/roman-kravtsov/life-simulator/pull/16)) |
| SUM-003 | Key moments | A short timeline of the most significant years. Done when 5 to 12 moments (fewer only when the life had fewer years with something to tell) are chosen by a tested rule. | P0 | SUM-001 | M | MVP | done ([#16](https://github.com/roman-kravtsov/life-simulator/pull/16)) |
| SUM-004 | Chance, choice and circumstance | A breakdown of what shaped the life, built from effect tags. Done when the breakdown is computed and explained in words. | P1 | SUM-001, SIM-006 | M | MVP | done ([#16](https://github.com/roman-kravtsov/life-simulator/pull/16)) |
| SUM-005 | Notes and epitaph | Shows the journal entries and the epitaph. | P1 | SUM-001, UI-007, DEATH-004 | S | MVP | done ([#19](https://github.com/roman-kravtsov/life-simulator/pull/19)): "Your notes" on the summary (also for archived lives) beside the epitaph |
| SUM-006 | The other shore | The same seed and traits, born in a different country, shown side by side. | P2 | SUM-001, RNG-004 | L | post-MVP | not started |
| SUM-007 | The road not taken | Replay from a past decision with a different choice. | P2 | SUM-001, RNG-004 | L | post-MVP | not started |
| SUM-008 | Life charts | Stat curves over the life. | P2 | SUM-001 | S | post-MVP | not started |

## Persistence (SAVE)

| ID | Name | Description | Priority | Dependencies | Complexity | Scope | Status |
|---|---|---|---|---|---|---|---|
| SAVE-001 | Autosave | Saves the current life to localStorage after every resolved turn (2.4). Done when closing the tab loses at most the current screen. | P0 | SIM-001 | S | MVP | done ([#16](https://github.com/roman-kravtsov/life-simulator/pull/16)) |
| SAVE-002 | Resume | Reloading the page offers to continue the life in progress. Done when tested end to end in a browser. | P0 | SAVE-001, UI-001 | S | MVP | done ([#16](https://github.com/roman-kravtsov/life-simulator/pull/16)) |
| SAVE-003 | Past lives archive | Finished lives stored in IndexedDB, browsable. Done when lives survive reloads and can be reopened. | P1 | SAVE-001 | M | MVP | done ([#16](https://github.com/roman-kravtsov/life-simulator/pull/16)) |
| SAVE-004 | Schema versions | Saves carry schema, data and content versions, with migrations. Done when an old-version save loads in a test. | P0 | SAVE-001 | S | MVP | done ([#16](https://github.com/roman-kravtsov/life-simulator/pull/16)): schema version 1 is the first, so `MIGRATIONS` is empty; the migration machinery is tested with an invented older schema |
| SAVE-005 | Replay fallback | If a snapshot cannot load, rebuild the life from seed and decisions. Done when a corrupted-snapshot test recovers. | P1 | RNG-004, SAVE-004 | S | MVP | done ([#16](https://github.com/roman-kravtsov/life-simulator/pull/16)) |
| SAVE-006 | Export and import | Save or load a life as a JSON file. | P2 | SAVE-004 | S | post-MVP | not started |
| SAVE-007 | Delete data | Delete one life or all local data. Done when nothing remains in storage after "delete all". | P1 | SAVE-003 | S | MVP | done ([#16](https://github.com/roman-kravtsov/life-simulator/pull/16)) |

## UI/UX (UI)

| ID | Name | Description | Priority | Dependencies | Complexity | Scope | Status |
|---|---|---|---|---|---|---|---|
| UI-001 | App shell | Screens and navigation with no framework: start, birth, life, decision, summary, past lives, settings, sources. Done when every screen is reachable and back navigation behaves. | P0 | none | M | MVP | done ([#19](https://github.com/roman-kravtsov/life-simulator/pull/19)): start, birth, life, summary, past lives, settings and sources all render through one page shell, each with a Back inside the page; the browser's Back button leaves the site, there being no router (design 7, open for Roman) |
| UI-002 | Start screen | Title, a few lines of introduction, the content note, the softening option, and "Begin a life" / "Continue". Done when a first-time player can start in one tap after reading the note. | P0 | UI-001 | S | MVP | done ([#19](https://github.com/roman-kravtsov/life-simulator/pull/19)) |
| UI-003 | Birth screen | Reveals country, sex, name, family and household in prose, with the country panel. Done when it reads well for rich and poor births alike. | P0 | UI-001, CHAR-001 | S | MVP | done ([#19](https://github.com/roman-kravtsov/life-simulator/pull/19)): prose, a sentence about older brothers and sisters, and the country panel; UI-016 plays a short reveal of the country before it |
| UI-004 | Life screen | A header that stays at the top (name, age, country, the strip of the life so far, Journal, settings, help, Continue); on desktop three columns, About you on the left (rings, the four stats, tabs for school and work, money and health), the ledger of years in the middle with the plan in a tray under it, and Around you on the right (tabs for family, country and notes); on phones one column with a bar of tabs (Story, You, Around you). The side columns fit a 640 px tall window without scrolling. Done on mobile and desktop. | P0 | UI-001, CHAR-004 | M | MVP | done ([#19](https://github.com/roman-kravtsov/life-simulator/pull/19)); earlier work in [#17](https://github.com/roman-kravtsov/life-simulator/pull/17), [#11](https://github.com/roman-kravtsov/life-simulator/pull/11) and [#14](https://github.com/roman-kravtsov/life-simulator/pull/14): the Journal button and the Notes tab hold the journal (UI-007), a large family shows 8 people with a dialog for the rest, the header is outside `<main>`. The Country tab shows only the three measured facts the data has with a source and year, estimated values left out |
| UI-005 | Plan widget | Allocate focus points with clear effects and missing-point reasons. Done when usable by touch and keyboard. | P0 | UI-004, DEC-003 | M | MVP | done ([#15](https://github.com/roman-kravtsov/life-simulator/pull/15)) |
| UI-006 | Decision card | Shows the situation, options, locked reasons and the odds lens. Done when usable by touch and keyboard. | P0 | UI-004, DEC-001 | M | MVP | done ([#15](https://github.com/roman-kravtsov/life-simulator/pull/15)) |
| UI-007 | Reflection prompts | Event-driven prompts with an optional journal line (3.7). Done when at least 15 prompts exist and notes are saved. | P1 | UI-004, SAVE-001 | S | MVP | done ([#19](https://github.com/roman-kravtsov/life-simulator/pull/19)): 23 prompts that wait for what happened in a year (`src/content/reflections.ts`), one line of journal each, saved with the life and shown on the summary |
| UI-008 | Past lives screen | A list of finished lives with name, country, age at death and rings thumbnail. | P1 | SAVE-003, UI-001 | S | MVP | done ([#19](https://github.com/roman-kravtsov/life-simulator/pull/19)): a card per life with a rings thumbnail, open and delete |
| UI-009 | Settings screen | Softening, reduced motion, text size, theme, delete data. | P1 | UI-001 | S | MVP | done ([#19](https://github.com/roman-kravtsov/life-simulator/pull/19)): softening and pace, theme, text size, reduced motion and delete all local data |
| UI-010 | Responsive layout | Wide (900 px and up): three columns that scroll as one page, with the side columns held in place and fitting a window 640 px tall (and 600 px, tested) without scrolling. Narrow: one column and a bar of tabs. 1440 px is the floor for the wide layout and about 400 px (the smallest phone, 390 to 430 px) for the narrow one; 360 px is no longer supported. Done when the full loop works at about 400 px and 1440 px widths, with no horizontal scroll and nothing in the side columns scrolling at 1440 x 640. | P0 | UI-001 | M | MVP | done ([#19](https://github.com/roman-kravtsov/life-simulator/pull/19)); earlier work in [#17](https://github.com/roman-kravtsov/life-simulator/pull/17): every screen now uses the shell (header outside `<main>`; reading column or the life screen's columns); `e2e/loop.spec.ts` checks the side tabs at 640 and 600 px tall, the Notes tab included; widths from 900 to 1439 px are best effort (the tray wraps) and the text-size setting does not move the em breakpoints |
| UI-011 | Visual identity | Palette, type, light and dark themes as tokens (1.3), plus the React Aria based component kit in `src/ui/kit` (`docs/design-system.md`). Done when all screens use the tokens. | P0 | UI-001 | M | MVP | done ([#5](https://github.com/roman-kravtsov/life-simulator/pull/5)) |
| UI-012 | Help resources | Calm help lines after sensitive events and an always-available "Need to talk?" link (4). Done when every event with a help topic shows it. | P0 | UI-001, EVENT-006 | S | MVP | done ([#15](https://github.com/roman-kravtsov/life-simulator/pull/15)) |
| UI-013 | Motion | Small transitions (a ring growing, a card settling). | P2 | UI-011, A11Y-004 | S | post-MVP | not started |
| UI-014 | Installable and offline | Web app manifest and offline caching. | P2 | BE-002 | M | post-MVP | not started |
| UI-015 | First-life hints | Light hints the first time the player sees the plan, a decision or the odds lens. | P2 | UI-005, UI-006 | S | post-MVP | not started |
| UI-016 | Birth reveal | After "Begin", a quiet line of country names (6 to 10, drawn by where children are born, never evenly) passes in the serif face, slows, and stops on the real country with an ink rule and one line: "About 1 in N of the year's births, across the {count} countries in this game, happen here." (the countries with full data, not the world) The country is already drawn from the seed, so the reveal only presents it; skipping never changes it, and a reload once the country has loaded resumes the same life (a reload before that discards the life, which was not yet saved). No flags, sound, near-miss slow-down or verdict, and rich and poor births look alike. Timed in CSS (no timers, TIME-001), `aria-hidden` reel with one polite status line that also carries the result and the odds sentence, a "Skip the reveal" button that takes focus first (Escape also skips; if focus is in the header when the reel ends, the reveal waits and the button reads "Continue", so the reel never takes focus away from the header), and no reel at all under reduced motion (the birth screen then adds a line that the country was drawn by chance) or once the reel is over while the country is still loading (a still name, "Opening your life…" and a way back to the start). Done when it plays at 400 and 1440 px and keyboard-only (both themes are covered by the colour tokens, the contrast test and screenshots, not by an e2e toggle), and a test pins that the reel never changes the country or the life. | P2 | UI-003, A11Y-004, UI-011 | S | post-MVP | done ([#22](https://github.com/roman-kravtsov/life-simulator/pull/22)) |

## Audio (AUDIO)

| ID | Name | Description | Priority | Dependencies | Complexity | Scope | Status |
|---|---|---|---|---|---|---|---|
| AUDIO-001 | Ambient music | Optional quiet music, off by default, with licensed or original tracks. | P3 | UI-009 | M | post-MVP | not started |
| AUDIO-002 | Sound cues | Optional soft cues for births, deaths and decisions. | P3 | AUDIO-001 | S | post-MVP | not started |

## Accessibility (A11Y)

| ID | Name | Description | Priority | Dependencies | Complexity | Scope | Status |
|---|---|---|---|---|---|---|---|
| A11Y-001 | Keyboard play | The whole loop is playable by keyboard with visible focus. Done when tested end to end without a mouse. | P0 | UI-001 | S | MVP | done ([#19](https://github.com/roman-kravtsov/life-simulator/pull/19)): `e2e/keyboard.spec.ts` plays a whole life with the keyboard only at both widths |
| A11Y-002 | Screen readers | Semantic HTML, labelled controls, live-region announcements for new events and stat changes. Done when the loop is usable with a screen reader. | P0 | UI-001 | M | MVP | in progress ([#19](https://github.com/roman-kravtsov/life-simulator/pull/19)): semantic landmarks, labelled controls, one live region that announces the year, its events and the stats that moved; left: a pass with real screen readers (NVDA, VoiceOver), which this cloud session cannot do |
| A11Y-003 | Contrast and non-colour signals | WCAG AA contrast; rings and stats never rely on colour alone. Done when an automated contrast check passes. | P0 | UI-011 | S | MVP | done ([#19](https://github.com/roman-kravtsov/life-simulator/pull/19)): `tests/ui/contrast.test.ts` reads every text colour in the style sheets and the tokens in both themes; rings have patterns, stats have numbers and words |
| A11Y-004 | Reduced motion | Respects `prefers-reduced-motion` and a setting. | P1 | UI-009 | S | MVP | done ([#19](https://github.com/roman-kravtsov/life-simulator/pull/19)): one global rule set follows the system and the "Reduce motion" setting |
| A11Y-005 | Text size | Text scales with browser settings and a setting, without breaking layout. | P1 | UI-009 | S | MVP | done ([#19](https://github.com/roman-kravtsov/life-simulator/pull/19)): text follows the browser's size and a setting (default, larger, largest) with no sideways scroll at 400 and 1440 px; at larger and largest, the side tabs may scroll inside themselves in a short window, because media queries in em follow only the browser's own size (design 7, open for Roman) |
| A11Y-006 | Automated audit | axe checks in browser tests. Done when axe-core runs over every screen, side tab and dialog a test can open at phone and desktop widths in both themes, and finds no violation. | P1 | A11Y-002 | S | MVP | done ([#25](https://github.com/roman-kravtsov/life-simulator/pull/25)): `e2e/axe.spec.ts`; moved forward from post-MVP by `ROADMAP.md` Phase A (no dependency on A11Y-002 in practice, it is a safety net for it). The family list dialog (more than eight relatives) is not reached; axe's "incomplete" checks are listed in the spec, not failures. First run found two violations, both fixed |

## Localization (L10N)

| ID | Name | Description | Priority | Dependencies | Complexity | Scope | Status |
|---|---|---|---|---|---|---|---|
| L10N-001 | String keys | All player-facing text through `t(key, vars)`, English first. Done when a check finds no hard-coded strings in UI or content. | P0 | none | S | MVP | done ([#5](https://github.com/roman-kravtsov/life-simulator/pull/5)) |
| L10N-002 | Country names | Country names from `Intl.DisplayNames`, with fallbacks. | P1 | L10N-001 | S | MVP | done ([#7](https://github.com/roman-kravtsov/life-simulator/pull/7)) |
| L10N-003 | Number formatting | Numbers and money formatted for the locale. | P1 | L10N-001 | S | MVP | done ([#7](https://github.com/roman-kravtsov/life-simulator/pull/7)) |
| L10N-004 | Second language | A full translation into a second language. | P2 | L10N-001 | L | post-MVP | not started |
| L10N-005 | Right-to-left | Layout support for right-to-left languages. | P3 | L10N-004 | M | post-MVP | not started |

## Sharing (SHARE)

| ID | Name | Description | Priority | Dependencies | Complexity | Scope | Status |
|---|---|---|---|---|---|---|---|
| SHARE-001 | Share text | Copy a short text summary of the life. | P2 | SUM-001 | S | post-MVP | not started |
| SHARE-002 | Share image | Download the rings cross-section as an image card. | P2 | SUM-002 | M | post-MVP | not started |
| SHARE-003 | Share seed link | A link that starts the same life (seed only, no personal data). | P2 | RNG-006 | S | post-MVP | not started |

## Achievements (ACH)

| ID | Name | Description | Priority | Dependencies | Complexity | Scope | Status |
|---|---|---|---|---|---|---|---|
| ACH-001 | Lives collection | A quiet, non-competitive record of lives lived (countries, eras, ages). No scores or ranks. | P3 | SAVE-003 | S | post-MVP | not started |
| ACH-002 | Discovery log | A record of events you have seen across lives. | P3 | SAVE-003, EVENT-007 | S | post-MVP | not started |

## Analytics (ANLT)

| ID | Name | Description | Priority | Dependencies | Complexity | Scope | Status |
|---|---|---|---|---|---|---|---|
| ANLT-001 | No tracking | The game sends no analytics or personal data; this is stated on the start screen. Done when the build contains no tracking code. | P0 | none | S | MVP | done ([#5](https://github.com/roman-kravtsov/life-simulator/pull/5)) |
| ANLT-002 | Your lives in numbers | Local-only statistics across your own lives. | P2 | SAVE-003 | S | post-MVP | not started |
| ANLT-003 | Opt-in aggregate stats | Anonymous, opt-in counts to improve balance. Needs a backend and a privacy review. | P3 | BE-003 | M | post-MVP | not started |

## Backend (BE)

| ID | Name | Description | Priority | Dependencies | Complexity | Scope | Status |
|---|---|---|---|---|---|---|---|
| BE-001 | Static site | No server: the game is a static build with data files. Done when the built site runs from any static host. | P0 | none | S | MVP | done ([#5](https://github.com/roman-kravtsov/life-simulator/pull/5)) |
| BE-002 | CI and deploy | GitHub Actions: typecheck, lint, tests on every PR; deploy to GitHub Pages on merge to main. Done when a merge publishes the site. | P0 | BE-001 | S | MVP | done ([#5](https://github.com/roman-kravtsov/life-simulator/pull/5)): CI runs lint, format, typecheck, tests, build and e2e on every PR, and every merge to main deployed to Pages (runs 9 to 13 green, 2026-10-24 to 25) |
| BE-003 | Shared memorials | Optional public sharing of finished lives. Needs moderation, privacy and a server. | P3 | SAVE-003 | XL | post-MVP | not started |

## Admin/content tooling (ADMIN)

| ID | Name | Description | Priority | Dependencies | Complexity | Scope | Status |
|---|---|---|---|---|---|---|---|
| ADMIN-001 | Content validation | CI checks that every event has valid conditions, text keys, probabilities summing to 1 and help topics for sensitive events. | P1 | EVENT-001, BE-002 | S | MVP | done ([#15](https://github.com/roman-kravtsov/life-simulator/pull/15)) |
| ADMIN-002 | Event preview | A debug page to fire any event against a chosen state. | P2 | EVENT-003 | M | post-MVP | not started |
| ADMIN-003 | Balance report | A per-country report from the calibration harness (life expectancy, schooling, income, marriage, deaths by cause) published as a CI artifact. | P1 | SIM-007 | S | post-MVP | not started |
| ADMIN-004 | Debug mode | Shows seed, streams and rolls during play, for testing. | P2 | RNG-002 | S | post-MVP | not started |
| ADMIN-005 | Agency probe | A script and CI report that simulates batches of lives with different plans and decision choices and reports the effect of each focus area and choice on stats, income rank, health and the chance, choice and circumstance shares. Found in the 2026-10-26 audit (`ROADMAP.md` D-002). Done when the report runs from one command, its numbers are committed in `docs/`, and a balance pass can be judged against it. | P1 | SIM-007, DEC-003, SUM-004 | M | post-MVP | not started |

---

## Notes

### SIM-007 Calibration harness
Real data is only honest if the simulation reproduces it. The harness simulates large batches of lives with the auto policy and compares outcomes with the source indicators. It is what lets us say "this is how lives go there" with a straight face, and it guards against content changes quietly skewing the odds.

### SIM-008 Zoom-in quarters
Exact triggers Z1 to Z12 and the limits are in design 3.1.1. Proposed as post-MVP because the yearly loop must be solid first; the engine keeps quarter support in mind from the start (streams already include the period), so adding it later does not break replays of yearly lives.

### WORLD-001 Data pipeline
Sources and licences are in analysis 1.7. The pipeline is XL because of the number of sources and the gap filling. It runs offline at build time; the game never calls these APIs.

### HEALTH-006 Suicide
Included because Roman put sensitive content in scope. It is never a choice the player can make. The text is one plain sentence, softened further under the softening setting, and the help line always follows.

### DEC-005 Odds lens
The odds shown are computed by the same engine code that resolves the choice, so they cannot drift from what actually happens. They are shown in bands ("about 1 in 3"), not decimals.
