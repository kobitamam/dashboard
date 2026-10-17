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
4. **Moving files** between folders: `PATCH <source path>` with `{ parentReference: { id: <destination folder id> } }`;
   get the destination id with a path GET (`moveFileBetweenFolders`). Works.
5. **Names**: `sanitizeFolderName()` strips control/bidi marks (pasted from Word) and `/ \ : * ? " < > |`.
   A case folder is named by its case number alone: `TA-100/26` -> `TA-100-26`. Never put addresses in folder names.
6. **Open in Word desktop**: the `ms-word:ofe|u|<direct file URL>` link (`wordDesktopUri`). For work/school accounts the
   direct URL is `webUrl`; for personal OneDrive it is rebuilt as `https://d.docs.live.net/<cid>/<path>`.
7. **Return errors as data from server actions.** Production masks thrown errors (React error #441), which hid the
   real cause for hours. Actions that talk to OneDrive return `{ ok: false, error }` with the HTTP status and
   Graph code/message (never a token); `graphError()` builds that text.
8. **OneDrive failures must not break the app.** Case/quote creation continues if the folder can't be made; the case card
   then shows "צור תיקייה" (`retryCaseOneDriveFolder`), which also moves the quote's Word + signed files in.
9. Removing a file in the UI only removes it from the list; the file stays in OneDrive.
10. The quote letter is generated from the office's own Word template (`src/lib/quote-template.ts`, base64,
   `{{PLACEHOLDERS}}`; fill logic in `src/lib/quote-document.ts`) and saved to `הצעות מחיר/`, moving into the
   case folder when the quote is approved.

Layout in OneDrive: `TA-Estate Dashboard/הצעות מחיר/<Q-number - client>.docx` and
`TA-Estate Dashboard/<TA-100-26>/מסמכים/<every case document>` - uploads, the quote's Word letter and the signed
quote all live in `מסמכים` (`CASE_DOCUMENTS_FOLDER`). Two files moved earlier sit in the case folder root, so lookups
also check there.

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
- Case/quote numbers: `TA-100/26` and `Q-100/26`, atomic per-year counter starting at 100 (`src/lib/case-number.ts`).
- Types of appraisal are a built-in list plus partner-added ones (`loadCaseTypes`).
