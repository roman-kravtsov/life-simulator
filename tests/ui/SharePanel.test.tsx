// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { shareText } from "../../src/ui/share";
import { shareCardSvg } from "../../src/ui/shareCard";
import { SharePanel, type SharePanelProps } from "../../src/ui/SharePanel";
import { makeCountry } from "../fixtures/country";
import { finishedLife } from "./fakes";

const { summary } = finishedLife("share-panel-1", makeCountry({ region: "Western Africa" }));
const png = new Blob(["png"], { type: "image/png" });

describe("SHARE-001 and SHARE-002: the share panel", () => {
  it("copies the text and says so", async () => {
    const copy = vi.fn().mockResolvedValue(true);
    render(<SharePanel summary={summary} copy={copy} />);
    await userEvent.click(screen.getByRole("button", { name: "Copy as text" }));
    expect(copy).toHaveBeenCalledWith(shareText(summary));
    expect(await screen.findByText(`Copied the text about ${summary.name}.`)).toBeVisible();
  });

  it("shows the text to select when the browser will not copy, and says why", async () => {
    render(<SharePanel summary={summary} copy={() => Promise.resolve(false)} />);
    const details = screen.getByText("The text").closest("details")!;
    expect(details.open).toBe(false);
    await userEvent.click(screen.getByRole("button", { name: "Copy as text" }));
    expect(await screen.findByText(/would not copy the text/)).toBeVisible();
    expect(details.open).toBe(true);
    expect(details).toHaveTextContent(summary.name);
  });

  it("saves the rings as a picture named after the seed, and says where", async () => {
    const makeImage = vi.fn().mockResolvedValue(png);
    const save = vi.fn().mockReturnValue(true);
    render(<SharePanel summary={summary} makeImage={makeImage} save={save} />);
    await userEvent.click(screen.getByRole("button", { name: "Save the rings as an image" }));
    expect(makeImage).toHaveBeenCalledWith(shareCardSvg(summary), 1200, 1500);
    const fileName = `birthright-${summary.seed}.png`;
    expect(save).toHaveBeenCalledWith(fileName, png);
    expect(await screen.findByText(`Saved the picture as ${fileName}, in your downloads.`)).toBeVisible();
  });

  const failures: [string, SharePanelProps["makeImage"], SharePanelProps["save"]][] = [
    ["makes no picture", () => Promise.resolve(null), () => true],
    ["cannot hand it over", () => Promise.resolve(png), () => false],
  ];
  it.each(failures)("says so when the browser %s", async (_name, makeImage, save) => {
    render(<SharePanel summary={summary} makeImage={makeImage} save={save} />);
    await userEvent.click(screen.getByRole("button", { name: "Save the rings as an image" }));
    expect(await screen.findByText("Your browser could not make the picture.")).toBeVisible();
  });

  it("says that nothing leaves the browser", () => {
    render(<SharePanel summary={summary} />);
    expect(screen.getByText(/nothing is sent anywhere/)).toBeVisible();
    expect(screen.getByRole("region", { name: "Keep this life" })).toBeVisible();
  });
});
