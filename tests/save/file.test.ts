// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type * as FileModule from "../../src/save/file";

describe("SAVE-006: handing a file to the browser", () => {
  let created: Blob[];
  let revoked: string[];
  let clicked: { name: string; href: string }[];
  let downloadText: typeof FileModule.downloadText;

  beforeEach(async () => {
    // The module remembers the last address it made, so each test gets its own copy.
    vi.resetModules();
    ({ downloadText } = await import("../../src/save/file"));
    created = [];
    revoked = [];
    clicked = [];
    let n = 0;
    URL.createObjectURL = vi.fn((blob: Blob) => {
      created.push(blob);
      return `blob:test-${++n}`;
    });
    URL.revokeObjectURL = vi.fn((url: string) => void revoked.push(url));
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      clicked.push({ name: this.download, href: this.href });
    });
  });

  afterEach(() => vi.restoreAllMocks());

  it("downloads the text under the name, leaving nothing on the page", async () => {
    expect(downloadText("birthright-a.json", '{"a":1}')).toBe(true);
    expect(clicked).toEqual([{ name: "birthright-a.json", href: "blob:test-1" }]);
    expect(await created[0]!.text()).toBe('{"a":1}');
    expect(created[0]!.type).toBe("application/json");
    expect(document.querySelector("a[download]")).toBeNull();
  });

  it("lets go of the earlier file's address on the next download, with no timer", () => {
    downloadText("one.json", "1");
    expect(revoked).toEqual([]);
    downloadText("two.json", "2");
    expect(revoked).toEqual(["blob:test-1"]);
  });

  it("says false, and does not throw, when the browser cannot make the file", () => {
    URL.createObjectURL = vi.fn(() => {
      throw new Error("no");
    });
    expect(downloadText("x.json", "x")).toBe(false);
  });
});

describe("SAVE-006: reading a chosen file", () => {
  let readText: typeof FileModule.readText;
  beforeEach(async () => {
    ({ readText } = await import("../../src/save/file"));
  });

  it("gives the text of the file", async () => {
    expect(await readText(new File(['{"a":1}'], "life.json"))).toBe('{"a":1}');
  });

  it("gives null, and does not throw, when the file cannot be read", async () => {
    const broken = { text: () => Promise.reject(new Error("gone")) } as unknown as File;
    expect(await readText(broken)).toBeNull();
  });
});
