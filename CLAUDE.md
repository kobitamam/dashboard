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
2. **Create folders by uploading a marker file to the path, not with POST `.../children`.**
   `POST /me/drive/special/approot/children` returns `400 invalidRequest` for any name. A path-based
   `PUT .../approot:/<case>/מסמכים/.keep:/content` makes Graph create every missing parent; the marker is
   then deleted (`ensureFolders()`). Re-running is safe (existing folders are reused).
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

The OneDrive connection (connect/disconnect) lives in its own tab, `/dashboard/onedrive`, open to every member of the organization
(employees too, so a partner never has to connect it for them); the OAuth callback still returns through `/api/onedrive/callback`
(the registered redirect).

10. **Employees never get the owner's folder link.** The plain `webUrl` (`oneDriveFolderUrl`) opens the office's own OneDrive and asks for
   the owner's Microsoft sign-in (or, on a machine already signed in as the owner, exposes the whole drive). Employees get
   `oneDriveShareUrl` instead: an anonymous *edit* share link (`createDocumentsShareLink`, Graph `createLink`) to the case's
   `מסמכים` sub-folder only, created with the folder and re-creatable from the card ("צור קישור", `createCaseShareLink`). It never
   points at the case folder root, which may hold quote files. Whether the narrow AppFolder scope may call `createLink` is unverified.

Layout in OneDrive: `TA-Estate Dashboard/הצעות מחיר/` holds the quote's Word letter and the signed quote - partners
only, they are never moved into a case and never listed on the case card (employees must not reach them).
`TA-Estate Dashboard/<TA-100-26>/מסמכים/` (`CASE_DOCUMENTS_FOLDER`) holds the case's documents, which employees may use.
The case card does NOT list or upload case files: it only links to the case's OneDrive folder (`oneDriveFolderUrl`);
employees add and read documents directly in OneDrive. The in-app upload exists only for the signed quote.
Two files that an earlier version moved into a case folder are tolerated by the Word lookup only.

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
- **Partners only**: quotes (הצעות מחיר), billing (גבייה), fee tracking (שכר טרחה), team management, demo data.
  Employees must never receive that data (it is not even loaded for their session).
- Fees are collected in two stages (`src/lib/fees.ts`): stage 1 (`baseAmount`) when the case is opened, stage 2 when it is
  completed - `finalAmount` (second half of an ordinary fee) and/or `successPercentage` x `successAmount` (betterment levy:
  advance first, then a percentage of the reduction). Payments cover stage 1 first. The billing tab lists what is due now.
  Approving a quote seeds the case's fee from the quote (`initialFee`). There are NO invoices any more (removed at the user's request):
  the billing tab, dashboard cards, alerts and the clients tab's "סה"כ חויב" all derive from the cases' fees. Employees' cases are
  loaded with `fee: null` / `feeNote: ""` (`loadDashboardData`).
- Case/quote numbers: `TA-100/26` and `Q-100/26`, atomic per-year counter starting at 100 (`src/lib/case-number.ts`).
- A partner can add more partners and employees from the team tab (`createMember`); an added partner has the same full access and
  `organizationId` = the founder's id. The founder (whose id is the organization id) and one's own account can't be removed.
- Each case has one handling partner and one handling employee (`partnerId`/`employeeId`, user ids from the organization). The cases
  tab's "התיקים שלי" is only a filter (`?scope=mine`); everyone can always switch to all cases.
- Types of appraisal are a built-in list plus partner-added ones (`loadCaseTypes`).
