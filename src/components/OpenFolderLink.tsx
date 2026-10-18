"use client";

import { useSyncExternalStore } from "react";

type Platform = "mac" | "windows" | "other";

// The computer's kind never changes while the page is open, so there is nothing to subscribe to.
const subscribe = () => () => undefined;

function detectPlatform(): Platform {
  const hint = `${navigator.userAgent} ${navigator.platform}`;
  if (/Win/i.test(hint)) return "windows";
  if (/Mac/i.test(hint) && !/iPhone|iPad/i.test(hint)) return "mac";
  return "other";
}

/**
 * Opens a case's folder in Finder / File Explorer on this computer. A web page can't do that by
 * itself, so it calls a one-time setup done on each computer (see the OneDrive tab): the
 * "OpenCase" shortcut on a Mac, the "opencase:" address registered on Windows.
 */
export default function OpenFolderLink({ folderName }: { folderName: string }) {
  // Unknown while rendering on the server, so nothing is shown until the browser has told us.
  const platform = useSyncExternalStore<Platform | null>(subscribe, detectPlatform, () => null);

  if (platform === null) return null;

  if (platform === "other") {
    return <span className="text-muted">📁 מסמכי תיקים / {folderName}</span>;
  }

  const href =
    platform === "mac"
      ? `shortcuts://run-shortcut?name=OpenCase&input=text&text=${encodeURIComponent(folderName)}`
      : `opencase://${encodeURIComponent(folderName)}`;

  return (
    <a
      href={href}
      className="font-medium text-brand-blue hover:underline"
      title="פותח את תיקיית התיק במחשב הזה (דורש התקנה חד-פעמית, ראה בלשונית OneDrive)"
    >
      {platform === "mac" ? "🖥️ פתח ב-Finder" : "🖥️ פתח בתיקייה"}
    </a>
  );
}
