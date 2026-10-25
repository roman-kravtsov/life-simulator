// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { useState } from "react";
import { Button, Dialog, Slider, Stepper, Switch, Tooltip } from "../../src/ui/kit";

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
});
