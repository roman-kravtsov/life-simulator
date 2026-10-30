# Money engine design check (TD-001)

Status: **proposal for Roman, nothing built.** Written 2026-10-30 as the Phase D design check. It restates the open decisions of TD-001 (inflation and wage-growth sources, how amounts read across decades, hyperinflation), recommends an answer to each, and says what the build would be. `ROADMAP.md` stays the plan; design decisions move to `docs/design.md` section 7 only when Roman accepts them.

Every number below marked "measured" was computed on 2026-10-30 from the World Bank WDI API and the ILO bulk API (both reachable from the sandbox) over the 163 countries in the game, weighted by births where it says so. The build must turn these into a permanent extractor in `scripts/data/extract/`; the throwaway analysis is not in the repo (method in section 8).

## 1. Summary

Roman's standing choice is a full nominal money engine (2026-10-26). The check found that it is cheaper and safer than the roadmap feared, because of one idea:

> **Incomes are real flows; savings, debts and prices are nominal stocks.** The percentile tables stay in constant dollars. A country's price index only touches what is denominated in its currency (cash savings, debt, pensions, wages that lag) and what the player reads. So hyperinflation does not break the percentile tables (the risk TD-001 named), and with the macro path switched off the new engine reproduces today's engine exactly, which gives the migration a regression test.

