import { describe, expect, it } from "vitest";
import { createTranslator } from "../src/i18n";

const t = createTranslator({ greet: "Hello, {name}. You are {age}.", plain: "Begin a life" });

describe("translator", () => {
  it("returns plain strings", () => {
    expect(t("plain")).toBe("Begin a life");
  });

  it("fills variables", () => {
    expect(t("greet", { name: "Amara", age: 4 })).toBe("Hello, Amara. You are 4.");
  });

  it("throws on a missing key", () => {
    expect(() => t("nope")).toThrow(/nope/);
  });

  it("throws on a missing variable", () => {
    expect(() => t("greet", { name: "Amara" })).toThrow(/age/);
  });
});
