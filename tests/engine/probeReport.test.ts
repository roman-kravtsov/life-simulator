// The agency probe's Markdown report (ADMIN-005): the targets, the plans, the shares and the decisions.
import { describe, expect, it } from "vitest";
import { probeDecisions, probeStrategies, type LifeSpec } from "../../src/engine/probe";
import { renderProbeReport } from "../../src/engine/probeReport";
import { makeCountry } from "../fixtures/country";

const country = makeCountry({ region: "Western Africa" });
const specs: LifeSpec[] = Array.from({ length: 12 }, (_, i) => ({ seed: `report-${i}`, country }));

describe("renderProbeReport", () => {
  const report = renderProbeReport({
    strategies: probeStrategies(specs),
    decisions: probeDecisions(specs),
    seed: "report",
    decisionLives: 12,
    contentVersion: "2026.10.3",
    dataVersion: "2026.10.1",
  });

  it("says what it was made from", () => {
    expect(report).toContain("Seed `report`, content version 2026.10.3, data version 2026.10.1.");
    expect(report).toContain("12 lives");
  });
  it("has a section for the targets, the plans, the shares, the means and the decisions", () => {
    for (const heading of [
      "## Balance targets",
      "## What each plan changes",
      "## What shaped the life (summary shares)",
      "## Mean outcomes",
      "## What each decision's choices change",
    ]) {
      expect(report).toContain(heading);
    }
  });
  it("has a row for every plan but the default in the changes table, and one for each in the shares", () => {
    const changes = report.split("## What each plan changes")[1]!.split("##")[0]!;
    expect(changes).toContain("| One point moved to learn |");
    expect(changes).not.toContain("| Default course |");
    expect(report.split("## What shaped the life")[1]!).toContain("| Default course |");
  });
  it("shows no NaN", () => {
    expect(report).not.toContain("NaN");
  });
});
