import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { en } from "../src/content/strings/en";

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? sourceFiles(path) : /\.tsx?$/.test(path) ? [path] : [];
  });
}

const unseededRandom = (source: string) => /Math\s*\.\s*random\s*\(/.test(source);
const trackingCode = (source: string) =>
  /google-analytics|googletagmanager|gtag\(|plausible\.io|\bplausible\s*\(|segment\.com|mixpanel|posthog|sendBeacon/i.test(
    source,
  );

describe("RNG-005: no unseeded randomness in the engine", () => {
  it("detects Math.random()", () => {
    expect(unseededRandom("const x = Math.random();")).toBe(true);
    expect(unseededRandom("const x = Math . random ( );")).toBe(true);
    expect(unseededRandom("const x = rng.next();")).toBe(false);
  });

  it.each(sourceFiles("src/engine"))("%s does not call Math.random()", (file) => {
    expect(unseededRandom(readFileSync(file, "utf8"))).toBe(false);
  });
});

describe("ANLT-001: no tracking", () => {
  it("detects common tracking code", () => {
    expect(trackingCode("<script src='https://www.googletagmanager.com/gtag/js'>")).toBe(true);
    expect(trackingCode("render(app)")).toBe(false);
    expect(trackingCode("plausible('event')")).toBe(true);
    expect(trackingCode("// implausible year")).toBe(false);
    expect(trackingCode("a plausible reference year")).toBe(false);
  });

  it.each([...sourceFiles("src"), "index.html"])("%s contains no tracking code", (file) => {
    expect(trackingCode(readFileSync(file, "utf8"))).toBe(false);
  });
});

// Money is shown through formatMoney in src/format.ts, so the unit and the rounding are the same everywhere (MONEY-007).
const formatsNumbersItself = (source: string) =>
  /Intl\s*\.\s*NumberFormat|\btoLocaleString\s*\(|\bcurrency\b/.test(source);

describe("MONEY-007: amounts are formatted in one place", () => {
  it("detects hand-made number formatting", () => {
    expect(formatsNumbersItself('new Intl.NumberFormat("en", { style: "currency" })')).toBe(true);
    expect(formatsNumbersItself("amount.toLocaleString()")).toBe(true);
    expect(formatsNumbersItself("formatMoney(amount)")).toBe(false);
  });

  it.each(sourceFiles("src").filter((f) => f !== join("src", "format.ts")))("%s", (file) => {
    expect(formatsNumbersItself(readFileSync(file, "utf8"))).toBe(false);
  });
});

describe("L10N-001: every string key used in the code exists", () => {
  it.each(sourceFiles("src"))("%s", (file) => {
    const keys = [...readFileSync(file, "utf8").matchAll(/\bt\(\s*"([^"]+)"/g)].map((m) => m[1]!);
    for (const key of keys) expect(en, `missing string "${key}"`).toHaveProperty([key]);
  });
});

// JSX text between tags, e.g. <p>Hello</p>, must come from t(). Expressions like {t("x")} are fine. The source is
// parsed as TSX, so only real JSX text nodes count, and code between two tags never does.
const hardCodedJsxText = (source: string) => {
  const file = ts.createSourceFile("source.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const found: string[] = [];
  const visit = (node: ts.Node) => {
    if (ts.isJsxText(node) && /[A-Za-z]/.test(node.text)) found.push(node.text.trim());
    ts.forEachChild(node, visit);
  };
  visit(file);
  return found;
};

describe("L10N-001: no hard-coded text in the UI", () => {
  it("detects text between JSX tags", () => {
    expect(hardCodedJsxText("const a = <p>Begin a life</p>;")).toEqual(["Begin a life"]);
    expect(hardCodedJsxText('const a = <p>{t("start.begin")}</p>;')).toEqual([]);
    expect(hardCodedJsxText("const ref = useRef<HTMLElement>();\n  return (<p />);")).toEqual([]);
    expect(hardCodedJsxText("const a = (\n <A />\n );\n const b = (\n <B />\n );")).toEqual([]);
    expect(hardCodedJsxText("const rings = useMemo(() => layout(x), [x]);\n return (<p />);")).toEqual([]);
    expect(hardCodedJsxText("const a = <p><br />Hello <b /></p>;")).toEqual(["Hello"]);
  });

  it("catches text that starts like code, which a pattern on the source would let through", () => {
    expect(hardCodedJsxText("const a = <p>); not code</p>;")).toEqual(["); not code"]);
    expect(hardCodedJsxText("const a = <p>a => b</p>;")).toEqual(["a => b"]);
  });

  it.each(sourceFiles("src/ui").filter((f) => f.endsWith(".tsx")))("%s", (file) => {
    expect(hardCodedJsxText(readFileSync(file, "utf8"))).toEqual([]);
  });

  it("index.html has no visible text outside the title", () => {
    const body = readFileSync("index.html", "utf8").split("<body>")[1]!;
    expect(hardCodedJsxText(`const page = <>${body}</>;`)).toEqual([]);
  });
});

describe("TIME-001: the game only moves when the player acts", () => {
  const timers = (source: string) => /\b(setTimeout|setInterval|requestAnimationFrame)\s*\(/.test(source);

  it("detects timers", () => {
    expect(timers("setInterval(tick, 1000)")).toBe(true);
    expect(timers("requestAnimationFrame(loop)")).toBe(true);
    expect(timers("advance(state, input)")).toBe(false);
  });

  it.each(sourceFiles("src"))("%s starts no timers", (file) => {
    expect(timers(readFileSync(file, "utf8"))).toBe(false);
  });
});

describe("SAVE-007: everything stored in the browser can be found and deleted", () => {
  const storageKeys = (source: string) =>
    [...source.matchAll(/\b(?:localStorage|storage)\s*\.\s*(?:getItem|setItem|removeItem)\(\s*"([^"]*)"/g)].map(
      (m) => m[1]!,
    );

  it("finds the keys a file uses", () => {
    expect(storageKeys('localStorage.getItem("birthright:theme")')).toEqual(["birthright:theme"]);
    expect(storageKeys('localStorage.setItem("theme", x)')).toEqual(["theme"]);
  });

  // A key kept in a constant, such as `const KEY = "birthright:theme"`, counts too.
  const keyConstants = (source: string) =>
    [...source.matchAll(/\b(?:const|let)\s+\w*KEY\w*\s*=\s*"([^"]*)"/g)].map((m) => m[1]!);

  it("finds the keys kept in constants", () => {
    expect(keyConstants('const KEY = "birthright:theme";')).toEqual(["birthright:theme"]);
    expect(keyConstants('const CURRENT_KEY = "current";')).toEqual(["current"]);
  });

  it.each(sourceFiles("src"))("%s keeps its localStorage keys under the birthright: prefix", (file) => {
    const source = readFileSync(file, "utf8");
    for (const key of [...storageKeys(source), ...keyConstants(source)])
      expect(key.startsWith("birthright:")).toBe(true);
  });
});