| #   | Decision                              | Recommendation                                                                                                                                                                                                                                                                                       | Roman's call? |
| --- | ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- |
| R1  | What the engine stores                | Money in **ledger units**: local currency divided by the 2023 PPP factor, so one unit buys in 2023 what one international dollar buys. A price index `P(t)` per life turns it into real terms. No currency names in the engine, so redenominations cannot touch it.                                  | no            |
| R2  | Inflation source                      | World Bank WDI `FP.CPI.TOTL.ZG` (IMF IFS), GDP deflator `NY.GDP.DEFL.KD.ZG` where CPI is missing. 1960 to 2024, 160 of 163 countries have a recent CPI value, 162 a deflator.                                                                                                                       | no            |
| R3  | How the future is made                | A **seeded macro path per life**, drawn from the history: a log-AR(1) inflation around an anchor, plus crisis episodes **bootstrapped from the 78 real episodes since 1992** (inflation path and GDP-per-person path together). Not a forecast, and the game says so.                                | no            |
| R4  | Real growth and wage growth           | **Include it, shrunk hard.** A country's growth in one period does not predict the next (correlation 0.06 between 1995 to 2009 and 2009 to 2023), so every country gets the global median (about 1.8% a year) plus half of its income group's gap, with measured year-to-year shocks. Wages follow it. | **yes**       |
| R5  | Age profile of earnings               | Add a mean-preserving profile from ILO (15 to 24: 0.64, 25 to 54: 1, 55 to 64: 1.09 of prime-age pay, medians over 90 countries). Today a 20-year-old and a 50-year-old at one percentile earn the same.                                                                                              | no            |
| R6  | Savings, debt and returns             | Deposit and lending rates from WDI (116 countries, 85% of births), income-group fallback. Real deposit rates collapse in high inflation (median -21% when inflation is 20% to 200%, measured), debt follows last year's inflation. Replaces the authored flat 6%.                                    | no            |
| R7  | How amounts read across decades       | **Default: real, in 2023 dollars** (today's unit and words, so nothing changes for the player). One optional switch, "paper money", shows the nominal ledger units of that year. Currency names and redenominations are left out.                                                                    | **yes**       |
| R8  | Hyperinflation                        | Allow it, at the history's rate (about 1.3% of person-years at 50% or more, 0.1% at 1,000% or more). It is a story the engine tells (savings vanish, wages lag, work and happiness suffer), written non-graphically. A redenomination is a line of text, never a mechanism.                          | **yes**       |
| R9  | Prices of things                      | Costs stay shares of the middle income (they then grow with wages). Add the **price level** (PPP factor over market exchange rate) for a market-dollar view, with a guard for crisis countries where it breaks (Lebanon reads 2.7).                                                                    | no            |
| R10 | Build order and the migration promise | Five steps, the first with **no change in behaviour** (plumbing, `SCHEMA_VERSION` 2, the neutral-macro equivalence test), then inflation, growth, crises, balance. Section 6.                                                                                                                        | no            |

Section 7 lists the four questions that are Roman's to answer.

## 2. What exists today

- `src/engine/money.ts`: `dailyIncome(country, percentile)` reads the 100-value PIP table (2021 PPP dollars a day, survey year 2005 to 2025, most 2021 to 2024); `yearlyIncome` is that times 365 times a work-status share (retired 70%, caregiver or unemployed 50%, authored). `stepMoney` spends 102% (bottom) to 78% (top) of income with 6% noise, repays debt first, saves the rest, charges a flat authored 6% on debt. `Person.money` is `householdPercentile`, `percentile`, `luck`, `savings`, `debt` in "PPP$".
- `formatMoney` shows one unit, international dollars, "which adjust for what money buys in each country (year)". The optional US-prices switch adds a sentence and no data.
- What is **not** there: any year (money has no calendar), any change of income with age or time (a percentile earns the same table value at 20 and at 60, for 70 years, so a life in a country that grew fivefold in a lifetime is shown as flat), any asset, any nominal term. In effect the engine has zero inflation and zero real growth.
- Lives are born in the life-table year, 2023 (`birthYear: country.demography.lifeTable.year`), and last about 73 years, so **every simulated year from 2024 on is future**. No dataset has it. Realism therefore means: today's levels from data, the shape of change from history, and honesty that the path is one plausible draw.

## 3. What the data says

All measured on 2026-10-30. "Births-weighted" uses `birthsPerYear` from `index.json`, which is how the game draws a birthplace.

**Inflation (WDI CPI, deflator fallback).**

| Fact                                                                                                | Measured                                   |
| --------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| Countries with a CPI value in 2018 or later                                                         | 160 of 163 (missing: COD, VEN, YEM)        |
| Countries with a GDP-deflator value in 2018 or later                                                | 162 of 163 (missing: SSD)                  |
| Births living where the 2014 to 2023 mean inflation is above 10% / 25% / 100%                       | 30.1% / 3.7% / 0.7%                        |
| Births-weighted share of person-years with inflation at least 10% / 20% / 50% / 100% / 1,000%, 2001 to 2024 | 25.3% / 7.1% / 1.3% / 0.7% / 0.1%          |
| Same, 2012 to 2024                                                                                  | 21.7% / 8.3% / 1.5% / 0.9% / 0.2%          |
| Countries with a year at 50% or more in 2001 to 2024                                                | 18, carrying 11.1% of births               |
| Countries with a year at 1,000% or more since 1990                                                  | 22 of 163 (most in the 1992 to 1994 post-Soviet break-up; since 2008: Zimbabwe, Venezuela) |
| Episodes of 50% or more since 1992 (consecutive years)                                              | 78: median length 2 years, mean 2.9, 90th percentile 6; median peak 129%, 90th percentile peak 2,221% |
| Onset of an episode, per country-year                                                               | 0.62% since 2001; by income group since 1992: low 2.5%, lower-middle 1.4%, upper-middle 1.8%, high 0.7% |
| Persistence: slope of next year's `log(1 + inflation)` on this year's, pooled, inflation under 200% | 0.635 (n = 4,617)                          |
| GDP per person in years of 1,000% or more / 50% to 1,000% / under 50%                               | mean -10.9% (n = 41) / -1.8% (n = 181) / +2.3% (n = 5,088) |

The annual series cannot see a Cagan hyperinflation (monthly inflation above 50%, about 13,000% a year; the Hanke and Krus list uses it). Annual figures at 1,000% or more are the nearest honest label, and the game should call them that.

**Real growth.**

| Fact                                                                                       | Measured                                              |
| ------------------------------------------------------------------------------------------ | ----------------------------------------------------- |
| GDP per person (PPP, constant) growth 1995 to 2023, across countries                       | 10th percentile 0.5%, median 1.8%, 90th percentile 4.5% a year |
| Births-weighted mean of the same                                                           | 3.0% (India and China)                                |
| Correlation of a country's 14-year growth 1995 to 2009 with 2009 to 2023                   | **0.06** (means 2.7% and 1.7%)                        |
| Year-to-year growth by income group, 2001 to 2023 (mean / sd / worst year)                 | low 1.1 / 5.9 / -48; lower-middle 2.0 / 4.7 / -29; upper-middle 2.8 / 5.7 / -39; high 1.9 / 4.0 / -19 |

The 0.06 matters most. Extrapolating a country's last decades over 73 years is not defensible: 3% a year is 8 times, 5% is 35 times. Past growth says almost nothing about the next period, so the prior must be mostly global.

**Wages, age and schooling (ILO).**

| Fact                                                                        | Measured                                               |
| --------------------------------------------------------------------------- | ------------------------------------------------------ |
| Hourly earnings by age (`EAR_EHRA_SEX_AGE_NB_A`), 2015 or later             | 83 countries, 76.5% of births                          |
| Pay relative to ages 25 to 54, median over 90 countries (latest year)        | 15 to 24: 0.64; 55 to 64: 1.09; 65 and over: 0.98      |
| Advanced against basic education pay (`EAR_EHRA_SEX_EDU_NB_A`)               | median 2.3 over 90 countries (2.0 high income, 2.6 low) |
| Labour income share of GDP (`SDG_1041_NOC_RT_A`), recent                     | 159 countries, median 46.9%, 10th to 90th percentile 32.9% to 59.9% |
| Nominal hourly earnings (`EAR_EHRA_SEX_NB_A`) with 8 or more years since 2000 | only 40 countries, 48.5% of births                     |

The last row is why wage pass-through of inflation cannot be calibrated from ILO country by country for everyone. The 2.3 education premium is a validation target for the existing percentile mix, not an input.

**Interest rates (WDI).**

| Fact                                                                   | Measured                                                                 |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Lending rate (`FR.INR.LEND`, with `FR.INR.RINR`), recent values        | 116 countries, 85.3% of births (deposit rate `FR.INR.DPST`: 121, 67.9%)  |
| Median real lending rate, 2010 to 2023, low-inflation years, by group  | low 8.3%, lower-middle 5.0%, upper-middle 5.7%, high 2.7% (the game's flat authored 6%) |
| Median real deposit rate when inflation is 20% to 200%, 2005 to 2023   | **-21.1%** (n = 74 country-years)                                        |

**Prices and base year.**

| Fact                                                                          | Measured                                                                   |
| ----------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Price level in 2021 (PPP factor over market exchange rate; 1 is the US)         | 158 countries: 10th percentile 0.27, median 0.42, 90th percentile 0.92. Nigeria 0.37, India 0.28, Japan 0.90, Switzerland 1.16, **Lebanon 2.72** (a stale official rate), Egypt 0.25 |
| PIP survey year of the committed percentile tables                            | 2005 to 2025; 32 countries have a survey from 2017 or earlier, 23 from 2021, 39 from 2023 |

## 4. The decisions

### R1. What the engine stores: ledger units, a price index, no currencies

**Option A: local currency units.** Faithful, but every country needs a currency name, symbol, number format and redenomination history, amounts like 4,500,000 break the 640 px layouts and `formatMoney`, and a redenomination (Venezuela has had several) would corrupt any stored number.

**Option B: nominal international dollars.** One unit worldwide, but local inflation then has to appear as an exchange-rate movement, which is a different (and much harder) model.

**Recommended: ledger units.** One ledger unit is local currency divided by the country's 2023 PPP conversion factor, so it buys in 2023 what an international dollar buys. A life carries a price index `P(t)` with `P(2023) = 1`; real value is `stored / P(t)`. Doubles hold 10^300, so a year at 225,652% (Venezuela 2018, measured) is only a number. A redenomination changes the name on the banknote and nothing in the ledger. Save semantics: today's `savings` and `debt` are already "real at 2023 prices", which is exactly `P = 1`.

### R2. Sources for inflation

Recommended: WDI `FP.CPI.TOTL.ZG` (the IMF's International Financial Statistics, redistributed by the World Bank under CC BY 4.0, which `docs/analysis.md` 1.7 lists as the licence of WDI), deflator `NY.GDP.DEFL.KD.ZG` where CPI is missing, and where a series is missing (VEN has a deflator but no recent CPI or PPP factor, YEM neither CPI nor PPP, COD no CPI, SSD no deflator or growth) the pipeline's existing regional fallback, marked as an estimate (the data files already carry estimate flags). Venezuela is where the data is least complete and the story strongest; the game must say the figures are estimates.

Considered and not recommended now:

| Source                                               | Why not                                                                                                                                                                            |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| IMF World Economic Outlook (projections to about 2030) | Would anchor the first years to a forecast. Reuse terms point to the "IMF Copyright and Usage" page, which I could not read, so the licence is **unverified**; the host is blocked in the sandbox. A forecast of 5 years does not change a 73-year life. |
| Penn World Table 11.0 (GGDC)                         | CC BY 4.0 (verified on its page), 185 countries, 1950 to 2023, price levels and labour share. Useful as a cross-check on WDI growth and the price level. Host blocked in the sandbox, so it needs TD-011's kind of run elsewhere. Not needed for v1. |
| Maddison Project Database                            | Long-run GDP per person, 1 CE onward. Not needed; its licence was not verified (host blocked).                                                                                     |
| Hanke and Krus, "World Hyperinflations" (Cato, 2012)  | A published list and the monthly 50% definition. A reference for wording, not a dataset we can redistribute, and monthly data is out of reach of the annual pipeline.             |
| Our World in Data                                    | Cross-check only (`docs/analysis.md`).                                                                                                                                             |

**Redenominations.** I found no primary dataset and did not verify any list; from general knowledge Turkey, Zimbabwe, Venezuela, Ghana and Brazil have all changed currencies. These are facts for event text, to be checked at the central banks' notices before use. They are not engine inputs (R1).

### R3. How the future is made: a seeded macro path from history

Each life gets a country-level path, from a new stream `macro` (named per country so migration, Phase F, can ask for another country's path). Every year it draws a fixed number of values whatever happens, as the other streams do.

1. **Anchor.** A country's long-run inflation `π*` is its 2014 to 2023 median shrunk toward its income group's median, and drifting toward the group over decades (authored: half-life 20 years). High-inflation countries thus do not compound 20% for 73 years.
2. **Ordinary years.** `log(1 + π)` follows an AR(1) with slope 0.635 around `π*` (measured), with noise from the pooled residuals.
3. **Crisis episodes.** A yearly onset hazard (pooled 0.62% since 2001, scaled by group and by whether the country had a 50% year in the last ten years, so that crises cluster in the countries that had them) starts an episode drawn **from the library of 78 real episodes**. Each library entry keeps its inflation path and the GDP-per-person growth of the same years, so the severity, length and the damage to output come together from history, not from authored parameters. The episode ends by its own path, then inflation returns to `π*` along the AR(1).
4. **Quarter-convertible.** Rates stay yearly; a quarter is `(1 + π)^(1/4) - 1` (Phase E rule, TD-004).

The library (about 78 entries of up to a dozen years) and residual pools by income group would ship as one `public/data/macro.json`, a few tens of KB raw, loaded once.

**Calibration targets** for a `calibrateMacro` gate, from section 3: births-weighted person-years at 10%+, 20%+, 50%+, 100%+ and 1,000%+ inflation within a stated tolerance of 25%, 7 to 8%, 1.3 to 1.5%, 0.7 to 0.9% and 0.1 to 0.2%; the share of lives with at least one 50% year (about 11% of births live in countries that had one since 2001); episode length and peak quantiles.

**What the game must say.** Not a forecast. "The years ahead are one possible path, drawn from how this country's prices and output have moved since the 1990s." This is a new authored group for the "How this works" section (WORLD-014) and a change to its promise (see R4).

### R4. Real growth and wage growth

Wages track output per person in the long run (labour income is 33% to 60% of GDP, median 47%, but the share is stable enough to treat wages as growing with GDP per person). The question is the trend.

**Option A, zero growth** (today). Consistent with "the odds of birth today" and wrong for a 73-year life; it makes a Chinese or Indian child's adult life look like their grandparents'.

**Option B, each country's own trend.** Contradicted by the 0.06 correlation.

**Recommended: C, the global prior.** Trend = 1.8% (global median) plus half the income group's gap from it, giving about low 1.5%, lower-middle 1.9%, upper-middle 2.3%, high 1.8% (authored, from the group means 1.1, 2.0, 2.8, 1.9). Shocks are bootstrapped from the country-years under 50% inflation of the same group (sd 4% to 6%, fat tails, including 2020), and the episode library supplies the rest. Annual income = table value at the percentile, times `G(t)` (the real growth index), times the age profile (R5), times `P(t)` to reach ledger units.

Roman decides this one because it changes the promise: the sources screen says odds of birth *today*, and a growth path is a modelled future (1.8% a year is 3.6 times over 73 years). My recommendation is yes, with the disclosure above, because a flat world is the less realistic statement.

**Base-year alignment.** The tables are survey-year values. Bring each to 2023 by the growth of GDP per person (PPP, constant, WDI `NY.GDP.PCAP.PP.KD`) between the survey year and 2023, with pass-through 0.8 (authored; household surveys grow slower than national accounts), flagged as an estimate. It affects 32 countries with a survey from 2017 or earlier. This is a data step, done first.

### R5. Age profile

ILO's three bands give a ramp, not a hump: 15 to 24 earn 0.64 of prime age, 55 to 64 earn 1.09 (employees only, so survivors and formal jobs). Interpolate to a smooth curve by age, normalise so its average over a person's working years is 1, and fall back to the income-group median where a country is missing (about 23% of births have no ILO age data). Apply it to earnings only, not to the retired or unemployed shares. Effect: youth money falls, mid-life rises, lifetime total unchanged, so the calibrated percentile outcomes hold.

### R6. Savings, debt and returns

- **Savings.** `savings × (1 + π + r_dep(π))`. `r_dep` is the group's low-inflation real deposit rate (about 0 to 1%, data -0.9 to +4.7) and falls with inflation to match the measured -21% at 20% to 200%. Cash is the only asset until the property thread adds others; hedges (dollars, goods, land) are a player choice for that thread and the natural answer in a crisis.
- **Debt.** Rate `π(t-1) + r_lend(group)`, with the group's measured real lending rate (low 8.3%, lower-middle 5.0%, upper-middle 5.7%, high 2.7%) replacing the flat 6%. A surprise rise in inflation helps the debtor for a year; in an episode formal credit is out of reach (authored: new borrowing in a year above 100% inflation carries a +20 point premium, as informal credit).
- **Fees, health costs and shocks** stay shares of the middle income at the person's country and so grow with wages (EDU-003, MONEY-005, MONEY-006). No fixed currency amounts anywhere in content.
- **Pensions** (retired 70% of earnings): in an episode they lag prices by authored indexation 0.6 of the rise. This is the part that makes old age in a crisis country hard, and the only wage-side authored parameter.

### R7. How amounts read across decades

The danger is that a figure from 2061 means nothing next to one from 2023.

**Recommended.** Every amount on screen is **real, in 2023 dollars**, with the words the game already uses ("international dollars, which adjust for what money buys in each country"). A person who becomes richer in real terms sees larger numbers; a person who loses everything to inflation sees the real value fall. The one-line comparison with prices "when you were born" is the same thing, so the player never needs to do arithmetic.

One new optional switch on the Money panel, **"Show paper money"**: the nominal ledger units of that year, labelled "scaled so one unit bought in 2023 what an international dollar buys", with a line such as "Prices here are 38 times what they were when you were born." That is the view that makes inflation feel true without inventing a currency. Real currency names, symbols and the printed redenominations are left out (R1), because they would need a table the sources cannot support and a layout that fits 6,000,000 on a phone; they can arrive later as a purely visual table if Roman wants them.

The year appears in the Money panel's note ("in 2023 dollars"). Lives archived before the change need no migration of their summary (plain data, design 2.4).

The existing "Compare with US prices" switch should be redone as what it claims: with the price level in the data (R9) it can show a market-exchange-rate figure, "about what $X buys at US prices", from data instead of a sentence.

### R8. Hyperinflation and redenomination

- **How often.** At the history's rate (R3), about 1.3% of person-years sit at 50%+ and 0.1% at 1,000%+. Over a life that is a real chance (about 11% of births live in a country that had a 50% year in the last 25 years); the calibration gate holds it to history instead of a taste.
- **What it does.** Real wages and output fall as in the episode (median -1.8% GDP per person at 50% to 1,000%, -10.9% at 1,000%+), cash savings and fixed pensions lose most of their value, debt in local currency melts while new credit disappears, and the debt-stress and savings fields in `money.ts` keep working because they compare stocks with income. A new flag `inflationCrisis` lets events speak ("The shop changes the price tags twice a day"). Health and mortality links (rationed medicines, food) are deliberately **not** built here; they would be new conditions and need the sensitivity process.
- **Tone.** Reflective and literary, never graphic, in line with `CLAUDE.md`. New events go through the `new-event` skill and `content-reviewer`.
- **Redenomination.** A currency reform ends many episodes (cut zeros, new currency). The engine ignores it (R1); the end of an episode can be narrated with an event line. Such a line states a historical fact, so it needs a verified source before it ships.
- **The mid-life reset.** A life that starts in a stable country does not begin in an episode: the macro path starts at the 2023 anchor, and an episode can only begin with the onset hazard.

### R9. Prices of things

Two uses. (1) Costs the game already has stay shares of a middle income, so they scale with wages, not with the price index alone. (2) The price level, `PPP factor / market exchange rate` for 2021 (WDI `PA.NUS.PPP`, `PA.NUS.FCRF`, 158 countries), for the US-prices view: market-dollar equivalent = international dollars × price level. It is unreliable where the official exchange rate is stale or the country is in crisis (Lebanon 2.72, Venezuela and Yemen have no PPP value), so the view shows a country only when its 2021 ratio lies between 0.2 and 1.3 (an authored guard), otherwise the existing sentence. Relative price drift (the Balassa and Samuelson effect) is not modelled; the property thread will need its own house price model (World Bank has no cross-country house price series; BIS publishes one for a limited set of countries, licence not checked).

## 5. Sources, licences and coverage in one place

| Need                          | Source and series                                            | Licence                                  | Coverage (measured)                    | Reachable in sandbox |
| ----------------------------- | ------------------------------------------------------------ | ---------------------------------------- | -------------------------------------- | -------------------- |
| Inflation                     | WDI `FP.CPI.TOTL.ZG` (IMF IFS), `NY.GDP.DEFL.KD.ZG`          | CC BY 4.0 (WDI terms, as in `sources.ts`) | 1960 to 2024; 160 / 162 of 163         | yes                  |
| Real growth, base-year uplift | WDI `NY.GDP.PCAP.KD.ZG`, `NY.GDP.PCAP.PP.KD`                 | CC BY 4.0                                | 162 / 160 of 163                       | yes                  |
| Price level                   | WDI `PA.NUS.PPP`, `PA.NUS.FCRF`                               | CC BY 4.0                                | 161 recent; 158 for 2021               | yes                  |
| Deposit and lending rates     | WDI `FR.INR.DPST`, `FR.INR.LEND`, `FR.INR.RINR`               | CC BY 4.0                                | 121 / 116 of 163 (68% / 85% of births) | yes                  |
| Earnings by age and education | ILOSTAT `EAR_EHRA_SEX_AGE_NB_A`, `EAR_EHRA_SEX_EDU_NB_A`      | The pages read state no licence; `analysis.md` lists CC BY 4.0, "to verify" | 83 countries recent (76.5% of births)  | yes (`rplumber`)     |
| Labour income share           | ILOSTAT `SDG_1041_NOC_RT_A`                                   | as above                                 | 159                                    | yes                  |
| Cross-check                   | Penn World Table 11.0                                         | CC BY 4.0 (read on the PWT page)          | 185 countries, 1950 to 2023            | no (host blocked)    |
| Not used                      | IMF WEO, Maddison, Hanke and Krus, central bank notices       | unverified / reference only              | -                                      | no                   |

Before the build: confirm the ILO licence on its terms page, and add the sources to `scripts/data/sources.ts` so the sources screen lists them. The WDI downloads here are the full history (4 MB each), not the "latest value" pattern `wdi.ts` uses, so the extractor is new. Free and non-commercial forever (Roman) leaves every one of these open to us.

## 6. Build plan

One phase, five steps; one PR each (after MVP, one PR per feature). Nothing starts until Roman says so. Proposed IDs follow the next free numbers in MONEY (MONEY-010 onward), assigned when Roman accepts the design; MONEY-008 (home ownership) stays the property thread's.

0. **Data.** Extractor for the series above, base-year uplift, a country `macro` block (`anchorInflation`, `trendGrowth`, `priceLevel`, `realLendingRate`, `realDepositRate`, `agePremium`) and `public/data/macro.json` (episode library, residual pools). `DATA_VERSION` bump, `tests/data/files.test.ts`, `docs/data-report.md` section. Needs the full `npm run data` (TD-011) in an environment that can reach every publisher.
1. **Plumbing, no change in behaviour.** `LifeState.macro` (price index, regime state), ledger units, stream `macro`, `SCHEMA_VERSION` 2 with a real migration (the first; `P = 1`, neutral regime), a version 1 fixture kept and a version 2 one added (design 2.4 checklist). With the macro switched off, a batch of lives equals the current engine exactly (a new test). Pinned RNG goldens unchanged.
2. **Inflation and instruments.** Price index in the yearly step, R6 savings, debt and pensions, display (R7 paper money, 2023 dollars label). `CONTENT_VERSION` bump. Probe and balance-report rerun and diffed against `docs/agency-probe.md` and `docs/balance-report.md` as the baseline: only what inflation should change may change.
3. **Growth and age.** `G(t)`, age profile, base-year uplift. Rerun the gates; the percentile calibration (persistence within 0.12, income rank, the 10% to 15% default-course choice band) must hold, because the nominal and growth factors are common to everyone in a country.
4. **Crises and words.** Episode library draws, `inflationCrisis` flag, events and the "How this works" paragraph (new authored group, the not-a-forecast line), `calibrateMacro` gate in `tests/engine/calibration.test.ts`, e2e and axe for the Money switch.
5. **Balance and docs.** Probe, balance report, `design.md` section 7 entry, features rows, roadmap.

Tests: engine tests first (red, then green). Property tests: price index monotone in positive-inflation years; real value of cash never increases when `r_dep + π ≤ π`; neutral macro equals old engine; replay identical for 300 random lives; ledger units finite for the library's worst episode (Venezuela 2018 repeated). Phase B's thresholds are not moved to get green.

## 7. Questions for Roman

1. **Real growth (R4).** Include a shrunk growth path (about 1.8% a year at the global median) and say so on the sources screen, or keep the world flat at today's income level? Recommended: include.
2. **Default display (R7).** Real amounts in 2023 dollars with an optional "paper money" switch, or the other way round (nominal first)? Recommended: real first.
3. **Hyperinflation (R8).** Allow lives to meet an annual 1,000% year at the history's rate (0.1% of person-years), or cap crises at, say, 200%? Recommended: allow, non-graphic, with the not-a-forecast line.
4. **Currencies.** Leave currency names and the printed redenominations out of v1 (R1, R7), as recommended, or build a display table of currencies and reform dates (new authored content that must be sourced from central banks)?

Smaller points I would settle by default unless Roman objects: ILO licence check before any ILO series ships; the IMF forecast and the cross-check datasets stay out; the age profile is in step 3.

## 8. Method and limits

- Data downloaded 2026-10-30: WDI (`api.worldbank.org/v2`, whole history 1960 to 2024) for the series in section 5, and ILOSTAT (`rplumber.ilo.org`) for earnings by age, earnings by education and the labour share. Hosts not reachable from the sandbox (so not checked): `imf.org`, `rug.nl` (PWT, Maddison), `cato.org`. PWT's licence and the Hanke and Krus definition were read through web search and page summaries, the IMF terms page only pointed elsewhere.
- Countries are the 163 in `public/data/index.json`; "episode" means consecutive years of annual inflation at 50% or more, 1992 to 2024 (earlier years are patchy and the post-Soviet break-up dominates 1992 to 1994, so since-2001 rates are the better guide for today). Annual figures cannot distinguish a one-month spike from a steady year.
- Group differences in the onset rate rest on 11 to 29 episodes each and are indicative. Median real rates by group rest on 13 to 43 countries.
- The shrinkage factors (growth gap 0.5, anchor half-life 20 years, wage indexation, pension indexation 0.6, pass-through 0.8, informal-credit premium) are authored and would join the "authored" list in design 7 and WORLD-014's disclosure; TD-009 (one `tuning` module) is the place to keep them.
- Lebanon, Venezuela, Yemen, Zimbabwe, Sudan and South Sudan have the thinnest and least reliable official series; whatever the build does for them is flagged as an estimate in the data, not hidden.
