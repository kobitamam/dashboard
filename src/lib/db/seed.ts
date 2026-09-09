import { casesRepo, clientsRepo, eventsRepo, invoicesRepo } from "@/lib/db/entities";

const at = (dayOffset: number, hour = 9, minute = 0) => {
  const date = new Date();
  date.setDate(date.getDate() + dayOffset);
  date.setHours(hour, minute, 0, 0);
  return date;
};

/**
 * Dates are relative to the seeding day so a fresh account immediately shows
 * meaningful deadlines and alerts rather than a wall of expired ones.
 */
export async function seedDemoData(ownerId: string) {
  await clientsRepo.insertMany(ownerId, [
    {
      name: "אבי כהן",
      phone: "050-1234567",
      email: "avi.cohen@example.com",
      propertyType: "דירת מגורים",
      status: "פעיל",
      notes: "",
    },
    {
      name: "מיכל לוי",
      phone: "052-2345678",
      email: "michal.levi@example.com",
      propertyType: "נכס מסחרי",
      status: "פעיל",
      notes: "",
    },
    {
      name: "בנק הפועלים - סניף רמת גן",
      phone: "03-6234567",
      email: "realestate@poalim-branch.example",
      propertyType: "ליווי בנקאי",
      status: "פעיל",
      notes: "לקוח מוסדי, תנאי תשלום שוטף+30",
    },
    {
      name: "רונית ושמעון גולן",
      phone: "054-3456789",
      email: "golan.family@example.com",
      propertyType: "ירושה",
      status: "ליד חדש",
      notes: "",
    },
    {
      name: "דוד מזרחי",
      phone: "050-4567890",
      email: "david.mizrahi@example.com",
      propertyType: "מגרש",
      status: "פעיל",
      notes: "",
    },
  ]);

  await casesRepo.insertMany(ownerId, [
    {
      caseNumber: "TA-1042",
      clientName: "בנק הפועלים - סניף רמת גן",
      address: "רוטשילד 45, תל אביב",
      type: "שומת מקרקעין לצרכי מימון",
      status: "דחוף",
      dueDate: at(1),
      progress: 80,
    },
    {
      caseNumber: "TA-1041",
      clientName: "אבי כהן",
      address: "ויצמן 12, רמת השרון",
      type: "שומה לצרכי מכירה",
      status: "בתהליך",
      dueDate: at(5),
      progress: 55,
    },
    {
      caseNumber: "TA-1039",
      clientName: "מיכל לוי",
      address: "הנרייטה סולד 8, הרצליה",
      type: "שומת נכס מסחרי",
      status: "ממתין למידע",
      dueDate: at(8),
      progress: 30,
    },
    {
      caseNumber: "TA-1037",
      clientName: "רונית ושמעון גולן",
      address: "העצמאות 3, פתח תקווה",
      type: "שומת ירושה",
      status: "בתהליך",
      dueDate: at(12),
      progress: 40,
    },
    {
      caseNumber: "TA-1035",
      clientName: "דוד מזרחי",
      address: "מגרש 17, גוש 6941, יבנה",
      type: "שומת מגרש",
      status: "הושלם",
      dueDate: at(-7),
      progress: 100,
    },
  ]);

  await invoicesRepo.insertMany(ownerId, [
    {
      invoiceNumber: "3021",
      clientName: "בנק הפועלים - סניף רמת גן",
      amount: 8500,
      issueDate: at(-8),
      dueDate: at(6),
      status: "ממתין לתשלום",
    },
    {
      invoiceNumber: "3020",
      clientName: "מיכל לוי",
      amount: 4200,
      issueDate: at(-20),
      dueDate: at(-5),
      status: "באיחור",
    },
    {
      invoiceNumber: "3019",
      clientName: "דוד מזרחי",
      amount: 3200,
      issueDate: at(-25),
      dueDate: at(-10),
      status: "שולם",
    },
    {
      invoiceNumber: "3022",
      clientName: "אבי כהן",
      amount: 2600,
      issueDate: at(-2),
      dueDate: at(12),
      status: "ממתין לתשלום",
    },
  ]);

  await eventsRepo.insertMany(ownerId, [
    {
      title: "ביקור בנכס - רוטשילד 45 תל אביב",
      start: at(0, 9, 30),
      location: "תל אביב",
      type: "ביקור בנכס",
    },
    {
      title: "פגישה עם רונית ושמעון גולן",
      start: at(0, 12, 0),
      location: "פתח תקווה",
      type: "פגישת לקוח",
    },
    {
      title: "הגשת שומה - תיק TA-1042",
      start: at(1, 17, 0),
      location: "מקוון",
      type: "הגשת שומה",
    },
    {
      title: "שיחת טלפון עם בנק הפועלים",
      start: at(2, 18, 30),
      location: "טלפוני",
      type: "שיחת טלפון",
    },
  ]);
}
