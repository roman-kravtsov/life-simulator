import { t } from "../i18n";
import { Header } from "./Header";
import { Button } from "./kit";
import type { LoadStatus } from "./store";
import { useFocusOn } from "./useFocusOn";

interface Props {
  status: LoadStatus;
  onBegin: () => void;
  onSources: () => void;
}

export function StartScreen({ status, onBegin, onSources }: Props) {
  const heading = useFocusOn<HTMLHeadingElement>();
  const loading = status === "loading";
  return (
    <section>
      <Header />
      <h1 ref={heading} tabIndex={-1}>
        {t("app.title")}
        <span className="subtitle">{t("app.subtitle")}</span>
      </h1>
      <p className="lead">{t("start.intro")}</p>
      <p className="note" role="note">
        {t("start.contentNote")}
      </p>
      {/* Stays focusable while loading (aria-disabled, guarded handler) so focus is not dropped to the body. */}
      <Button variant="primary" onPress={loading ? undefined : onBegin} aria-disabled={loading || undefined}>
        {t("start.begin")}
      </Button>
      <div role="status">{loading && <p className="small">{t("start.loading")}</p>}</div>
      {status === "error" && <p role="alert">{t("start.error")}</p>}
      <p className="small">{t("start.privacy")}</p>
      <Button onPress={onSources}>{t("start.sources")}</Button>
      <p className="small">{t("start.preview")}</p>
    </section>
  );
}
