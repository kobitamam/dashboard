# TA-Estate dashboard

Next.js 16 (App Router, Server Actions) dashboard for a real-estate appraisal office (RTL Hebrew UI).
MongoDB (data), Auth.js credentials (JWT), Microsoft OneDrive (files), Vercel (hosting).
Owner/user: תמם אברהם (שמאי מקרקעין). The user is non-technical and writes in Hebrew; reply in Hebrew.

## OneDrive integration - hard-won rules (verified against the live account)

The app uses a delegated token with scope `Files.ReadWrite.AppFolder`: it can only touch its own folder,
`TA-Estate Dashboard` (Graph alias `/me/drive/special/approot`). This is deliberate - it can never reach the
user's other OneDrive files. Never widen the scope, and never add a delete/overwrite of files the app did not
create. All Graph code lives in `src/lib/onedrive.ts`; tokens (encrypted at rest) in `src/lib/db/onedrive-connection.ts`.

1. **Address everything by PATH, never by item id.** `GET /me/drive/items/{id}` returns `404 itemNotFound`
   for this token even for files we created. Use `/me/drive/special/approot:/<folder>/<file>` (see `appPath()`).
   An id is only acceptable inside a request body (e.g. `parentReference.id` when moving).
1b. **Exception - sharing calls go by the folder's ID, not by path** (verified live, twice): `POST .../createLink`, `GET .../permissions`
   and `DELETE .../permissions/{id}` addressed by path (`approot:/a/b:/permissions`) return `400 invalidRequest - Invalid request`, while
   `/me/drive/items/{id}/...` works. Get the id with the path lookup (`getAppFolder()`) first. When a path-based Graph call 400s,
   try the id form before anything else, and WRITE THE RESULT HERE so the next session doesn't repeat the experiment.
   Even by id, `DELETE .../permissions/{id}` on a sharing link answers `400 Failed to delete the permission` for this token (personal
   OneDrive), so a public link can only be removed by hand in OneDrive ("ניהול גישה"); `removeCaseShareLink` then finds none left.
2. **Create folders by uploading a marker file to the path, not with POST `.../children`.**
   `POST /me/drive/special/approot/children` returns `400 invalidRequest` for any name. A path-based
   `PUT .../approot:/מסמכי תיקים/<case>/.keep:/content` makes Graph create every missing parent; the marker is
   then deleted (`createFolders()` + `removeMarker()`). Re-running is safe (existing folders are reused).
3. **Small files (<4MB)**: `PUT <path>:/content?@microsoft.graph.conflictBehavior=replace` (`uploadSmallFile`).
   **Large files**: `createUploadSession` (path-based) and send chunks through our own route
   `/api/onedrive/upload` (Vercel caps request bodies at ~4.5MB; chunks are 9x320KiB, Graph requires multiples
   of 320KiB except the last). The pre-authenticated `uploadUrl` never reaches the browser - it travels as an
   AES-GCM token (`src/lib/upload-token.ts`). There is intentionally no size cap.
4. **Names**: `sanitizeFolderName()` strips control/bidi marks (pasted from Word) and `/ \ : * ? " < > |`.
   A case folder is named by its case number alone: `TA-100/26` -> `TA-100-26`. Never put addresses in folder names.
5. **Open in Word desktop**: the `ms-word:ofe|u|<direct file URL>` link (`wordDesktopUri`). For work/school accounts the
   direct URL is `webUrl`; for personal OneDrive it is rebuilt as `https://d.docs.live.net/<cid>/<path>`.
6. **Return errors as data from server actions.** Production masks thrown errors (React error #441), which hid the
   real cause for hours. Actions that talk to OneDrive return `{ ok: false, error }` with the HTTP status and
   Graph code/message (never a token); `graphError()` builds that text.
7. **OneDrive failures must not break the app.** Case/quote creation continues if the folder can't be made; the case card
   then shows "צור תיקייה" (`retryCaseOneDriveFolder`).
8. Removing a file in the UI only removes it from the list; the file stays in OneDrive.
9. The quote letter is generated from the office's own Word template (`src/lib/quote-template.ts`, base64,
   `{{PLACEHOLDERS}}`; fill logic in `src/lib/quote-document.ts`) and saved to `הצעות מחיר/` and STAYS there.

The OneDrive connection lives in its own tab, `/dashboard/onedrive`. It is ONE connection per organization (the office's own OneDrive),
so only a partner can connect/disconnect it (page, `disconnectOneDrive`, and the callback all check the role): an employee connecting
would silently replace the office's account with their own. Everyone sees its status and the open-folder setup. The authorize URL
sends `prompt=select_account`. The OAuth callback returns through `/api/onedrive/callback` (the registered redirect).

10. **No public share links on case folders.** An earlier version created an anonymous edit link per case (`createLink`) for
   employees; it worked, but a shared folder stopped opening in Finder from its web link (verified by the user), and anonymous links
   are a needless exposure. Employees instead get the `מסמכי תיקים` folder shared once with their Microsoft accounts and use their
   synced copy; their case card shows the folder name, never the owner's `webUrl` (it asks for the owner's sign-in). The leftover
   `oneDriveShareUrl` notes in the DB are ignored (the user confirmed in OneDrive that no links exist; the cancel button was removed).
   A web link can never open a local folder by itself:
   it opens in Finder only when the OneDrive app intercepts the folder's `webUrl`.

