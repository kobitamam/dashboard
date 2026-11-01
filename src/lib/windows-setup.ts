// The one-time Windows setup that lets "פתח בתיקייה" open a case's folder in File Explorer: it registers
// the "opencase:" address for the current user (no administrator needed).

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

const HANDLER = `powershell.exe -NoProfile -WindowStyle Hidden -Command "${COMMAND}"`;
const PROTOCOL_NAME = "URL:TA-Estate case folder";

const regEscape = (value: string) => value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');

/** A registry file, run once by double-clicking it (UTF-16 text, as Windows expects with Hebrew in it). */
export function registryFile(): string {
  return [
    "Windows Registry Editor Version 5.00",
    "",
    "[HKEY_CURRENT_USER\\Software\\Classes\\opencase]",
    `@="${PROTOCOL_NAME}"`,
    '"URL Protocol"=""',
    "",
    "[HKEY_CURRENT_USER\\Software\\Classes\\opencase\\shell\\open\\command]",
    `@="${regEscape(HANDLER)}"`,
    "",
  ].join("\r\n");
}

const psQuote = (value: string) => `'${value.replace(/'/g, "''")}'`;

/**
 * The same registration as one line to paste into PowerShell. Windows 11's Smart App Control blocks the
 * downloaded .reg file ("בקרת אפליקציות חכמה חסמה..."), and a typed command is not a downloaded file
 * (verified live on an employee's computer).
 */
export function powershellSetup(): string {
  return [
    "$k = 'HKCU:\\Software\\Classes\\opencase';",
    'New-Item -Path "$k\\shell\\open\\command" -Force | Out-Null;',
    `Set-ItemProperty -Path $k -Name '(default)' -Value ${psQuote(PROTOCOL_NAME)};`,
    "Set-ItemProperty -Path $k -Name 'URL Protocol' -Value '';",
    `Set-ItemProperty -Path "$k\\shell\\open\\command" -Name '(default)' -Value ${psQuote(HANDLER)};`,
    "Write-Host 'OK'",
  ].join(" ");
}
