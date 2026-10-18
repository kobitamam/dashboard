"use client";

import { useState } from "react";
import { SelectWithNewField } from "@/components/form";
import { normalizePercents } from "@/lib/fees";
import { BETTERMENT_LEVY } from "@/lib/types";
import { addVat, removeVat } from "@/lib/vat";

const fieldClass =
  "w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm outline-none focus:border-brand-cyan";

const show = (value: number) => (value > 0 ? String(Number(value.toFixed(2))) : "");
const toNumber = (value: string) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};
const money = (value: number) => Math.round(value).toLocaleString("he-IL");

export type FeeDefaults = {
  exVat: number;
  inclVat: number;
  percents: number[];
  feePercent: number | null;
};

/**
 * The fee of a quote or a case: the amount before and after VAT (typing one fills the other),
 * how many payments, what share of the fee each is, and - for a betterment levy only - the
 * percent of the reduction. The server reads `amountExVat`, `amountInclVat`,
 * `installmentCount`, every `installmentPercent` and `feePercent`.
 */
export default function FeeStructureFields({
  betterment,
  defaults,
}: {
  betterment: boolean;
  defaults?: FeeDefaults;
}) {
  const [exVat, setExVat] = useState(show(defaults?.exVat ?? 0));
  const [inclVat, setInclVat] = useState(show(defaults?.inclVat ?? 0));
  const [count, setCount] = useState(defaults?.percents.length ?? (betterment ? 1 : 2));
  const [percents, setPercents] = useState<string[]>(
    (defaults?.percents.length ? defaults.percents : normalizePercents([], betterment ? 1 : 2)).map(String),
  );
  const [touchedCount, setTouchedCount] = useState(!!defaults);

  // The fixed fee of a betterment levy is usually a single advance, an ordinary one is split in two -
  // unless the user chose a number of payments themselves.
  const [lastBetterment, setLastBetterment] = useState(betterment);
  if (betterment !== lastBetterment) {
    setLastBetterment(betterment);
    if (!touchedCount) applyCount(betterment ? 1 : 2);
  }

  function applyCount(next: number) {
    const n = Math.min(12, Math.max(1, Math.round(next) || 1));
    setCount(n);
    setPercents(normalizePercents([], n).map(String));
  }

  const sum = percents.reduce((total, p) => total + toNumber(p), 0);
  const sumOk = Math.abs(sum - 100) < 0.5;
  const total = toNumber(inclVat);

  return (
    <>
      <label className="block">
        <span className="mb-1.5 block text-xs font-medium text-muted">שכ״ט לפני מע״מ (₪)</span>
        <input
          className={fieldClass}
          name="amountExVat"
          type="number"
          min={0}
          step="any"
          value={exVat}
          onChange={(e) => {
            setExVat(e.target.value);
            setInclVat(show(addVat(toNumber(e.target.value))));
          }}
        />
      </label>
      <label className="block">
        <span className="mb-1.5 block text-xs font-medium text-muted">שכ״ט כולל מע״מ (₪)</span>
        <input
          className={fieldClass}
          name="amountInclVat"
          type="number"
          min={0}
          step="any"
          value={inclVat}
          onChange={(e) => {
            setInclVat(e.target.value);
            setExVat(show(removeVat(toNumber(e.target.value))));
          }}
        />
      </label>
      <label className="block">
        <span className="mb-1.5 block text-xs font-medium text-muted">מספר תשלומים</span>
        <input
          className={fieldClass}
          name="installmentCount"
          type="number"
          min={1}
          max={12}
          value={count}
          onChange={(e) => {
            setTouchedCount(true);
            applyCount(Number(e.target.value));
          }}
        />
      </label>

      <div className="sm:col-span-2 lg:col-span-3">
        <span className="mb-1.5 block text-xs font-medium text-muted">
          אחוז משכ״ט עבור כל תשלום{" "}
          <span className={sumOk ? "text-muted" : "font-semibold text-danger"}>
            (סה״כ {Number(sum.toFixed(2))}%{sumOk ? "" : " - צריך להיות 100%"})
          </span>
        </span>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {percents.map((percent, index) => (
            <label key={index} className="block">
              <span className="mb-1 block text-[11px] text-muted">
                תשלום {index + 1}
                {total > 0 && ` · ${money((total * toNumber(percent)) / 100)} ₪`}
              </span>
              <input
                className={fieldClass}
                name="installmentPercent"
                type="number"
                min={0}
                max={100}
                step="any"
                value={percent}
                onChange={(e) =>
                  setPercents((current) => current.map((p, i) => (i === index ? e.target.value : p)))
                }
              />
            </label>
          ))}
        </div>
      </div>

      {betterment && (
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-muted">אחוז שכ״ט מהפחתה (%)</span>
          <input
            className={fieldClass}
            name="feePercent"
            type="number"
            min={0}
            max={100}
            step="any"
            defaultValue={defaults?.feePercent ?? ""}
          />
        </label>
      )}
    </>
  );
}

/** The quote form's appraisal type and fee: the reduction percent shows only for a betterment levy. */
export function QuoteTypeAndFee({ types, defaultType }: { types: string[]; defaultType: string }) {
  const [type, setType] = useState(defaultType);
  return (
    <>
      <SelectWithNewField
        label="סוג שומה"
        name="type"
        newName="newType"
        options={types}
        defaultValue={defaultType}
        onValueChange={setType}
      />
      <FeeStructureFields betterment={type === BETTERMENT_LEVY} />
    </>
  );
}
