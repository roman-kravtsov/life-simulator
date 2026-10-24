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
 * lives are measured in a few dollars a day and the difference matters.
 */
export const formatMoney = (amount: number, locale = DEFAULT_LOCALE) =>
  numberFormat(locale, {
    style: "currency",
    currency: "USD",
    currencyDisplay: "narrowSymbol",
    minimumFractionDigits: amount < 100 ? 2 : 0,
    maximumFractionDigits: amount < 100 ? 2 : 0,
  }).format(amount);

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
