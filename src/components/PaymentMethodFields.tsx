"use client";

import { useState } from "react";
import { paymentMethods, POST_DATED_CHEQUE } from "@/lib/types";

const fieldClass =
  "w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm outline-none focus:border-brand-cyan";

/** How a receipt was paid; a cheque asks for its number, a post-dated cheque also for the day it can be cashed. */
export default function PaymentMethodFields() {
  const [method, setMethod] = useState<string>(paymentMethods[0]);
  const isCheque = method === "צ׳ק" || method === POST_DATED_CHEQUE;

  return (
    <>
      <label className="block">
        <span className="mb-1.5 block text-xs font-medium text-muted">אמצעי תשלום</span>
        <select name="method" value={method} onChange={(e) => setMethod(e.target.value)} className={fieldClass}>
          {paymentMethods.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </label>
      {method === POST_DATED_CHEQUE && (
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-muted">תאריך פירעון הצ׳ק</span>
          <input name="chequeDate" type="date" required className={fieldClass} />
        </label>
      )}
      {isCheque && (
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-muted">מספר צ׳ק (לא חובה)</span>
          <input name="chequeNumber" maxLength={30} className={fieldClass} />
        </label>
      )}
    </>
  );
}
