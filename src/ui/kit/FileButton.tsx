import { FileTrigger } from "react-aria-components";
import { Button, type ButtonProps } from "./Button";

export interface FileButtonProps extends Omit<ButtonProps, "onPress"> {
  /** The first file the player chose, or null when they chose none. */
  onSelect: (file: File | null) => void;
  /** File types the chooser offers; a life is a .json file. */
  accept?: string[];
}

/** A button that opens the device's file chooser. Looks and behaves like a Button; the hidden input is React Aria's. */
export function FileButton({ onSelect, accept = [".json", "application/json"], ...button }: FileButtonProps) {
  return (
    <FileTrigger acceptedFileTypes={accept} onSelect={(files) => onSelect(files?.[0] ?? null)}>
      <Button {...button} />
    </FileTrigger>
  );
}
