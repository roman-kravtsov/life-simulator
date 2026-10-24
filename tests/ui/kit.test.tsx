// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Button, Dialog, Slider, Switch, Tooltip } from "../../src/ui/kit";

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
});
