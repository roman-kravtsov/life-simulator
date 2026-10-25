// Small pieces the event files share.
import type { DecisionContext } from "../../engine/decisions";
import type { Effect } from "../../engine/effects";
import type { Role } from "../../engine/events";
import { yearlyIncome } from "../../engine/money";
import type { LifeStage } from "../../engine/types";

export const ANY_STAGE: LifeStage[] = ["infancy", "childhood", "adolescence", "youth", "adulthood", "midlife", "elder"];

/** What a choice costs, as a share of the person's year of income, shown on the card. */
export const costShare = (share: number) => (ctx: DecisionContext) => ({
  amount: share * yearlyIncome(ctx.person, ctx.country),
});

/** The effects of a choice in an event about a person in a role: closeness with them, then the rest. */
export const withRole =
  (role: Role, amount: number, rest: readonly Effect[] = []) =>
  (ctx: DecisionContext): Effect[] => {
    const id = ctx.payload.roleIds?.[role];
    return [...(id === undefined ? [] : [{ relationship: "closeness" as const, amount, id }]), ...rest];
  };
