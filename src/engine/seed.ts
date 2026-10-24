// Readable seeds (RNG-003): two words and four digits, like "amber-river-4821".
// The random source is passed in so the engine itself stays free of unseeded randomness;
// the browser supplies it from crypto when a new life starts.

const ADJECTIVES = `amber ashen autumn bitter bright brisk calm clear cold copper crisp dawn deep dusky early faint
  fallow fern first gentle gilded golden grey hollow hushed idle inland iron ivory keen late lean light long low
  mellow mild misty modest narrow north open pale patient plain quiet rough russet salt sandy shaded silent silver
  slow soft still stony summer swift tawny thin tidal warm west wild winter wooden young`.split(/\s+/);

const NOUNS = `acre alder anchor ash barley basin bay bell birch bridge brook cedar cliff clover coast cove creek dune
  elm ember falcon field fig fjord flint ford forest furrow garden gate glen grove harbour hazel heron hill hearth
  island juniper kiln lake lantern larch lark ledge lily maple marsh meadow mill moor oak orchard otter pasture pine
  pond quarry reed ridge river rowan sage shore spring stone stream thistle tide valley willow wren`.split(/\s+/);

export const SEED_PATTERN = /^[a-z]+-[a-z]+-\d{4}$/;

/** `random` returns a float in [0, 1). */
export function readableSeed(random: () => number): string {
  const pick = <T>(items: readonly T[]) => items[Math.min(items.length - 1, Math.floor(random() * items.length))]!;
  const digits = String(Math.min(9999, Math.floor(random() * 10000))).padStart(4, "0");
  return `${pick(ADJECTIVES)}-${pick(NOUNS)}-${digits}`;
}
