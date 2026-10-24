import { t } from "../i18n";
import { Header } from "./Header";
import { useFocusOn } from "./useFocusOn";

export function StartScreen({ onBegin }: { onBegin: () => void }) {
  const heading = useFocusOn<HTMLHeadingElement>();
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
      <button type="button" className="primary" onClick={onBegin}>
        {t("start.begin")}
      </button>
      <p className="small">{t("start.privacy")}</p>
      <p className="small">{t("start.preview")}</p>
    </section>
  );
}
