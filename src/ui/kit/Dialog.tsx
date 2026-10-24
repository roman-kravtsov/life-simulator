import type { ReactNode } from "react";
import { Dialog as AriaDialog, DialogTrigger, Heading, Modal, ModalOverlay } from "react-aria-components";
import { Button } from "./Button";
import styles from "./Dialog.module.css";

export interface DialogProps {
  /** The element that opens the dialog, usually a Button. */
  trigger: ReactNode;
  title: string;
  /** Label for the close button. */
  closeLabel: string;
  children: ReactNode;
}

/** A modal dialog. Focus is trapped while open and returns to the trigger on close. */
export function Dialog({ trigger, title, closeLabel, children }: DialogProps) {
  return (
    <DialogTrigger>
      {trigger}
      <ModalOverlay className={styles.overlay} isDismissable>
        <Modal className={styles.modal}>
          <AriaDialog className={styles.dialog}>
            {({ close }) => (
              <>
                <Heading slot="title" className={styles.title}>
                  {title}
                </Heading>
                {children}
                <div className={styles.actions}>
                  <Button onPress={close}>{closeLabel}</Button>
                </div>
              </>
            )}
          </AriaDialog>
        </Modal>
      </ModalOverlay>
    </DialogTrigger>
  );
}
