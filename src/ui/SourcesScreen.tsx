import { useEffect, useState } from "react";
import { loadIndex } from "../data";
import type { CountryIndex } from "../engine/world/types";
import { countryName, formatDate, formatNumber } from "../format";
import { t } from "../i18n";
import { Header } from "./Header";
import styles from "./SourcesScreen.module.css";
import { useFocusOn } from "./useFocusOn";

type Load = { status: "loading" } | { status: "error" } | { status: "ready"; index: CountryIndex };

interface Props {
  onBack: () => void;
  /** Injected in tests. */
  load?: () => Promise<CountryIndex>;
}

/** WORLD-007: every source with publisher, licence, edition and access date, plus the note on excluded countries. */
export function SourcesScreen({ onBack, load = loadIndex }: Props) {
  const heading = useFocusOn<HTMLHeadingElement>();
  const [state, setState] = useState<Load>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    load().then(
      (index) => !cancelled && setState({ status: "ready", index }),
      () => !cancelled && setState({ status: "error" }),
    );
    return () => {
      cancelled = true;
    };
  }, [load, attempt]);

  function retry() {
    setState({ status: "loading" });
    setAttempt(attempt + 1);
  }

  return (
    <section>
      <Header />
      <h1 ref={heading} tabIndex={-1}>
        {t("sources.title")}
      </h1>
      <p className="lead">{t("sources.intro")}</p>
      <div role="status">{state.status === "loading" && <p className="small">{t("sources.loading")}</p>}</div>
      {state.status === "error" && (
        <>
          <p role="alert">{t("sources.error")}</p>
          <button type="button" className="primary" onClick={retry}>
            {t("sources.retry")}
          </button>
        </>
      )}
      {state.status === "ready" && <SourceList index={state.index} />}
      <button type="button" className="ghost" onClick={onBack}>
        {t("sources.back")}
      </button>
    </section>
  );
}

function SourceList({ index }: { index: CountryIndex }) {
  const { estimate, ...published } = index.sources;
  return (
    <>
      <p className="small">
        {t("sources.summary", { version: index.dataVersion, count: formatNumber(index.countries.length) })}
      </p>
      <h2>{t("sources.list")}</h2>
      {Object.entries(published).map(([id, source]) => (
        <article key={id} className={styles.source}>
          <h3>
            <a href={source.url} rel="noreferrer">
              {source.title}
            </a>
          </h3>
          <dl className={styles.fields}>
            <dt>{t("sources.field.publisher")}</dt>
            <dd>{source.publisher}</dd>
            <dt>{t("sources.field.licence")}</dt>
            <dd>{source.licence}</dd>
            <dt>{t("sources.field.edition")}</dt>
            <dd>{source.version}</dd>
            <dt>{t("sources.field.accessed")}</dt>
            <dd>{formatDate(source.accessed)}</dd>
          </dl>
        </article>
      ))}
      <p className="note">{t("sources.terms")}</p>
      {estimate && (
        <>
          <h2>{t("sources.estimate.title")}</h2>
          <p>{t("sources.estimate.note")}</p>
        </>
      )}
      <h2>{t("sources.excluded.title")}</h2>
      <p>{t("sources.excluded.body", { count: formatNumber(index.excluded.length) })}</p>
      {index.excluded.length > 0 && (
        <details className={styles.excluded}>
          <summary>{t("sources.excluded.show", { count: formatNumber(index.excluded.length) })}</summary>
          <ul>
            {index.excluded.map((country) => (
              <li key={country.iso3}>
                {t("sources.excluded.item", {
                  country: countryName(country),
                  missing: country.missing.map((path) => t(`sources.missing.${path}`)).join(", "),
                })}
              </li>
            ))}
          </ul>
        </details>
      )}
    </>
  );
}
