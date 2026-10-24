// Downloads source files into .cache/data (git-ignored) and records what was fetched.
// Re-running the pipeline reuses cached files unless --refresh is passed.
import { createHash } from "node:crypto";
import {
  createReadStream,
  createWriteStream,
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

export const CACHE_DIR = join(process.cwd(), ".cache", "data");
const MANIFEST = join(CACHE_DIR, "manifest.json");

/** Several publishers (World Bank, ILO) answer 5xx or empty bodies to clients without a browser-like agent. */
const USER_AGENT =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36 BirthrightDataPipeline/1";

export interface Fetched {
  url: string;
  /** ISO date of the download. */
  accessed: string;
  bytes: number;
  sha256: string;
}

type Manifest = Record<string, Fetched>;

const readManifest = (): Manifest => (existsSync(MANIFEST) ? JSON.parse(readFileSync(MANIFEST, "utf8")) : {});

const sha256 = (path: string) =>
  new Promise<string>((resolve, reject) => {
    const hash = createHash("sha256");
    createReadStream(path)
      .on("data", (chunk) => hash.update(chunk))
      .on("end", () => resolve(hash.digest("hex")))
      .on("error", reject);
  });

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Fetches with retries and a browser-like agent; throws on a non-OK status or an empty body. */
export async function fetchWithRetry(url: string, attempts = 5): Promise<Response> {
  let lastError: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      const response = await fetch(url, { headers: { "user-agent": USER_AGENT } });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response;
    } catch (error) {
      lastError = error;
      await sleep(1000 * 2 ** i);
    }
  }
  throw new Error(`Could not download ${url}: ${(lastError as Error).message}`);
}

/** Downloads `url` to `.cache/data/<name>` unless it is already there; returns the local path. */
export async function download(name: string, url: string, refresh = false): Promise<string> {
  const path = join(CACHE_DIR, name);
  const manifest = readManifest();
  if (!refresh && existsSync(path) && manifest[name]) return path;

  mkdirSync(dirname(path), { recursive: true });
  console.log(`  downloading ${url}`);
  for (let attempt = 0; ; attempt++) {
    const response = await fetchWithRetry(url);
    try {
      await pipeline(Readable.fromWeb(response.body as never), createWriteStream(path));
      break;
    } catch (error) {
      if (attempt >= 2) throw error;
    }
  }
  const bytes = statSync(path).size;
  if (bytes === 0) throw new Error(`Download of ${url} was empty`);

  manifest[name] = { url, accessed: new Date().toISOString().slice(0, 10), bytes, sha256: await sha256(path) };
  writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + "\n");
  return path;
}

/** The recorded download for a cached file, for source access dates. */
export function fetched(name: string): Fetched {
  const entry = readManifest()[name];
  if (!entry) throw new Error(`${name} has not been downloaded`);
  return entry;
}