11. **Opening a case folder on the computer** (`OpenFolderLink`, one-time setup per computer, explained in the OneDrive tab): Mac
   (the partners) runs the user's own `OpenCase` Shortcut through `shortcuts://run-shortcut`; Windows (the employees) uses the
   `opencase://<case>` address registered by the `.reg` file served at `/api/windows-setup` (UTF-16, current user, runs a hidden
   PowerShell that opens `%OneDriveConsumer%\מסמכי תיקים\<case>`; only `[A-Za-z0-9-]` case numbers are accepted). The Mac route is VERIFIED live: Shortcuts did not pass the
   `text=` input to the shell script (`$1` was empty and the general `מסמכי תיקים` opened), so the button also copies the case
   number to the clipboard and the script falls back to it. The script shown in the OneDrive tab (`MAC_SCRIPT`) accepts only
   `[A-Za-z0-9-]` (a page could otherwise run the shortcut with `../..` and open any path) and searches
   `~/Library/CloudStorage/*/{Apps/TA-Estate Dashboard,TA-Estate Dashboard,}/מסמכי תיקים`, so the same text works for the owner, for
   Raz (shared `TA-Estate Dashboard`) and for an employee on a Mac; it avoids globs that zsh would abort on. The user's own Mac runs
   this script (verified live). Raz's Mac and the Windows route are not set up/tested yet (the user will do it later).

Layout in OneDrive: `TA-Estate Dashboard/הצעות מחיר/` holds the quote's Word letter and the signed quote - partners
only, they are never moved into a case and never listed on the case card (employees must not reach them).
`TA-Estate Dashboard/מסמכי תיקים/<TA-100-26>/` (`CASES_ROOT_FOLDER`) holds each case's documents. The office shares
`מסמכי תיקים` ONCE with the employees' own Microsoft accounts (all of whom have one), so every present and future case appears
for them as a regular synced folder; nothing in `הצעות מחיר` is inside it. The case card does NOT list or upload case files: it
links partners to the case's folder (`oneDriveFolderUrl`). The in-app upload exists only
for the signed quote. (Older layout `<case>/מסמכים` is gone; the only case that used it was a test case.)

## Calendar

- The calendar page is a Sunday-Thursday week (`src/lib/calendar.ts`). Case deadlines are derived from the cases (never stored);
  meetings/hearings are `events` (optionally linked to a case via `caseId`). Event times are floating office wall-clock times
  (stored as UTC fields) - the page, the .ics feed and Outlook all read them that way.
- Event types are a built-in list (`eventTypes`) plus ones anybody adds from the new-event form (`eventTypesRepo`, `loadEventTypes`).
- The calendar tab is a time-grid week like Apple Calendar (`src/components/WeekCalendar.tsx`): Sunday-Thursday, Friday/Saturday on request.
- **The Apple Calendar link the user wants is the read-only .ics subscription** (below); the two-way Outlook sync described next is built
  but its UI is hidden (the user said view-only is enough), so the connect button no longer appears.
- **Apple Calendar, two-way** (UI hidden): via a dedicated "TA-Estate" calendar in the user's Outlook (`src/lib/calendar-sync.ts`,
  `src/lib/ms-calendar.ts`). This is a SEPARATE Microsoft connection (`calendarConnections`, scope `Calendars.ReadWrite`) from OneDrive,
  so the OneDrive token keeps its narrow app-folder scope and its refresh never asks for more. It returns through the OneDrive callback
  (`/api/onedrive/callback`, the registered redirect) with a `cal:` prefix on the signed state. Sync runs on calendar page load (throttled
  to 1/min) and after creating an event; events carry `outlookId`/`syncHash`; deleting an event removes its Outlook twin first
  (`deleteOutlookTwin`), otherwise the next sync would re-import it. Not tested live: it needs the Microsoft account to have an Outlook
  mailbox (Graph otherwise answers MailboxNotEnabledForRESTAPI) and `Calendars.ReadWrite` consent.
- A one-way read-only .ics feed (`/api/calendar/<token>.ics`) also exists as a simpler alternative (`calendarFeeds`).

## Speed and sessions

- Atlas runs in AWS `EU_CENTRAL_1` (Frankfurt), so functions run in Vercel `fra1` (`vercel.json` `"regions"`); they ran in `iad1`
  before, at 95ms per database round trip; in `fra1` it is 2ms (verified live, the user reports the app is much faster). `/api/health` reports `server_region`, `database_region` (Atlas `hello` tags) and
  `database_round_trip_ms` (an additional `hello` after the ping, so it measures a warm connection).
- `getSessionUser()` and `loadDashboardData()` are wrapped in React `cache()`, so the layout and the page share one load per request.
  Pages run their remaining reads with `Promise.all`. `getDb()` creates the `ownerId`/`email`/`organizationId` indexes once per instance.
