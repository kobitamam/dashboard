# TA-Estate | דשבורד ניהול

מוקאפ של מערכת ניהול לעסק שמאות מקרקעין - TA-Estate (תמם אברהם).

בנוי עם Next.js (App Router), TypeScript ו-Tailwind CSS. כל הנתונים במוקאפ הם דמה (mock data) בקובץ `src/lib/mock-data.ts`.

## מסכים

- **דשבורד** (`/`) - סיכום כללי: לקוחות, תיקים דחופים, התראות, יומן ומיילים
- **לקוחות** (`/clients`) - ניהול וריכוז כל הלקוחות
- **מעקב תיקים** (`/cases`) - לוח תיקים לפי סטטוס
- **גבייה** (`/billing`) - חשבוניות וסטטוס תשלומים
- **התראות חכמות** (`/alerts`) - התראות על דדליינים, תשלומים ומסמכים חסרים
- **יומן ומייל** (`/calendar`) - אינטגרציה מדומה עם Google Calendar / Gmail

## הרצה מקומית

```bash
npm install
npm run dev
```

האפליקציה תעלה בכתובת [http://localhost:3000](http://localhost:3000).

## בנייה לפרודקשן

```bash
npm run build
npm run start
```
