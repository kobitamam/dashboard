"use client";

import { useState } from "react";
import type { PropertyLocation } from "@/lib/types";

const input = "w-full rounded-lg border border-border bg-background px-2.5 py-2 text-sm outline-none focus:border-brand-cyan";
const empty = (): PropertyLocation => ({ block: "", parcel: "", subParcel: "", address: "", city: "" });

/**
 * "נכסים נוספים": more properties a quote covers beside its main one (the form's own גוש/חלקה/כתובת fields).
 * Each row posts extraBlock / extraParcel / extraSubParcel / extraAddress / extraCity; empty rows are ignored.
 */
export default function ExtraPropertiesFields({ defaults }: { defaults?: PropertyLocation[] }) {
  const [rows, setRows] = useState<PropertyLocation[]>(defaults ?? []);

  const set = (index: number, key: keyof PropertyLocation, value: string) =>
    setRows((r) => r.map((row, i) => (i === index ? { ...row, [key]: value } : row)));

  return (
    <div className="col-span-full">
      {rows.length > 0 && (
        <div className="mb-2 space-y-2">
          <p className="text-xs font-medium text-muted">נכסים נוספים</p>
          {rows.map((row, i) => (
            <div key={i} className="grid grid-cols-2 items-center gap-2 sm:grid-cols-[1fr_1fr_1fr_2fr_1.5fr_auto]">
              <input className={input} name="extraBlock" placeholder="גוש" value={row.block} onChange={(e) => set(i, "block", e.target.value)} />
              <input className={input} name="extraParcel" placeholder="חלקה" value={row.parcel} onChange={(e) => set(i, "parcel", e.target.value)} />
              <input className={input} name="extraSubParcel" placeholder="תת חלקה" value={row.subParcel} onChange={(e) => set(i, "subParcel", e.target.value)} />
              <input className={input} name="extraAddress" placeholder="רחוב ומספר" value={row.address} onChange={(e) => set(i, "address", e.target.value)} />
              <input className={input} name="extraCity" placeholder="עיר" value={row.city} onChange={(e) => set(i, "city", e.target.value)} />
              <button
                type="button"
                onClick={() => setRows((r) => r.filter((_, j) => j !== i))}
                className="text-sm text-danger hover:underline"
                aria-label="הסר נכס"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
      <button
        type="button"
        // A new row usually shares the previous property's city.
        onClick={() => setRows((r) => [...r, { ...empty(), city: r[r.length - 1]?.city ?? "" }])}
        className="text-sm font-semibold text-brand-blue hover:underline"
      >
        + הוסף נכס נוסף
      </button>
    </div>
  );
}
