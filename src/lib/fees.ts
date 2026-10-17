import type { Fee } from "@/lib/types";

export type FeeStage = "first" | "second";

/**
 * The fee is collected in two stages: the first when the case is opened, the
 * second when it is completed. Payments are not tied to a stage - money received
 * covers stage 1 first, then stage 2.
 */
export function feeTotals(fee: Fee | null, completed = false) {
  const first = fee?.baseAmount ?? 0;
  const second = fee ? fee.finalAmount + (fee.successPercentage / 100) * fee.successAmount : 0;
  const paid = fee ? fee.payments.reduce((sum, p) => sum + p.amount, 0) : 0;

  // What can be collected right now: stage 1 always, stage 2 once the case is done.
  const dueNow = first + (completed ? second : 0);
  const balanceDue = Math.max(0, dueNow - paid);
  const stageDue: FeeStage | null =
    balanceDue <= 0 ? null : paid < first ? "first" : "second";

  return {
    first,
    second,
    total: first + second,
    paid,
    balance: first + second - paid,
    dueNow,
    balanceDue,
    stageDue,
  };
}

/** The fee a case starts with when it is opened from an approved quote. */
export function initialFee(isBettermentLevy: boolean, amount: number, feePercent: number | null): Omit<Fee, "payments"> & { payments: [] } {
  if (isBettermentLevy) {
    // Betterment levy: the quote amount is the advance, then a percentage of the reduction.
    return {
      baseAmount: amount,
      finalAmount: 0,
      successPercentage: feePercent ?? 0,
      successAmount: 0,
      payments: [],
    };
  }
  // Ordinary case: half now, the other half on completion.
  const first = Math.round(amount / 2);
  return {
    baseAmount: first,
    finalAmount: amount - first,
    successPercentage: 0,
    successAmount: 0,
    payments: [],
  };
}
