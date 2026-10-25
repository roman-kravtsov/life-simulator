// The shell of every screen (UI-010, A11Y-002): the screen's header, then the one main landmark. The header is a real
// <header> outside <main>, so it is the page's banner without a role of its own, and the skip link in App leads past
// it to the main, which can take focus for that. `reading` keeps the reading measure; `wide` is the life screen, which
// runs the width of the window in columns. The styles for both are in src/styles.css.
import type { ReactNode } from "react";

export type Layout = "reading" | "wide";

interface Props {
  header: ReactNode;
  layout?: Layout;
  children: ReactNode;
}

export function Page({ header, layout = "reading", children }: Props) {
  return (
    <>
      {header}
      <main id="content" tabIndex={-1} data-layout={layout}>
        {children}
      </main>
    </>
  );
}
