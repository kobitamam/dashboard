"use client";

import { useState } from "react";
import {
  bettermentTotals,
  emptyUnit,
  type BettermentStatementInput,
  type BettermentUnit,
} from "@/lib/betterment-statement";

const input = "w-full rounded-lg border border-border bg-background px-2 py-1 text-xs outline-none focus:border-brand-cyan";
const shekels = (value: number) => `₪${Math.round(value).toLocaleString("he-IL")}`;

/**
 * The figures of a betterment-levy closing statement (גמר חשבון), unit by unit, with the saving and
 * the fee worked out as they are typed. Submitting produces the Word file.
 */
export default function BettermentStatementForm({
  defaults,
  onSubmit,
  onCancel,
  busy,
}: {
  defaults: BettermentStatementInput;
  onSubmit: (input: BettermentStatementInput) => void;
  onCancel: () => void;
  busy: boolean;
}) {
  const [form, setForm] = useState<BettermentStatementInput>(defaults);
  const totals = bettermentTotals(form);

  const setUnit = (index: number, patch: Partial<BettermentUnit>) =>
    setForm((f) => ({ ...f, units: f.units.map((u, i) => (i === index ? { ...u, ...patch } : u)) }));
  const text = (index: number, key: "address" | "unit" | "plan" | "date") => ({
    value: form.units[index][key],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => setUnit(index, { [key]: e.target.value }),
  });
  const money = (index: number, key: "committee" | "committeeIndexed" | "arbitrator" | "arbitratorIndexed") => ({
    type: "number",
    min: 0,
    value: form.units[index][key] || "",
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => setUnit(index, { [key]: Number(e.target.value) || 0 }),
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(form);
      }}
      className="mt-2 space-y-3 rounded-xl border border-border bg-surface p-3 text-right text-xs"
    >
      <p className="font-bold">גמר חשבון - היטל השבחה</p>
      <label className="block">
        <span className="text-muted">לידי (לא חובה)</span>
        <input
          className={input}
          value={form.attention}
          onChange={(e) => setForm((f) => ({ ...f, attention: e.target.value }))}
          placeholder="הגב׳ ..., מנהלת תכנון"
        />
      </label>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px]">
          <thead className="text-[11px] text-muted">
            <tr>
              <th className="p-1 font-medium">כתובת</th>
              <th className="p-1 font-medium">יחידה</th>
              <th className="p-1 font-medium">תכנית / הקלות</th>
              <th className="p-1 font-medium">מועד קובע</th>
              <th className="p-1 font-medium">היטל ע״פ שומת ועדה</th>
              <th className="p-1 font-medium">היטל ועדה צמוד מדד</th>
              <th className="p-1 font-medium">היטל ע״פ שמאי מכריע</th>
              <th className="p-1 font-medium">היטל מכריע צמוד מדד</th>
              <th className="p-1 font-medium">חיסכון</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {form.units.map((_, i) => (
              <tr key={i}>
                <td className="p-1"><input className={input} {...text(i, "address")} /></td>
                <td className="w-16 p-1"><input className={input} {...text(i, "unit")} /></td>
                <td className="p-1"><input className={input} {...text(i, "plan")} /></td>
                <td className="w-24 p-1"><input className={input} {...text(i, "date")} placeholder="24.8.2020" /></td>
                <td className="p-1"><input className={input} {...money(i, "committee")} /></td>
                <td className="p-1"><input className={input} {...money(i, "committeeIndexed")} /></td>
                <td className="p-1"><input className={input} {...money(i, "arbitrator")} /></td>
                <td className="p-1"><input className={input} {...money(i, "arbitratorIndexed")} /></td>
                <td className="whitespace-nowrap p-1 font-semibold">{shekels(totals.savings[i] ?? 0)}</td>
                <td className="p-1">
                  {form.units.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, units: f.units.filter((__, j) => j !== i) }))}
                      className="text-danger hover:underline"
                      aria-label="הסר יחידה"
                    >
                      ✕
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button
        type="button"
        onClick={() =>
          // A new unit usually shares the previous one's address, plan and determining date.
          setForm((f) => {
            const last = f.units[f.units.length - 1];
            return { ...f, units: [...f.units, { ...emptyUnit(last?.address), plan: last?.plan ?? "", date: last?.date ?? "" }] };
          })
        }
        className="font-semibold text-brand-blue hover:underline"
      >
        + הוסף יחידה
      </button>

      <div className="flex flex-wrap items-end gap-3">
        <label className="block w-36">
          <span className="text-muted">שכ״ט מהחיסכון (%)</span>
          <input
            className={input}
            type="number"
            min={0}
            max={100}
            step="any"
            value={form.feePercent || ""}
            onChange={(e) => setForm((f) => ({ ...f, feePercent: Number(e.target.value) || 0 }))}
          />
        </label>
        <label className="block w-44">
          <span className="text-muted">קיזוז תשלום בגין פתיחת תיק (לפני מע״מ)</span>
          <input
            className={input}
            type="number"
            min={0}
            step="any"
            value={form.offset || ""}
            onChange={(e) => setForm((f) => ({ ...f, offset: Number(e.target.value) || 0 }))}
          />
        </label>
      </div>

      <p className="text-muted">
        סה״כ חיסכון {shekels(totals.saving)} · שכ״ט {shekels(totals.fee)}
        {form.offset > 0 && ` · קיזוז ${shekels(form.offset)}`} ·{" "}
        <b className="text-foreground">לתשלום כולל מע״מ {shekels(totals.total)}</b>
      </p>

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={busy}
          className="rounded-lg bg-brand-blue px-3 py-1.5 font-semibold text-white disabled:opacity-60"
        >
          {busy ? "מפיק..." : "הפק גמר חשבון"}
        </button>
        <button type="button" onClick={onCancel} className="rounded-lg border border-border px-3 py-1.5">
          ביטול
        </button>
      </div>
    </form>
  );
}
