// Minimal .xlsx reader for the WHO workbook: unzips with the system `unzip` and reads cell text.
import { execFileSync } from "node:child_process";

const unzipText = (file: string, entry: string) =>
  execFileSync("unzip", ["-p", file, entry], { encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });

const decode = (text: string) =>
  text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");

/** One row: column letters ("A", "H", "AB") to the cell's text. Empty cells are absent. */
export type Row = Record<string, string>;

/** The rows of every sheet, keyed by sheet name. */
export function readWorkbook(file: string): Map<string, Row[]> {
  const sharedXml = unzipText(file, "xl/sharedStrings.xml");
  const shared = [...sharedXml.matchAll(/<si>(.*?)<\/si>/gs)].map((m) => decode(m[1]!.replace(/<[^>]+>/g, "")));

  const workbook = unzipText(file, "xl/workbook.xml");
  const rels = unzipText(file, "xl/_rels/workbook.xml.rels");
  const targets = new Map(
    [...rels.matchAll(/<Relationship\b[^>]*>/g)].map((m) => [
      /\bId="([^"]+)"/.exec(m[0])![1]!,
      /\bTarget="([^"]+)"/.exec(m[0])![1]!,
    ]),
  );

  const sheets = new Map<string, Row[]>();
  for (const m of workbook.matchAll(/<sheet\b[^>]*>/g)) {
    const name = decode(/\bname="([^"]*)"/.exec(m[0])![1]!);
    const target = targets.get(/\br:id="([^"]+)"/.exec(m[0])![1]!)!;
    const xml = unzipText(file, `xl/${target.replace(/^\/?(xl\/)?/, "")}`);
    const rows: Row[] = [];
    for (const rowMatch of xml.matchAll(/<row\b[^>]*>(.*?)<\/row>/gs)) {
      const row: Row = {};
      for (const cell of rowMatch[1]!.matchAll(/<c r="([A-Z]+)\d+"([^>]*?)(?:\/>|>(.*?)<\/c>)/gs)) {
        const value = /<v>(.*?)<\/v>/s.exec(cell[3] ?? "")?.[1];
        if (value === undefined) continue;
        row[cell[1]!] = cell[2]!.includes('t="s"') ? shared[Number(value)]! : decode(value);
      }
      rows.push(row);
    }
    sheets.set(name, rows);
  }
  return sheets;
}
