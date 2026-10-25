import { VAT_RATE } from "@/lib/vat";

/**
 * A betterment-levy case's closing statement (גמר חשבון): the fee is a share of what the
 * arbitrator's appraisal saved against the committee's levy, unit by unit, less what was paid
 * when the case was opened, plus VAT. Shared by the form (live preview) and the Word file.
 */
export type BettermentUnit = {
  address: string; // כתובת
  unit: string; // יחידה
  plan: string; // תכנית / הקלות
  date: string; // מועד קובע
  committee: number; // היטל השבחה ע״פ שומת ועדה
  committeeIndexed: number; // היטל ועדה צמוד מדד
  arbitrator: number; // היטל השבחה ע״פ שמאי מכריע
  arbitratorIndexed: number; // היטל שמאי מכריע צמוד מדד
};

export type BettermentStatementInput = {
  attention: string; // לידי ... (optional)
  units: BettermentUnit[];
  feePercent: number; // share of the saving
  offset: number; // paid when the case was opened, before VAT
};

export const emptyUnit = (address = ""): BettermentUnit => ({
  address,
  unit: "",
  plan: "",
  date: "",
  committee: 0,
  committeeIndexed: 0,
  arbitrator: 0,
  arbitratorIndexed: 0,
});

// The indexed amount when given, otherwise the plain one.
const indexedOr = (indexed: number, plain: number) => (indexed > 0 ? indexed : plain);

export function bettermentTotals(input: BettermentStatementInput) {
  const savings = input.units.map((u) =>
    Math.round(indexedOr(u.committeeIndexed, u.committee) - indexedOr(u.arbitratorIndexed, u.arbitrator)),
  );
  const committeeIndexed = Math.round(input.units.reduce((s, u) => s + indexedOr(u.committeeIndexed, u.committee), 0));
  const arbitratorIndexed = Math.round(
    input.units.reduce((s, u) => s + indexedOr(u.arbitratorIndexed, u.arbitrator), 0),
  );
  const saving = savings.reduce((s, v) => s + v, 0);
  const fee = Math.round((saving * input.feePercent) / 100);
  const net = fee - Math.round(input.offset);
  const total = Math.round(net * (1 + VAT_RATE));
  return { savings, committeeIndexed, arbitratorIndexed, saving, fee, net, total };
}
