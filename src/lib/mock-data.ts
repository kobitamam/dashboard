export type ClientStatus = "פעיל" | "ליד חדש" | "סגור";

export type Client = {
  id: string;
  name: string;
  phone: string;
  email: string;
  propertyType: string;
  status: ClientStatus;
  lastContact: string;
  openCases: number;
  totalBilled: number;
};

export const clients: Client[] = [
  {
    id: "c1",
    name: "אבי כהן",
    phone: "050-1234567",
    email: "avi.cohen@example.com",
    propertyType: "דירת מגורים",
    status: "פעיל",
    lastContact: "לפני יומיים",
    openCases: 2,
    totalBilled: 4800,
  },
  {
    id: "c2",
    name: "מיכל לוי",
    phone: "052-2345678",
    email: "michal.levi@example.com",
    propertyType: "נכס מסחרי",
    status: "פעיל",
    lastContact: "לפני שעה",
    openCases: 1,
    totalBilled: 12500,
  },
  {
    id: "c3",
    name: "בנק הפועלים - סניף רמת גן",
    phone: "03-6234567",
    email: "realestate@poalim-branch.example",
    propertyType: "ליווי בנקאי",
    status: "פעיל",
    lastContact: "לפני 3 שעות",
    openCases: 5,
    totalBilled: 38000,
  },
  {
    id: "c4",
    name: "רונית ושמעון גולן",
    phone: "054-3456789",
    email: "golan.family@example.com",
    propertyType: "ירושה",
    status: "ליד חדש",
    lastContact: "אתמול",
    openCases: 1,
    totalBilled: 0,
  },
  {
    id: "c5",
    name: "דוד מזרחי",
    phone: "050-4567890",
    email: "david.mizrahi@example.com",
    propertyType: "מגרש",
    status: "פעיל",
    lastContact: "לפני 5 ימים",
    openCases: 1,
    totalBilled: 3200,
  },
  {
    id: "c6",
    name: "קבוצת נדל\"ן שקד",
    phone: "09-8765432",
    email: "office@shaked-realestate.example",
    propertyType: "נכס מסחרי",
    status: "סגור",
    lastContact: "לפני שבועיים",
    openCases: 0,
    totalBilled: 21000,
  },
  {
    id: "c7",
    name: "יעל אברמוביץ",
    phone: "058-5678901",
    email: "yael.a@example.com",
    propertyType: "דירת מגורים",
    status: "ליד חדש",
    lastContact: "לפני 4 ימים",
    openCases: 0,
    totalBilled: 0,
  },
];

export type CaseStatus = "בתהליך" | "ממתין למידע" | "דחוף" | "הושלם";

export type Case = {
  id: string;
  caseNumber: string;
  clientName: string;
  address: string;
  type: string;
  status: CaseStatus;
  dueDate: string;
  progress: number;
};

export const cases: Case[] = [
  {
    id: "k1",
    caseNumber: "TA-1042",
    clientName: "בנק הפועלים - סניף רמת גן",
    address: "רוטשילד 45, תל אביב",
    type: "שומת מקרקעין לצרכי מימון",
    status: "דחוף",
    dueDate: "9 בספטמבר",
    progress: 80,
  },
  {
    id: "k2",
    caseNumber: "TA-1041",
    clientName: "אבי כהן",
    address: "ויצמן 12, רמת השרון",
    type: "שומה לצרכי מכירה",
    status: "בתהליך",
    dueDate: "13 בספטמבר",
    progress: 55,
  },
  {
    id: "k3",
    caseNumber: "TA-1039",
    clientName: "מיכל לוי",
    address: "הנרייטה סולד 8, הרצליה",
    type: "שומת נכס מסחרי",
    status: "ממתין למידע",
    dueDate: "16 בספטמבר",
    progress: 30,
  },
  {
    id: "k4",
    caseNumber: "TA-1037",
    clientName: "רונית ושמעון גולן",
    address: "העצמאות 3, פתח תקווה",
    type: "שומת ירושה",
    status: "בתהליך",
    dueDate: "20 בספטמבר",
    progress: 40,
  },
  {
    id: "k5",
    caseNumber: "TA-1035",
    clientName: "דוד מזרחי",
    address: "מגרש 17, גוש 6941, יבנה",
    type: "שומת מגרש",
    status: "הושלם",
    dueDate: "1 בספטמבר",
    progress: 100,
  },
  {
    id: "k6",
    caseNumber: "TA-1044",
    clientName: "בנק הפועלים - סניף רמת גן",
    address: "ז'בוטינסקי 88, רמת גן",
    type: "שומת מקרקעין לצרכי מימון",
    status: "דחוף",
    dueDate: "10 בספטמבר",
    progress: 65,
  },
];

export type InvoiceStatus = "שולם" | "ממתין לתשלום" | "באיחור";

export type Invoice = {
  id: string;
  invoiceNumber: string;
  clientName: string;
  amount: number;
  issueDate: string;
  dueDate: string;
  status: InvoiceStatus;
};

