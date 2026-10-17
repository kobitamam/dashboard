import DaysCalculator from "@/components/DaysCalculator";
import { PageHeader } from "@/components/ui";

export default function DaysPage() {
  return (
    <div>
      <PageHeader
        title="מחשבון ימים"
        subtitle="תאריך התחלה ומספר ימים - והתאריך בתום הספירה"
      />
      <DaysCalculator />
    </div>
  );
}
