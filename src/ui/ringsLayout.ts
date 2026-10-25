// Where the growth rings and their marks go in the figure (SUM-002, design 1.3). Pure geometry in a
// 100 by 100 view box: no React, so it can be tested on its own.
import type { Ring } from "../engine/rings";

export const VIEW_SIZE = 100;
/** The radius of the outermost ring, leaving room around it for the marks. */
export const OUTER_RADIUS = 46;
export const MARK_RADIUS = 3.6;

const CENTRE = VIEW_SIZE / 2;
/** Consecutive marks sit this far round the circle from each other, so they spread out. */
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
/** A mark that would touch another is turned by this much, round the same ring, until it fits. */
const TURN = Math.PI / 18;
const TURNS = 36;
/** The least space between two marks, so the numbers stay legible. */
const GAP = 2 * MARK_RADIUS + 0.4;
/** The first years of a long life are rings too narrow to hold a badge: badges stay at least this far from the centre... */
const MIN_BADGE_RADIUS = MARK_RADIUS * 1.6;
/** ...and one that has no room on its ring moves out by this much, with a line back to the ring. */
const STEP_OUT = MARK_RADIUS * 1.2;
const STEPS_OUT = 6;

export interface RingShape {
  /** Index in the rings given. */
  ring: number;
  age: number;
  theme: Ring["theme"];
  /** The radius the ring ends at, and the one it starts from: the ring is the band between them. */
  inner: number;
  outer: number;
}

export interface RingMark {
  /** The number of the key moment, which is also the number in the list of moments. */
  number: number;
  /** Index of the ring the mark is on. */
  ring: number;
  /** Where the numbered badge is drawn. */
  x: number;
  y: number;
  /** The middle of the ring the badge is for; the badge is on it, or a little out from it with a line to it. */
  anchorX: number;
  anchorY: number;
}

export interface RingLayout {
  shapes: RingShape[];
  marks: RingMark[];
}

/**
 * The oldest ring is innermost and each ring is as wide as its thickness, scaled so the whole life
 * fills the circle. A mark for a key moment sits in the middle of its ring; the first is at the top and
 * each next one is turned round the circle by the golden angle, then a little more if it would touch an
 * earlier mark. A badge that cannot fit on a very narrow ring near the centre, or has no room round it,
 * moves outward and keeps a line to its ring.
 */
export function layoutRings(rings: readonly Ring[]): RingLayout {
  const total = rings.reduce((sum, ring) => sum + ring.thickness, 0);
  if (total === 0) return { shapes: [], marks: [] };
  const unit = OUTER_RADIUS / total;
  let edge = 0;
  const shapes = rings.map((ring, index): RingShape => {
    const inner = edge;
    edge += ring.thickness * unit;
    return {
      ring: index,
      age: ring.age,
      theme: ring.theme,
      inner,
      outer: index === rings.length - 1 ? OUTER_RADIUS : edge,
    };
  });

  const marks: RingMark[] = [];
  const numbered = rings
    .map((ring, index) => ({ number: ring.moment, index }))
    .filter((entry): entry is { number: number; index: number } => entry.number !== undefined)
    .sort((a, b) => a.number - b.number);
  for (const { number, index } of numbered) {
    const shape = shapes[index]!;
    const onRing = (shape.inner + shape.outer) / 2;
    const first = -Math.PI / 2 + (number - 1) * GOLDEN_ANGLE;
    const at = (radius: number, turns: number) => {
      const angle = first + turns * TURN;
      return { x: CENTRE + radius * Math.cos(angle), y: CENTRE + radius * Math.sin(angle) };
    };
    const nearest = (spot: { x: number; y: number }) =>
      marks.reduce((least, mark) => Math.min(least, Math.hypot(mark.x - spot.x, mark.y - spot.y)), Infinity);
    const home = Math.max(onRing, MIN_BADGE_RADIUS);
    let best = at(home, 0);
    let room = nearest(best);
    for (let out = 0; out < STEPS_OUT && room < GAP; out++) {
      const radius = Math.min(home + out * STEP_OUT, OUTER_RADIUS);
      for (let turns = 0; turns < TURNS && room < GAP; turns++) {
        const spot = at(radius, turns);
        const space = nearest(spot);
        if (space > room) [best, room] = [spot, space];
      }
    }
    // The badge turned on its own ring is at the same angle as the ring's anchor; a moved one is joined to it.
    const angle = Math.atan2(best.y - CENTRE, best.x - CENTRE);
    marks.push({
      number,
      ring: index,
      ...best,
      anchorX: CENTRE + onRing * Math.cos(angle),
      anchorY: CENTRE + onRing * Math.sin(angle),
    });
  }
  return { shapes, marks };
}
