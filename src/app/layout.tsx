import type { Metadata, Viewport } from "next";
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
  // Added to the iPhone home screen it opens full screen, named TA-Estate (icon: app/apple-icon.png).
  appleWebApp: { capable: true, title: "TA-Estate", statusBarStyle: "default" },
  // Next emits only the standard mobile-web-app-capable; older iOS versions read Apple's own name.
  other: { "apple-mobile-web-app-capable": "yes" },
};

export const viewport: Viewport = {
  themeColor: "#ffffff", // the header's colour, so the phone's status bar blends with it
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="he" dir="rtl" className={`h-full ${rubik.variable}`}>
      <body className="h-full antialiased">{children}</body>
    </html>
  );
}
