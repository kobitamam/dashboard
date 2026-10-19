"use client";

import { useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";

/**
 * A form that saves itself whenever one of its fields is changed (no save button). It listens
 * to the native "change" event, which a select fires on picking and a date field once the
 * date is complete, so a half-typed date isn't saved.
 */
export default function AutoSaveForm({
  action,
  className,
  children,
}: {
  action: (form: FormData) => Promise<void>;
  className?: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLFormElement>(null);

  useEffect(() => {
    const form = ref.current;
    if (!form) return;
    const save = () => form.requestSubmit();
    form.addEventListener("change", save);
    return () => form.removeEventListener("change", save);
  }, []);

  return (
    <form ref={ref} action={action} className={className}>
      {children}
      <SavingNote />
    </form>
  );
}

function SavingNote() {
  const { pending } = useFormStatus();
  return <p className="h-4 text-center text-[11px] text-muted">{pending ? "שומר..." : ""}</p>;
}
