"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { NEW_CASE_TYPE } from "@/lib/types";

const fieldClass =
  "w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm outline-none focus:border-brand-cyan";

export function Field({
  label,
  name,
  type = "text",
  required,
  defaultValue,
  placeholder,
  min,
  max,
  step,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  defaultValue?: string | number;
  placeholder?: string;
  min?: number;
  max?: number;
  step?: number | "any";
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-muted">{label}</span>
      <input
        className={fieldClass}
        name={name}
        type={type}
        required={required}
        defaultValue={defaultValue}
        placeholder={placeholder}
        min={min}
        max={max}
        step={step}
      />
    </label>
  );
}

export function SelectField({
  label,
  name,
  options,
  defaultValue,
}: {
  label: string;
  name: string;
  options: readonly string[];
  defaultValue?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-muted">{label}</span>
      <select className={fieldClass} name={name} defaultValue={defaultValue}>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

/** A select whose last option reveals a text box for adding a brand-new value. */
export function SelectWithNewField({
  label,
  name,
  options,
  newName,
  defaultValue,
}: {
  label: string;
  name: string;
  options: readonly string[];
  newName: string;
  defaultValue?: string;
}) {
  const [value, setValue] = useState(defaultValue ?? options[0]);

  return (
    <div>
      <label className="block">
        <span className="mb-1.5 block text-xs font-medium text-muted">{label}</span>
        <select
          className={fieldClass}
          name={name}
          value={value}
          onChange={(e) => setValue(e.target.value)}
        >
          {options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
          <option value={NEW_CASE_TYPE}>➕ סוג חדש...</option>
        </select>
      </label>
      {value === NEW_CASE_TYPE && (
        <input
          className={`${fieldClass} mt-2`}
          name={newName}
          placeholder="שם סוג השומה החדש"
          maxLength={60}
          required
        />
      )}
    </div>
  );
}

export function SubmitButton({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-xl bg-brand-blue px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-90 disabled:opacity-60"
    >
      {pending ? "שומר..." : children}
    </button>
  );
}

/** A "new record" button that reveals an inline form and hides it after submit. */
export function AddRecord({
  label,
  action,
  children,
}: {
  label: string;
  action: (formData: FormData) => Promise<void>;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-xl bg-brand-blue px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-90"
      >
        {label}
      </button>
    );
  }

  return (
    <form
      action={async (formData) => {
        await action(formData);
        setOpen(false);
      }}
      className="w-full rounded-2xl border border-border bg-surface p-5 shadow-sm"
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
      <div className="mt-4 flex gap-2">
        <SubmitButton>שמירה</SubmitButton>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-xl border border-border px-4 py-2.5 text-sm font-semibold text-foreground/70 hover:bg-background"
        >
          ביטול
        </button>
      </div>
    </form>
  );
}

export function DeleteButton({
  action,
  confirmText = "למחוק את הרשומה?",
}: {
  action: () => Promise<void>;
  confirmText?: string;
}) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm(confirmText)) e.preventDefault();
      }}
    >
      <button
        type="submit"
        className="rounded-lg px-2 py-1 text-xs font-semibold text-danger hover:bg-danger/10"
      >
        מחיקה
      </button>
    </form>
  );
}

/** A generic confirm-then-submit button for non-delete actions (approve, reject, ...). */
export function ConfirmButton({
  action,
  confirmText,
  children,
  tone = "default",
}: {
  action: () => Promise<void>;
  confirmText?: string;
  children: React.ReactNode;
  tone?: "default" | "success" | "danger";
}) {
  const toneClass =
    tone === "success"
      ? "bg-success/10 text-success hover:bg-success/20"
      : tone === "danger"
        ? "text-danger hover:bg-danger/10"
        : "border border-border text-foreground/70 hover:bg-background";

  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (confirmText && !confirm(confirmText)) e.preventDefault();
      }}
    >
      <button type="submit" className={`rounded-lg px-2.5 py-1.5 text-xs font-bold ${toneClass}`}>
        {children}
      </button>
    </form>
  );
}

export function DataUnavailable() {
  return (
    <div className="rounded-2xl border border-dashed border-danger/40 bg-surface p-10 text-center">
      <p className="text-base font-semibold text-foreground">אין חיבור למסד הנתונים</p>
      <p className="mx-auto mt-2 max-w-lg text-sm text-muted">
        לא הצלחנו לקרוא את הנתונים. אפשר לראות מה בדיוק חסר בכתובת{" "}
        <code className="rounded bg-background px-1.5 py-0.5 font-mono text-xs">/api/health</code>{" "}
        - בדרך כלל חסר <code className="rounded bg-background px-1.5 py-0.5 font-mono text-xs">MONGODB_URI</code>{" "}
        או שכתובת ה-IP של השרת לא מאושרת ב-MongoDB Atlas.
      </p>
    </div>
  );
}

export function EmptyState({
  title,
  hint,
  action,
}: {
  title: string;
  hint: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-surface p-10 text-center">
      <p className="text-base font-semibold text-foreground">{title}</p>
      <p className="mx-auto mt-1 max-w-md text-sm text-muted">{hint}</p>
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  );
}