export const invoices: Invoice[] = [
  {
    id: "inv1",
    invoiceNumber: "3021",
    clientName: "בנק הפועלים - סניף רמת גן",
    amount: 8500,
    issueDate: "01/09",
    dueDate: "15/09",
    status: "ממתין לתשלום",
  },
  {
    id: "inv2",
    invoiceNumber: "3020",
    clientName: "מיכל לוי",
    amount: 4200,
    issueDate: "28/08",
    dueDate: "04/09",
    status: "באיחור",
  },
  {
    id: "inv3",
    invoiceNumber: "3019",
    clientName: "דוד מזרחי",
    amount: 3200,
    issueDate: "20/08",
    dueDate: "03/09",
    status: "שולם",
  },
  {
    id: "inv4",
    invoiceNumber: "3018",
    clientName: "קבוצת נדל\"ן שקד",
    amount: 21000,
    issueDate: "15/08",
    dueDate: "29/08",
    status: "שולם",
  },
  {
    id: "inv5",
    invoiceNumber: "3022",
    clientName: "אבי כהן",
    amount: 2600,
    issueDate: "05/09",
    dueDate: "19/09",
    status: "ממתין לתשלום",
  },
];

export type AlertSeverity = "גבוהה" | "בינונית" | "נמוכה";

export type Alert = {
  id: string;
  title: string;
  description: string;
  severity: AlertSeverity;
  time: string;
  category: "תשלום" | "תיק" | "פגישה" | "מסמך";
};

export const alerts: Alert[] = [
  {
    id: "a1",
    title: "חשבונית באיחור תשלום",
    description: "חשבונית 3020 של מיכל לוי באיחור של 5 ימים - מומלץ לשלוח תזכורת",
    severity: "גבוהה",
    time: "לפני 20 דקות",
    category: "תשלום",
  },
  {
    id: "a2",
    title: "תיק מתקרב לדדליין",
    description: "תיק TA-1042 (בנק הפועלים) להגשה מחר - נותרו 20% להשלמה",
    severity: "גבוהה",
    time: "לפני שעה",
    category: "תיק",
  },
  {
    id: "a3",
    title: "פגישה בעוד שעתיים",
    description: "ביקור בנכס עם רונית ושמעון גולן, העצמאות 3 פתח תקווה",
    severity: "בינונית",
    time: "לפני 3 שעות",
    category: "פגישה",
  },
  {
    id: "a4",
    title: "מסמך חסר בתיק",
    description: "תיק TA-1039 (מיכל לוי) - טאבו מעודכן עדיין לא התקבל",
    severity: "בינונית",
    time: "אתמול",
    category: "מסמך",
  },
  {
    id: "a5",
    title: "ליד חדש לא טופל",
    description: "יעל אברמוביץ פנתה לפני 4 ימים ועדיין לא נקבעה שיחה ראשונית",
    severity: "נמוכה",
    time: "לפני 4 ימים",
    category: "תיק",
  },
];

export type CalendarEvent = {
  id: string;
  title: string;
  time: string;
  location: string;
  type: "ביקור בנכס" | "פגישת לקוח" | "הגשת שומה" | "שיחת טלפון";
};

export const todayEvents: CalendarEvent[] = [
  {
    id: "e1",
    title: "ביקור בנכס - רוטשילד 45 תל אביב",
    time: "09:30",
    location: "תל אביב",
    type: "ביקור בנכס",
  },
  {
    id: "e2",
    title: "פגישה עם רונית ושמעון גולן",
    time: "12:00",
    location: "פתח תקווה",
    type: "פגישת לקוח",
  },
  {
    id: "e3",
    title: "הגשת שומה - תיק TA-1042",
    time: "17:00",
    location: "מקוון",
    type: "הגשת שומה",
  },
  {
    id: "e4",
    title: "שיחת טלפון עם בנק הפועלים",
    time: "18:30",
    location: "טלפוני",
    type: "שיחת טלפון",
  },
];

export type EmailItem = {
  id: string;
  from: string;
  subject: string;
  snippet: string;
  time: string;
  linkedTo?: string;
  unread: boolean;
};

export const recentEmails: EmailItem[] = [
  {
    id: "m1",
    from: "בנק הפועלים - סניף רמת גן",
    subject: "בקשה דחופה לשומה מעודכנת - ז'בוטינסקי 88",
    snippet: "בהמשך לשיחתנו, נבקש להעביר שומה מעודכנת עד יום רביעי...",
    time: "09:12",
    linkedTo: "TA-1044",
    unread: true,
  },
  {
    id: "m2",
    from: "מיכל לוי",
    subject: "מסמכי טאבו מצורפים",
    snippet: "היי, מצרפת את מסמכי הטאבו המעודכנים שביקשת בשבוע שעבר...",
    time: "08:47",
    linkedTo: "TA-1039",
    unread: true,
  },
  {
    id: "m3",
    from: "רשות המסים",
    subject: "אישור קבלת דיווח שומה",
    snippet: "הדיווח שהוגש עבור תיק TA-1035 נקלט במערכת בהצלחה...",
    time: "אתמול",
    linkedTo: "TA-1035",
    unread: false,
  },
  {
    id: "m4",
    from: "יעל אברמוביץ",
    subject: "בקשה לפגישת ייעוץ",
    snippet: "שלום, קיבלתי את הפרטים שלך מחבר וארצה לתאם שיחה בנוגע ל...",
    time: "לפני 4 ימים",
    unread: false,
  },
];
