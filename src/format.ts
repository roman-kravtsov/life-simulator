// Locale-aware numbers, money and country names (L10N-002, L10N-003). Every number the
// player sees goes through here so a new language only needs a locale code.
import { DEFAULT_LOCALE } from "./i18n";

const numberFormats = new Map<string, Intl.NumberFormat>();
const regionNames = new Map<string, Intl.DisplayNames>();

function numberFormat(locale: string, options: Intl.NumberFormatOptions) {
  const key = `${locale}|${JSON.stringify(options)}`;
  let format = numberFormats.get(key);
  if (!format) numberFormats.set(key, (format = new Intl.NumberFormat(locale, options)));
  return format;
}

export const formatNumber = (value: number, locale = DEFAULT_LOCALE, options: Intl.NumberFormatOptions = {}) =>
  numberFormat(locale, { maximumFractionDigits: 0, ...options }).format(value);

/** A share between 0 and 1 as a percentage. */
export const formatPercent = (share: number, locale = DEFAULT_LOCALE, fractionDigits = 0) =>
  numberFormat(locale, {
    style: "percent",
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(share);

/** "134 million" rather than "134,000,000". */
export const formatCompactNumber = (value: number, locale = DEFAULT_LOCALE) =>
  numberFormat(locale, { notation: "compact", compactDisplay: "long", maximumFractionDigits: 1 }).format(value);

/**
 * Amounts in international (PPP) dollars. Cents show below 100, because the poorest
 * lives are measured in a few dollars a day and the difference matters. This is the one
 * formatter for every dollar amount the player sees (MONEY-007).
 */
export const formatMoney = (amount: number, locale = DEFAULT_LOCALE) =>
  numberFormat(locale, {
    style: "currency",
    currency: "USD",
    currencyDisplay: "narrowSymbol",
    minimumFractionDigits: amount < 100 ? 2 : 0,
    maximumFractionDigits: amount < 100 ? 2 : 0,
  }).format(amount);

export type IncomeBand = "below-extreme" | "near-extreme" | "low" | "modest" | "comfortable" | "wealthy";

// Daily income per person in international dollars. The first three cuts are the World Bank's
// international poverty lines at 2021 PPP (June 2025 update): 3.00 for extreme poverty, 4.20 for
// lower-middle-income countries, 8.30 for upper-middle-income countries. The cuts at 20 and 60 are
// the game's own wording thresholds, not published lines.
const INCOME_CUTS: readonly (readonly [number, IncomeBand])[] = [
  [3.0, "below-extreme"],
  [4.2, "near-extreme"],
  [8.3, "low"],
  [20, "modest"],
  [60, "comfortable"],
];

/** Which band of daily income per person an amount falls in (MONEY-007); the words live in `money.band.<id>`. */
export function incomeBand(dailyAmount: number): IncomeBand {
  return INCOME_CUTS.find(([cut]) => dailyAmount < cut)?.[1] ?? "wealthy";
}

/** The string key for a count in the locale's plural form: `common.years` and 1 give `common.years.one`. */
export const pluralKey = (base: string, count: number, locale = DEFAULT_LOCALE) =>
  `${base}.${new Intl.PluralRules(locale).select(count)}`;

/** A phrase with its first letter in upper case, for names that are written in lower case in the strings. */
export const capitalise = (text: string, locale = DEFAULT_LOCALE) =>
  text.charAt(0).toLocaleUpperCase(locale) + text.slice(1);

/** The country's name in `locale` from CLDR, or the source's English name when CLDR has none. */
export function countryName(country: { iso2: string; name: string }, locale = DEFAULT_LOCALE): string {
  try {
    let names = regionNames.get(locale);
    if (!names) regionNames.set(locale, (names = new Intl.DisplayNames(locale, { type: "region", fallback: "none" })));
    return (country.iso2 && names.of(country.iso2)) || country.name;
  } catch {
    return country.name;
  }
}

/** An ISO date (2026-10-24) as a long date in `locale`, independent of the player's time zone. */
export const formatDate = (isoDate: string, locale = DEFAULT_LOCALE) =>
  new Intl.DateTimeFormat(locale, { dateStyle: "long", timeZone: "UTC" }).format(new Date(`${isoDate}T00:00:00Z`));

/** The day a moment happened (an ISO timestamp) as a long date, in the player's own time zone unless one is given. */
export const formatDay = (isoTime: string, locale = DEFAULT_LOCALE, timeZone?: string) =>
  new Intl.DateTimeFormat(locale, { dateStyle: "long", ...(timeZone ? { timeZone } : {}) }).format(new Date(isoTime));

/** Words joined the way the language does ("a and b", "a, b, and c" in English). */
export const formatList = (items: readonly string[], locale = DEFAULT_LOCALE) =>
  new Intl.ListFormat(locale, { style: "long", type: "conjunction" }).format(items);
