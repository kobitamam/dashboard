import type { Metadata } from "next";
import { Rubik } from "next/font/google";
import "./globals.css";

// Served from this site with the page (no render-blocking request to Google on every visit).
const rubik = Rubik({
  subsets: ["hebrew", "latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
  variable: "--font-app",
});

export const metadata: Metadata = {
  title: "TA-Estate | ניהול משרד שמאות מקרקעין",
  description: "מערכת ניהול לעסק שמאות מקרקעין - TA-Estate",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="he" dir="rtl" className={`h-full ${rubik.variable}`}>
      <body className="h-full antialiased">{children}</body>
    </html>
  );
}
