import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { readCsv, splitCsvLine } from "../../scripts/data/lib/csv";

const rows = async (path: string) => {
  const out: Record<string, string>[] = [];
  for await (const row of readCsv(path)) out.push(row);
  return out;
};

describe("splitCsvLine", () => {
  it("splits on commas and keeps empty cells", () => {
    expect(splitCsvLine("a,,c")).toEqual(["a", "", "c"]);
  });

  it("honours quotes, commas inside quotes and doubled quotes", () => {
    expect(splitCsvLine('"x, y","say ""hi""",z')).toEqual(["x, y", 'say "hi"', "z"]);
  });
});

describe("readCsv", () => {
  const dir = mkdtempSync(join(tmpdir(), "csv-"));

  it("reads rows keyed by header, dropping a byte-order mark", async () => {
    const path = join(dir, "plain.csv");
    writeFileSync(path, "﻿code,value\r\nAFG,1\r\n\r\nALB,2\r\n");
    expect(await rows(path)).toEqual([
      { code: "AFG", value: "1" },
      { code: "ALB", value: "2" },
    ]);
  });

  it("reads gzipped files", async () => {
    const path = join(dir, "zipped.csv.gz");
    writeFileSync(path, gzipSync("a,b\n1,2\n"));
    expect(await rows(path)).toEqual([{ a: "1", b: "2" }]);
  });
});
