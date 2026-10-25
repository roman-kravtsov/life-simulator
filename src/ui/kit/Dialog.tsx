import { useId, type ReactNode } from "react";
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

export interface ConfirmDialogProps {
  /** The element that opens the dialog, usually a Button. */
  trigger: ReactNode;
  title: string;
  /** What will happen, said plainly. */
  children: ReactNode;
  confirmLabel: string;
  /** The safe answer: it has focus when the dialog opens, so Enter alone never confirms. */
  cancelLabel: string;
  onConfirm: () => void;
}

/** A modal that asks before something that cannot be undone (UI-009, SAVE-007). Confirming acts, then closes. */
export function ConfirmDialog({ trigger, title, children, confirmLabel, cancelLabel, onConfirm }: ConfirmDialogProps) {
  // The body is the description of the dialog, so a screen reader reads what will happen when it opens.
  const bodyId = useId();
  return (
    <DialogTrigger>
      {trigger}
      <ModalOverlay className={styles.overlay} isDismissable>
        <Modal className={styles.modal}>
          <AriaDialog role="alertdialog" aria-describedby={bodyId} className={styles.dialog}>
            {({ close }) => (
              <>
                <Heading slot="title" className={styles.title}>
                  {title}
                </Heading>
                <div id={bodyId}>{children}</div>
                <div className={styles.actions}>
                  <Button autoFocus onPress={close}>
                    {cancelLabel}
                  </Button>
                  <Button
                    variant="primary"
                    onPress={() => {
                      onConfirm();
                      close();
                    }}
                  >
                    {confirmLabel}
                  </Button>
                </div>
              </>
            )}
          </AriaDialog>
        </Modal>
      </ModalOverlay>
    </DialogTrigger>
  );
}
