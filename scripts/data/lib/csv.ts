// Streaming CSV reader for the large source files (plain or gzipped).
import { createReadStream } from "node:fs";
import { createInterface } from "node:readline";
import { createGunzip } from "node:zlib";

/** Splits one CSV line, honouring double quotes. */
export function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") {
      cells.push(cell);
      cell = "";
    } else cell += ch;
  }
  cells.push(cell);
  return cells;
}

/** Yields each row as an object keyed by the header. Rows must not contain line breaks inside quotes. */
export async function* readCsv(path: string): AsyncGenerator<Record<string, string>> {
  const raw = createReadStream(path);
  const input = path.endsWith(".gz") ? raw.pipe(createGunzip()) : raw;
  let header: string[] | undefined;
  for await (const line of createInterface({ input, crlfDelay: Infinity })) {
    if (!line) continue;
    const cells = splitCsvLine(header ? line : line.replace(/^﻿/, ""));
    if (!header) {
      header = cells;
      continue;
    }
    const row: Record<string, string> = {};
    header.forEach((name, i) => (row[name] = cells[i] ?? ""));
    yield row;
  }
}
