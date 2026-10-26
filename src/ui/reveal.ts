// The birth reveal (UI-016): a quiet line of countries that ends on the real one. The country is drawn before
// anything is shown (store.begin, from stream "birth"), so this only chooses what passes and when. Nothing here is
// read by the life.
import { stream } from "../engine/rng";
import type { CountryIndex, CountryIndexEntry } from "../engine/world/types";

/** How many countries pass before the real one. */
const STOPS_MIN = 6;
const STOPS_MAX = 10;

/**
 * How long the first and the last passing name stay, and how long the whole reel runs before the real country. With
 * the settle that follows (about 2.5 s) the reveal takes about 6 s. The reel holds this for 6 or more names; fewer run
 * shorter, and ten run a little over, because no gap goes under the first one.
 */
export const REVEAL_FIRST_MS = 340;
export const REVEAL_LAST_MS = 900;
export const REVEAL_REEL_MS = 3600;

/** A country as the reveal names it; the screen puts it through `countryName`. */
export interface RevealCountry {
  iso2: string;
  name: string;
}

export interface RevealView {
  /** The country the life is lived in. */
  country: RevealCountry;
  /** The countries that pass, in order. */
  stops: RevealCountry[];
  /** About 1 in this many of the year's births are in the real country. */
  share: number;
  /** How many countries the world has, for the line under the name. */
  countries: number;
  /** Set once the reel is over (or skipped) while the country is still loading. */
  opening: boolean;
}

/**
 * The countries that pass, drawn by births per year like the real one (never evenly, which would suggest every
 * country is as likely), without the real country and without repeats. 6 to 10 of them; fewer only when the world
 * has fewer others. Deterministic for a seed; draws from its own stream.
 */
export function revealStops(seed: string, index: CountryIndex, real: CountryIndexEntry): CountryIndexEntry[] {
  const rng = stream(seed, "reveal", 0);
  const pool = index.countries.filter((c) => c.iso3 !== real.iso3 && c.birthsPerYear > 0);
  const count = Math.min(rng.int(STOPS_MIN, STOPS_MAX), pool.length);
  const stops: CountryIndexEntry[] = [];
  for (let i = 0; i < count; i++) {
    const next = rng.weighted(
      pool,
      pool.map((c) => c.birthsPerYear),
    );
    stops.push(next);
    pool.splice(pool.indexOf(next), 1);
  }
  return stops;
}

export interface RevealTimings {
  /** How long each passing name stays, in ms, from `REVEAL_FIRST_MS` to `REVEAL_LAST_MS`. */
  gaps: number[];
  /** When each passing name appears, in ms from the start: the running sum of the gaps before it. */
  delays: number[];
  /** When the real country appears: the end of the last gap. */
  settleAt: number;
}

/** The gaps for `count` names when each rises with the power `p` of how far along it is. */
const gapsFor = (count: number, p: number): number[] =>
  Array.from(
    { length: count },
    (_, i) => REVEAL_FIRST_MS + (REVEAL_LAST_MS - REVEAL_FIRST_MS) * (count > 1 ? (i / (count - 1)) ** p : 1),
  );

/**
 * The pace of the reel: slowing from about 340 ms to about 900 ms, so no more than three changes a second, and
 * for 6 to 9 names the reel takes `REVEAL_REEL_MS` (ten run a little over, and fewer than 6 run shorter). A shorter
 * list slows later; a longer one slows sooner. The shape is found by bisection, so it is a pure function of the count.
 */
export function revealTimings(count: number): RevealTimings {
  let low = 0.4;
  let high = 10;
  const total = (p: number) => gapsFor(count, p).reduce((a, b) => a + b, 0);
  // The total falls as p rises.
  for (let i = 0; i < 40; i++) {
    const mid = (low + high) / 2;
    if (total(mid) > REVEAL_REEL_MS) low = mid;
    else high = mid;
  }
  const gaps = gapsFor(count, (low + high) / 2);
  const delays: number[] = [];
  let at = 0;
  for (const gap of gaps) {
    delays.push(at);
    at += gap;
  }
  return { gaps, delays, settleAt: at };
}

const named = ({ iso2, name }: CountryIndexEntry): RevealCountry => ({ iso2, name });

/** What the reveal screen shows for a life that begins in `real`. "1 in N" uses the same births as the draw. */
export function revealView(seed: string, index: CountryIndex, real: CountryIndexEntry): RevealView {
  const total = index.countries.reduce((sum, c) => sum + c.birthsPerYear, 0);
  return {
    country: named(real),
    stops: revealStops(seed, index, real).map(named),
    share: Math.max(1, Math.round(total / real.birthsPerYear)),
    countries: index.countries.length,
    opening: false,
  };
}
