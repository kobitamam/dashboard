import type { MetadataRoute } from "next";

/**
 * Lets the site be installed as an app ("הוסף למסך הבית" on iPhone, "התקן" on Android/Chrome):
 * it opens full screen from its own icon, on the dashboard. Same site, so it is never out of date.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "TA-Estate",
    short_name: "TA-Estate",
    description: "מערכת ניהול לעסק שמאות מקרקעין - TA-Estate",
    lang: "he",
    dir: "rtl",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    background_color: "#f4f9fb",
    theme_color: "#ffffff",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      // Full-bleed with "TA" inside the safe zone, so Android may crop it to its own shape.
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
