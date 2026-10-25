// A screen that shows stored lives can meet something it cannot read (text a later version of the game no longer
// has, a record from an older one). This catches that and says so calmly, with a way back, rather than blanking the app.
import { Component, type ErrorInfo, type ReactNode } from "react";
import { t } from "../i18n";
import { Header } from "./Header";
import { Button } from "./kit";
import { useFocusOn } from "./useFocusOn";

interface Props {
  onBack: () => void;
  children: ReactNode;
}

function CouldNotShow({ onBack }: { onBack: () => void }) {
  const heading = useFocusOn<HTMLHeadingElement>();
  return (
    <section>
      <Header />
      <h1 ref={heading} tabIndex={-1}>
        {t("app.error.title")}
      </h1>
      <p>{t("app.error.body")}</p>
      <Button variant="primary" onPress={onBack}>
        {t("life.backToStart")}
      </Button>
    </section>
  );
}

/** Give it a `key` that changes with the screen, so it starts afresh on the next one. */
export class ScreenBoundary extends Component<Props, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Nothing is sent anywhere (ANLT-001); the browser's console is where a developer will look.
    console.error(error, info.componentStack);
  }

  render() {
    return this.state.failed ? <CouldNotShow onBack={this.props.onBack} /> : this.props.children;
  }
}
