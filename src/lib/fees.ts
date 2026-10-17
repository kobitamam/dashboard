import type { Fee } from "@/lib/types";

/** The fee as the fee page computes it: base plus the success percentage of the saved amount. */
export function feeTotals(fee: Fee | null) {
  const total = fee ? fee.baseAmount + (fee.successPercentage / 100) * fee.successAmount : 0;
  const paid = fee ? fee.payments.reduce((sum, p) => sum + p.amount, 0) : 0;
  return { total, paid, balance: total - paid };
}
