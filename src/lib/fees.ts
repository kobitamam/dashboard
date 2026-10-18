import { addVat } from "@/lib/vat";
import { BETTERMENT_LEVY, type Case, type Fee, type Installment } from "@/lib/types";

/**
 * How far a case has got, for billing: a payment becomes collectable at a stage.
 *  - "open": the case was opened (first installment)
 *  - "draft": the draft was sent (installments between the first and the last)
 *  - "done": the case was completed (the last installment and the share of the reduction)
 */
export type CaseStage = "open" | "draft" | "done";

export function feeStageOf(c: Pick<Case, "status" | "type" | "bettermentStage">): CaseStage {
  if (c.status === "הושלם") return "done";
  if (c.status === "נשלחה טיוטה") return "draft";
  if (c.type === BETTERMENT_LEVY) {
    const stage = c.bettermentStage ?? "";
    if (stage === "הושלם") return "done";
    if (stage && stage !== "טרם נשלחה טיוטה") return "draft";
  }
  return "open";
}

/** The fixed fee's payments: the installments, or - for fees saved the old way - base and final. */
function installmentAmounts(fee: Fee): number[] {
  if (fee.installments?.length) return fee.installments.map((i) => i.amount);
  return fee.finalAmount > 0 ? [fee.baseAmount, fee.finalAmount] : [fee.baseAmount];
}

export type InstallmentRow = {
  label: string;
  amount: number;
  due: boolean; // collectable at the case's stage
  covered: boolean; // enough money has been received to cover it
};

/**
 * The fee is collected in installments (and, for a betterment levy, a share of the
 * reduction at the end). Money received is not tied to one payment - it covers the
 * installments in order.
 */
export function feeTotals(fee: Fee | null, stage: CaseStage | boolean = "open") {
  const at: CaseStage = stage === true ? "done" : stage === false ? "open" : stage;
  const paid = fee ? fee.payments.reduce((sum, p) => sum + p.amount, 0) : 0;
  const amounts = fee ? installmentAmounts(fee) : [];
  const success = fee ? (fee.successPercentage / 100) * fee.successAmount : 0;

  const first = amounts[0] ?? 0;
  const last = amounts.length > 1 ? amounts[amounts.length - 1] : 0;
  const middle = amounts.slice(1, -1).reduce((sum, a) => sum + a, 0);
  const second = last + success; // what falls due on completion

  const dueNow = first + (at !== "open" ? middle : 0) + (at === "done" ? second : 0);
  const balanceDue = Math.max(0, dueNow - paid);
  const total = first + middle + second;

  const rows: InstallmentRow[] = [];
  let running = 0;
  amounts.forEach((amount, index) => {
    running += amount;
    const isLast = amounts.length > 1 && index === amounts.length - 1;
    const due = index === 0 || (isLast ? at === "done" : at !== "open");
    rows.push({
      label: amounts.length === 1 ? "תשלום" : `תשלום ${index + 1}`,
      amount,
      due,
      covered: paid >= running - 0.005,
    });
  });
  if (success > 0) {
    rows.push({
      label: "אחוז מההפחתה",
      amount: success,
      due: at === "done",
      covered: paid >= total - 0.005,
    });
  }

  return {
    first,
    middle,
    second,
    total,
    paid,
    balance: total - paid,
    dueNow,
    balanceDue,
    rows,
  };
}

/** Splits an amount (VAT included) into installments by percent; the last absorbs rounding. */
export function buildInstallments(totalInclVat: number, percents: number[]): Installment[] {
  let assigned = 0;
  return percents.map((percent, index) => {
    const isLast = index === percents.length - 1;
    const amount = isLast
      ? Math.round((totalInclVat - assigned) * 100) / 100
      : Math.round(((totalInclVat * percent) / 100) * 100) / 100;
    assigned += amount;
    return { percent, amount };
  });
}

/** Percentages that add up to 100, equal unless the typed ones are usable as they are. */
export function normalizePercents(typed: number[], count: number): number[] {
  const n = Math.min(12, Math.max(1, Math.round(count) || 1));
  const usable =
    typed.length === n &&
    typed.every((p) => Number.isFinite(p) && p >= 0) &&
    Math.abs(typed.reduce((s, p) => s + p, 0) - 100) < 0.5;
  if (usable) return typed;
  const each = Math.floor((100 / n) * 100) / 100;
  return Array.from({ length: n }, (_, i) => (i === n - 1 ? Math.round((100 - each * (n - 1)) * 100) / 100 : each));
}

/** The fee a case starts with when it is opened from an approved quote. */
export function feeFromQuote(quote: {
  amountInclVat: number;
  installments: number[];
  feePercent: number | null;
  isBettermentLevy: boolean;
}): Omit<Fee, "payments"> & { payments: [] } {
  const installments = buildInstallments(quote.amountInclVat, quote.installments);
  return {
    installments,
    baseAmount: installments[0]?.amount ?? 0,
    finalAmount: installments.length > 1 ? (installments[installments.length - 1]?.amount ?? 0) : 0,
    successPercentage: quote.isBettermentLevy ? (quote.feePercent ?? 0) : 0,
    successAmount: 0,
    payments: [],
  };
}

const money = (value: number) => Math.round(value).toLocaleString("he-IL");

/** The fee as it reads in the quote letter and on the case card. */
export function quoteFeeText(quote: {
  amount: number;
  amountInclVat: number;
  installments: number[];
  feePercent: number | null;
  isBettermentLevy: boolean;
}) {
  if (quote.amount <= 0 && !quote.isBettermentLevy) return "";
  const parts: string[] = [];
  if (quote.amount > 0) {
    parts.push(`${money(quote.amount)} ₪ + מע״מ (${money(quote.amountInclVat || addVat(quote.amount))} ₪ כולל מע״מ)`);
    if (quote.installments.length > 1) {
      parts.push(`ב-${quote.installments.length} תשלומים: ${quote.installments.map((p) => `${p}%`).join(" / ")}`);
    }
  }
  if (quote.isBettermentLevy && quote.feePercent) {
    parts.push(`${quote.amount > 0 ? "ובנוסף " : ""}${quote.feePercent}% מההפחתה`);
  }
  return parts.join(", ");
}