- `getSessionUser()` re-reads the account from `users` (memoized 60s per instance): a removed member is signed out and a role change
  applies within a minute, although the JWT itself lives for weeks. If the DB is unreachable it falls back to the token.
- `src/app/dashboard/loading.tsx` gives instant feedback on navigation. The Rubik font is self-hosted via `next/font`.

## Domain

- The app's address is `https://app.ta-estate.co.il` (added in Vercel > Domains by the user; DNS is at Hostinger, NOT at the
  registrar Domain The Net - its nameservers are `ns1/ns2.dns-parking.com` = Hostinger: CNAME `app` ->
  `548b15b6b9f47460.vercel-dns-017.com`). The old `dashboard-orpin-two-91.vercel.app` still works. Code builds absolute URLs from
  the request's origin (`requestOrigin()`), so the OneDrive callback on the new address needs
  `https://app.ta-estate.co.il/api/onedrive/callback` as a redirect URI in the Azure app registration "TA-Estate Dashboard"
  (added by the user; the old address's URI is kept). The Vercel MCP gets 403 on
  project/domain endpoints for this team, so domain changes are done by the user in the dashboard.

## Working here

- Develop on branch `claude/focused-goodall-iexeqf`. **Merge/push to `main` only when the user asks** (they test on
  production). Fast-forward only: `git push origin origin/<branch>:main`. Vercel then deploys; confirm `READY`
  with the Vercel MCP (`get_deployment`) before telling the user to test.
- Preview deployments have NO env vars (they are scoped to Production), so login/DB do not work there; test on `main`.
- Vercel runtime logs are not readable from here (403), so build diagnosability into error messages instead.
- Before committing: `npm run lint` and `npm run build` must pass.
- No live access to the user's Mongo/OneDrive: anything touching them is untested until the user tries it.

## Data model and permissions

- Every record is scoped by `ownerId` = the **organization** id (`requireOwnerId()` returns `session.user.organizationId`).
  A partner is the root of their organization; employees share the partner's data. `requirePartnerId()` gates actions.
- Approving a quote ("אישור ופתיחת תיק", `approveQuote`) opens its case right away; the signed quote may be uploaded before or after
  (at the user's request; verified live: one case with its OneDrive folder). The approval is claimed atomically, so a double click
  opens one case.
- **Partners only**: quotes (הצעות מחיר), billing (גבייה), fee tracking (שכר טרחה), team management, demo data, deleting a case or a client.
  Employees must never receive that data (it is not even loaded for their session).
- A quote's fee (`src/lib/fees.ts`, `FeeStructureFields`): amount before VAT and including VAT (`src/lib/vat.ts`, 18%), a number of
  payments and the percent of the fee of each; `feePercent` (share of the reduction) exists only for a betterment levy. Approving a
  quote copies it to the case as `fee.installments` (amounts include VAT). Installments fall due by stage (`feeStageOf`): the first when
  the case is opened, the last when it is completed (plus the share of the reduction), any in between once the draft is sent
  (status "נשלחה טיוטה" or a betterment stage past "טרם נשלחה טיוטה"). Receipts (`fee.payments`) cover installments in order. Fees saved
  before installments existed use `baseAmount`/`finalAmount`. The billing tab lists each case's installments and what is due now.
  There are NO invoices any more (removed at the user's request): the billing tab, dashboard cards, alerts and the clients tab's
  "סה"כ חויב" all derive from the cases' fees. Employees' cases are loaded with `fee: null` / `feeNote: ""` (`loadDashboardData`).
- Case/quote numbers: `TA-100/26` and `Q-100/26`, atomic per-year counter starting at 100 (`src/lib/case-number.ts`); when the
  organization has no cases (or no quotes) left, that counter starts over at 100, so test data can be deleted and numbering begins clean.
- Public registration is CLOSED (the `/register` page and `/api/register` were removed at the user's request): accounts are
  created only by a partner from the team tab. A partner can add more partners and employees there (`createMember`); an added partner has the same full access and
  `organizationId` = the founder's id. The founder (whose id is the organization id) and one's own account can't be removed.
- Each case has one handling partner and one handling employee (`partnerId`/`employeeId`, user ids from the organization). The cases
  tab's "התיקים שלי" is only a filter (`?scope=mine`); everyone can always switch to all cases.
- Types of appraisal are a built-in list plus partner-added ones (`loadCaseTypes`).
- Progress (`caseProgress`, `src/lib/types.ts`) is never typed by hand: a betterment-levy case follows its stage; every other case
  follows its status (דחוף 0, ממתין למידע 10, בתהליך 50, נשלחה טיוטה 90, הושלם 100). It is derived again in `toCase`, so older
  stored values don't matter. A new non-betterment case starts as "ממתין למידע" (`NEW_CASE_STATUS`; the new-case form has no
  status or progress field). An urgent (דחוף) case card has a light red background (any type).
- The case card has no "עדכון" button: its status/stage/partner/employee/date fields save on change (`AutoSaveForm`, native
  "change" event -> `requestSubmit`). The form is keyed by the saved values, because React resets a form after its action and a
  `<select>` ignores a changed `defaultValue` (verified in react-dom), which made a new assignee look unsaved.
