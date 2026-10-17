import DaysCalculator from "@/components/DaysCalculator";
import { PageHeader } from "@/components/ui";

export default function DaysPage() {
  return (
    <div>
      <PageHeader
        title="מחשבון ימים"
        subtitle="הוספה, החסרה וספירה של ימים, עם אפשרות לדלג על ימים בשבוע ועל חגים"
      />
      <DaysCalculator />
      <p className="mx-auto mt-4 max-w-3xl text-xs text-muted">
        המחשבון הוא כלי עזר. מועדים הקבועים בדין (למשל בקשת מינוי שמאי מכריע או שומה נגדית) כדאי
        לאמת מול הוראות החוק.
      </p>
    </div>
  );
}
