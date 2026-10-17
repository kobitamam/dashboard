import { BETTERMENT_LEVY, type Case } from "@/lib/types";

export type CaseDeadline = {
  key: "due" | "arbitrator" | "counter";
  label: string;
  date: string; // YYYY-MM-DD
};

/** Every deadline a case has, in date order. Betterment-levy cases carry two extra statutory ones. */
export function caseDeadlines(c: Case): CaseDeadline[] {
  const list: CaseDeadline[] = [];
  if (c.dueDate) list.push({ key: "due", label: "תאריך יעד", date: c.dueDate });
  if (c.type === BETTERMENT_LEVY) {
    if (c.arbitratorRequestDate) {
      list.push({
        key: "arbitrator",
        label: "מועד א׳ - בקשת מינוי שמאי מכריע",
        date: c.arbitratorRequestDate,
      });
    }
    if (c.counterAppraisalDate) {
      list.push({
        key: "counter",
        label: "מועד ב׳ - הגשת שומה נגדית",
        date: c.counterAppraisalDate,
      });
    }
  }
  return list.sort((a, b) => a.date.localeCompare(b.date));
}
