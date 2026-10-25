// The yearly focus plan (UI-005, DEC-003, DEC-004): the player places the points circumstance has left
// them across the five areas. It is controlled: the life screen keeps the draft and decides what
// Continue sends, so nothing is sent unless the player changed the plan.
import { useId } from "react";
import type { FocusArea, Plan } from "../engine/types";
import { formatNumber, pluralKey } from "../format";
import { t } from "../i18n";
import { Stepper } from "./kit";
import styles from "./PlanWidget.module.css";
import type { PlanOverview } from "./store";

const points = (count: number) => t(pluralKey("plan.points", count), { count: formatNumber(count) });

interface Props {
  plan: PlanOverview;
  /** The player's own points as they stand now. */
  draft: Plan;
  onChange: (draft: Plan) => void;
}

export function PlanWidget({ plan, draft, onChange }: Props) {
  const headingId = useId();
  const forcedId = useId();
  const { areas, forced, locked, free } = plan;
  const placed = areas.reduce((sum, area) => sum + draft[area], 0);
  const left = free - placed;

  const describe = (area: FocusArea) => {
    const parts = [t(`plan.what.${area}`)];
    const lock = locked[area];
    if (lock) parts.push(t(`plan.locked.${lock}`));
    const taken = forced.filter((f) => f.area === area).reduce((sum, f) => sum + f.points, 0);
    if (taken > 0) parts.push(t("plan.forced.note", { points: points(taken) }));
    return parts.join(" ");
  };

  return (
    <section aria-labelledby={headingId} className={styles.plan}>
      <h2 id={headingId} className={`eyebrow ${styles.heading}`}>
        {t("plan.heading")}
      </h2>
      <p className="small">{t("plan.intro", { points: points(free) })}</p>
      <p className="small">{t(plan.custom ? "plan.carried" : "plan.following")}</p>
      {forced.length > 0 && (
        <>
          <h3 id={forcedId} className={styles.group}>
            {t("plan.forced.heading")}
          </h3>
          <ul aria-labelledby={forcedId} className={styles.forced}>
            {forced.map(({ area, points: count, reason }) => (
              <li key={`${area}-${reason}`}>
                {t("plan.forced.line", {
                  area: t(`plan.area.${area}`),
                  points: points(count),
                  reason: t(`plan.forced.${reason}`),
                })}
              </li>
            ))}
          </ul>
        </>
      )}
      <div className={styles.areas}>
        {areas.map((area) => (
          <Stepper
            key={area}
            label={t(`plan.area.${area}`)}
            description={describe(area)}
            value={draft[area]}
            minValue={0}
            maxValue={locked[area] ? 0 : draft[area] + left}
            isDisabled={Boolean(locked[area])}
            // An emptied field reports NaN; it means no points here.
            onChange={(value) => onChange({ ...draft, [area]: Number.isFinite(value) ? value : 0 })}
          />
        ))}
      </div>
      <p className="small" aria-live="polite">
        {left > 0 ? t(pluralKey("plan.left", left), { count: formatNumber(left) }) : t("plan.left.none")}
      </p>
    </section>
  );
}
