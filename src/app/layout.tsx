import type { Metadata } from "next";
import "./globals.css";
import AppShell from "@/components/AppShell";

export const metadata: Metadata = {
  title: "TA-Estate | דשבורד ניהול",
  description: "מערכת ניהול לעסק שמאות מקרקעין - TA-Estate",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="he" dir="rtl" className="h-full">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Rubik:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body
        className="h-full antialiased"
        style={{ "--font-app": "'Rubik', sans-serif" } as React.CSSProperties}
      >
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
