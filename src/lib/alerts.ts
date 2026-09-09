import { daysUntil } from "@/lib/format";
import type { Alert, CalendarEvent, Case, Invoice } from "@/lib/types";

const DEADLINE_WARNING_DAYS = 3;

/**
 * Alerts are never stored: they are recomputed from the current cases,
 * invoices and events so they cannot drift out of sync with the data.
 */
export function deriveAlerts(
  {
    cases,
    invoices,
    events,
  }: { cases: Case[]; invoices: Invoice[]; events: CalendarEvent[] },
  today = new Date(),
): Alert[] {
  const alerts: Alert[] = [];

  for (const invoice of invoices) {
    if (invoice.status === "שולם") continue;
    const days = daysUntil(invoice.dueDate, today);
    if (days === null) continue;

    if (days < 0) {
      alerts.push({
        id: `invoice-overdue-${invoice.id}`,
        title: "חשבונית באיחור תשלום",
        description: `חשבונית ${invoice.invoiceNumber} של ${invoice.clientName} באיחור של ${Math.abs(days)} ימים - מומלץ לשלוח תזכורת`,
        severity: "גבוהה",
        category: "תשלום",
      });
    } else if (days <= DEADLINE_WARNING_DAYS) {
      alerts.push({
        id: `invoice-due-${invoice.id}`,
        title: "חשבונית לתשלום בקרוב",
        description: `חשבונית ${invoice.invoiceNumber} של ${invoice.clientName} לתשלום ${days === 0 ? "היום" : `בעוד ${days} ימים`}`,
        severity: "בינונית",
        category: "תשלום",
      });
    }
  }

  for (const item of cases) {
    if (item.status === "הושלם") continue;
    const days = daysUntil(item.dueDate, today);

    if (days !== null && days < 0) {
      alerts.push({
        id: `case-late-${item.id}`,
        title: "תיק עבר את מועד ההגשה",
        description: `תיק ${item.caseNumber} (${item.clientName}) היה אמור להיות מוגש לפני ${Math.abs(days)} ימים - נותרו ${100 - item.progress}% להשלמה`,
        severity: "גבוהה",
        category: "תיק",
      });
    } else if (days !== null && days <= DEADLINE_WARNING_DAYS) {
      alerts.push({
        id: `case-due-${item.id}`,
        title: "תיק מתקרב לדדליין",
        description: `תיק ${item.caseNumber} (${item.clientName}) להגשה ${days === 0 ? "היום" : `בעוד ${days} ימים`} - נותרו ${100 - item.progress}% להשלמה`,
        severity: days === 0 ? "גבוהה" : "בינונית",
        category: "תיק",
      });
    }

    if (item.status === "ממתין למידע") {
      alerts.push({
        id: `case-waiting-${item.id}`,
        title: "תיק ממתין למידע",
        description: `תיק ${item.caseNumber} (${item.clientName}) ממתין למסמכים או מידע מהלקוח`,
        severity: "נמוכה",
        category: "תיק",
      });
    }
  }

  for (const event of events) {
    const days = daysUntil(event.start, today);
    if (days === 0) {
      alerts.push({
        id: `event-today-${event.id}`,
        title: "פגישה היום",
        description: `${event.title}${event.location ? ` · ${event.location}` : ""}`,
        severity: "בינונית",
        category: "פגישה",
      });
    }
  }

  const order = { גבוהה: 0, בינונית: 1, נמוכה: 2 } as const;
  return alerts.sort((a, b) => order[a.severity] - order[b.severity]);
}
