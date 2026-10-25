// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { useState } from "react";
import {
  Button,
  ConfirmDialog,
  Dialog,
  Slider,
  Stepper,
  Switch,
  TabPanel,
  Tabs,
  TextField,
  Tooltip,
} from "../../src/ui/kit";

function Counted({ max = 3, onChange }: { max?: number; onChange?: (value: number) => void }) {
  const [value, setValue] = useState(1);
  return (
    <Stepper
      label="Learn"
      description="Skills and school."
      value={value}
      minValue={0}
      maxValue={max}
      onChange={(next) => {
        setValue(next);
        onChange?.(next);
      }}
    />
  );
}

describe("kit", () => {
  it("Button fires onPress by mouse and by keyboard", async () => {
    const user = userEvent.setup();
    const onPress = vi.fn();
    render(<Button onPress={onPress}>Go</Button>);
    const button = screen.getByRole("button", { name: "Go" });
    await user.click(button);
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(button).toHaveFocus(); // a press moves focus to the button
    await user.keyboard("{Enter}");
    await user.keyboard(" ");
    expect(onPress).toHaveBeenCalledTimes(3);
  });

  it("Tooltip appears on keyboard focus, describes its trigger and closes with Escape", async () => {
    const user = userEvent.setup();
    render(
      <Tooltip text="Raises your odds a little">
        <Button>Learn</Button>
      </Tooltip>,
    );
    await user.tab();
    const tip = await screen.findByRole("tooltip");
    expect(tip).toHaveTextContent("Raises your odds a little");
    expect(screen.getByRole("button", { name: "Learn" })).toHaveAccessibleDescription("Raises your odds a little");
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("Switch toggles with the keyboard", async () => {
    const user = userEvent.setup();
    render(<Switch>Soften hard topics</Switch>);
    const toggle = screen.getByRole("switch", { name: "Soften hard topics" });
    expect(toggle).not.toBeChecked();
    await user.tab();
    await user.keyboard(" ");
    expect(toggle).toBeChecked();
  });

  it("Slider is labelled and changes with arrow keys", async () => {
    const user = userEvent.setup();
    render(<Slider label="Learn" minValue={0} maxValue={3} step={1} defaultValue={1} />);
    const thumb = screen.getByRole("slider", { name: "Learn" });
    expect(thumb).toHaveValue("1");
    await user.tab();
    await user.keyboard("{ArrowRight}");
    expect(thumb).toHaveValue("2");
  });

  it("Dialog opens, labels itself with its title and closes with Escape", async () => {
    const user = userEvent.setup();
    render(
      <Dialog trigger={<Button>Open</Button>} title="Settings" closeLabel="Close">
        <p>Body</p>
      </Dialog>,
    );
    await user.click(screen.getByRole("button", { name: "Open" }));
    expect(screen.getByRole("dialog", { name: "Settings" })).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("Stepper is a labelled number field with a description, changed by arrow keys and stopped at its limits", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Counted max={2} onChange={onChange} />);
    const spin = screen.getByRole("textbox", { name: "Learn" });
    expect(spin).toHaveAccessibleDescription("Skills and school.");
    expect(spin).toHaveValue("1");
    await user.tab();
    expect(spin).toHaveFocus();
    await user.keyboard("{ArrowUp}");
    expect(spin).toHaveValue("2");
    await user.keyboard("{ArrowUp}");
    expect(spin).toHaveValue("2");
    await user.keyboard("{ArrowDown}{ArrowDown}{ArrowDown}");
    expect(spin).toHaveValue("0");
    expect(onChange).toHaveBeenLastCalledWith(0);
  });

  it("Stepper in its compact form keeps the description for assistive technology and shows only the note", () => {
    render(
      <Stepper
        label="Health"
        description="Health and care."
        note="1 point already taken."
        compact
        value={1}
        minValue={0}
        maxValue={2}
      />,
    );
    expect(screen.getByRole("textbox", { name: "Health" })).toHaveAccessibleDescription(
      "Health and care. 1 point already taken.",
    );
    expect(screen.getByText("Health and care.")).toHaveClass("visually-hidden");
    expect(screen.getByText("1 point already taken.")).not.toHaveClass("visually-hidden");
  });

  it("Stepper has plus and minus buttons for touch, which stop working at the limits", async () => {
    const user = userEvent.setup();
    render(<Counted max={2} />);
    const [minus, plus] = screen.getAllByRole("button");
    await user.click(plus!);
    expect(screen.getByRole("textbox", { name: "Learn" })).toHaveValue("2");
    expect(plus).toBeDisabled();
    await user.click(minus!);
    await user.click(minus!);
    expect(screen.getByRole("textbox", { name: "Learn" })).toHaveValue("0");
    expect(minus).toBeDisabled();
  });

  it("Stepper can be disabled", () => {
    render(<Stepper label="Earn" value={0} minValue={0} maxValue={0} isDisabled />);
    expect(screen.getByRole("textbox", { name: "Earn" })).toBeDisabled();
  });

  it("TextField is labelled, described by its hint, limited in length and edited by keyboard", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    function Field() {
      const [value, setValue] = useState("");
      return (
        <TextField
          label="A few words"
          description={`${5 - value.length} left`}
          maxLength={5}
          value={value}
          onChange={(next) => {
            setValue(next);
            onChange(next);
          }}
        />
      );
    }
    render(<Field />);
    const field = screen.getByRole("textbox", { name: "A few words" });
    expect(field).toHaveAccessibleDescription("5 left");
    await user.tab();
    expect(field).toHaveFocus();
    await user.keyboard("abcdefgh");
    expect(field).toHaveValue("abcde");
    expect(field).toHaveAccessibleDescription("0 left");
    expect(onChange).toHaveBeenLastCalledWith("abcde");
  });

  it("TextField can be disabled", () => {
    render(<TextField label="Name" isDisabled />);
    expect(screen.getByRole("textbox", { name: "Name" })).toBeDisabled();
  });

  it("ConfirmDialog asks first: Escape and the cancel button change nothing, the confirm button acts and closes", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(
      <ConfirmDialog
        trigger={<Button>Delete</Button>}
        title="Delete this?"
        confirmLabel="Yes, delete"
        cancelLabel="Keep it"
        onConfirm={onConfirm}
      >
        <p>It cannot be undone.</p>
      </ConfirmDialog>,
    );
    await user.click(screen.getByRole("button", { name: "Delete" }));
    expect(
      screen.getByRole("alertdialog", { name: "Delete this?", description: /It cannot be undone\./ }),
    ).toBeInTheDocument();
    // The safe answer has focus, so Enter does not delete by accident.
    expect(screen.getByRole("button", { name: "Keep it" })).toHaveFocus();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("button", { name: "Delete" })).toHaveFocus());
    await user.click(screen.getByRole("button", { name: "Delete" }));
    await user.click(screen.getByRole("button", { name: "Keep it" }));
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(onConfirm).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Delete" }));
    await user.tab();
    expect(screen.getByRole("button", { name: "Yes, delete" })).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });
  describe("Tabs", () => {
    const tabs = [
      { id: "family", label: "Family" },
      { id: "country", label: "Country" },
      { id: "notes", label: "Notes" },
    ];

    function Around({ onSelect }: { onSelect?: (key: string) => void }) {
      const [selected, setSelected] = useState("family");
      return (
        <Tabs
          label="Around you"
          tabs={tabs}
          selectedKey={selected}
          onSelectionChange={(key) => {
            setSelected(key);
            onSelect?.(key);
          }}
        >
          <TabPanel id="family">Marta and Paulo</TabPanel>
          <TabPanel id="country">Life expectancy</TabPanel>
          <TabPanel id="notes">Nothing yet</TabPanel>
        </Tabs>
      );
    }

    it("is a labelled tab list with the selected tab's panel, named by its tab", () => {
      render(<Around />);
      expect(screen.getByRole("tablist", { name: "Around you" })).toBeInTheDocument();
      expect(screen.getByRole("tab", { name: "Family" })).toHaveAttribute("aria-selected", "true");
      expect(screen.getByRole("tab", { name: "Country" })).toHaveAttribute("aria-selected", "false");
      expect(screen.getByRole("tabpanel", { name: "Family" })).toHaveTextContent("Marta and Paulo");
      expect(screen.queryByText("Life expectancy")).not.toBeInTheDocument();
    });

    it("moves between tabs with the arrow keys, Home and End, and shows each panel", async () => {
      const user = userEvent.setup();
      const onSelect = vi.fn();
      render(<Around onSelect={onSelect} />);
      await user.tab();
      expect(screen.getByRole("tab", { name: "Family" })).toHaveFocus();
      await user.keyboard("{ArrowRight}");
      expect(screen.getByRole("tab", { name: "Country" })).toHaveFocus();
      expect(screen.getByRole("tab", { name: "Country" })).toHaveAttribute("aria-selected", "true");
      expect(screen.getByRole("tabpanel", { name: "Country" })).toHaveTextContent("Life expectancy");
      await user.keyboard("{End}");
      expect(screen.getByRole("tab", { name: "Notes" })).toHaveFocus();
      expect(onSelect).toHaveBeenLastCalledWith("notes");
      await user.keyboard("{ArrowRight}");
      expect(screen.getByRole("tab", { name: "Family" })).toHaveFocus();
      await user.keyboard("{ArrowLeft}");
      expect(screen.getByRole("tab", { name: "Notes" })).toHaveFocus();
      await user.keyboard("{Home}");
      expect(screen.getByRole("tab", { name: "Family" })).toHaveFocus();
    });

    it("is controlled: the selected key comes from the caller", () => {
      const { rerender } = render(
        <Tabs label="Parts" tabs={tabs} selectedKey="notes" onSelectionChange={() => {}}>
          <TabPanel id="family">A</TabPanel>
          <TabPanel id="notes">B</TabPanel>
        </Tabs>,
      );
      expect(screen.getByRole("tab", { name: "Notes" })).toHaveAttribute("aria-selected", "true");
      rerender(
        <Tabs label="Parts" tabs={tabs} selectedKey="family" onSelectionChange={() => {}}>
          <TabPanel id="family">A</TabPanel>
          <TabPanel id="notes">B</TabPanel>
        </Tabs>,
      );
      expect(screen.getByRole("tabpanel", { name: "Family" })).toHaveTextContent("A");
    });

    it("can keep every panel in the page, the ones not selected hidden from everyone", () => {
      render(
        <Tabs label="Parts" tabs={tabs} selectedKey="family" onSelectionChange={() => {}} variant="bar">
          <TabPanel id="family" forceMount>
            Story
          </TabPanel>
          <TabPanel id="country" forceMount>
            You
          </TabPanel>
          <TabPanel id="notes" forceMount>
            Around
          </TabPanel>
        </Tabs>,
      );
      expect(screen.getByText("You").closest("[inert]")).not.toBeNull();
      expect(screen.getByText("Story").closest("[inert]")).toBeNull();
      expect(screen.getAllByRole("tabpanel")).toHaveLength(1);
    });
  });
});
