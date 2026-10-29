import { useEffect, useState } from "react";
import { loadIndex } from "../data";
import { excludedBirths } from "../engine/world/excluded";
import type { CountryIndex } from "../engine/world/types";
import { countryName, formatCompactNumber, formatDate, formatList, formatNumber, formatPercent } from "../format";
import { DEFAULT_LOCALE, t } from "../i18n";
import { Page } from "./Page";
import { SiteHeader } from "./SiteHeader";
import { Button } from "./kit";
import styles from "./SourcesScreen.module.css";
import { useFocusOn } from "./useFocusOn";

type Load = { status: "loading" } | { status: "error" } | { status: "ready"; index: CountryIndex };

interface Props {
  onBack: () => void;
  /** Injected in tests. */
  load?: () => Promise<CountryIndex>;
}

/** WORLD-007: every source with publisher, licence, edition and access date, plus the note on excluded countries. WORLD-014: what is data, what is ours, what is left out. */
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
    <Page header={<SiteHeader />}>
      <h1 ref={heading} tabIndex={-1}>
        {t("sources.title")}
      </h1>
      <p className="lead">{t("sources.intro")}</p>
      <div role="status">{state.status === "loading" && <p className="small">{t("sources.loading")}</p>}</div>
      <HowThisWorks index={state.status === "ready" ? state.index : undefined} />
      {state.status === "error" && (
        <>
          <p role="alert">{t("sources.error")}</p>
          <Button variant="primary" onPress={retry}>
            {t("sources.retry")}
          </Button>
        </>
      )}
      {state.status === "ready" && <SourceList index={state.index} />}
      <Button onPress={onBack}>{t("sources.back")}</Button>
    </Page>
  );
}

const OURS_ITEMS = [1, 2, 3, 4, 5, 6, 7, 8];

/** WORLD-014: the static parts always show; the figures on the left-out countries need the loaded index. */
function HowThisWorks({ index }: { index?: CountryIndex }) {
  const births = index && index.excluded.length > 0 ? excludedBirths(index) : undefined;
  return (
    <section className={styles.how}>
      <h2>{t("sources.how.title")}</h2>
      <p>{t("sources.how.lead")}</p>
      <h3>{t("sources.how.data.title")}</h3>
      <p>{t("sources.how.data.body")}</p>
      <h3>{t("sources.how.ours.title")}</h3>
      <p>{t("sources.how.ours.lead")}</p>
      <ul className={styles.ours}>
        {OURS_ITEMS.map((n) => (
          <li key={n}>{t(`sources.how.ours.item${n}`)}</li>
        ))}
      </ul>
      <p>{t("sources.how.ours.close")}</p>
      <h3>{t("sources.how.left.title")}</h3>
      {index && births && births.excluded > 0 && births.largest.length > 0 && (
        <p>
          {t("sources.how.left.body", {
            excludedCount: formatNumber(index.excluded.length),
            allCount: formatNumber(index.countries.length + index.excluded.length),
            share: formatPercent(births.share, DEFAULT_LOCALE, 1),
            year: String(births.year),
            excluded: formatCompactNumber(births.excluded),
            total: formatCompactNumber(births.total),
            largest: formatList(births.largest.map((country) => countryName(country))),
          })}
        </p>
      )}
      <p>{t("sources.how.left.missing")}</p>
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
