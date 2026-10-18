import { auth } from "@/auth";

export const dynamic = "force-dynamic";

// The command Windows runs for an "opencase://TA-100-26" link: it opens that case's folder inside the
// synced "מסמכי תיקים" folder in File Explorer. Only a plain case number is accepted, so nothing else
// typed into a link can be run.
const COMMAND = [
  "$n = ('%1' -replace '^opencase:/*', '').TrimEnd('/');",
  "if ($n -notmatch '^[A-Za-z0-9-]+$') { exit };",
  "$r = $env:OneDriveConsumer; if (-not $r) { $r = $env:OneDrive };",
  // [char]34 is a double quote; typing one here would end the quoted command line early.
  "$q = [char]34; Start-Process explorer.exe ($q + $r + '\\מסמכי תיקים\\' + $n + $q)",
].join(" ");

const regEscape = (value: string) => value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');

/**
 * A registry file (for the current user only, no administrator needed) that registers the
 * "opencase:" address on a Windows computer. It is run once, by double-clicking it.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return new Response("Unauthorized", { status: 401 });

  const text = [
    "Windows Registry Editor Version 5.00",
    "",
    "[HKEY_CURRENT_USER\\Software\\Classes\\opencase]",
    '@="URL:TA-Estate case folder"',
    '"URL Protocol"=""',
    "",
    "[HKEY_CURRENT_USER\\Software\\Classes\\opencase\\shell\\open\\command]",
    `@="${regEscape(`powershell.exe -NoProfile -WindowStyle Hidden -Command "${COMMAND}"`)}"`,
    "",
  ].join("\r\n");

  // Registry files with Hebrew must be UTF-16 with a byte-order mark.
  const body = Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(text, "utf16le")]);
  return new Response(body, {
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Disposition": 'attachment; filename="ta-estate-open-folder.reg"',
      "Cache-Control": "no-store",
    },
  });
}
