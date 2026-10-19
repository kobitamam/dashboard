import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/db/queries";
import { recordUpload } from "@/lib/db/uploads";
import { uploadChunk } from "@/lib/onedrive";
import { readUploadToken } from "@/lib/upload-token";

export const dynamic = "force-dynamic";

// Vercel caps a request body at ~4.5MB, so the browser sends the file in
// pieces and this route relays each one to OneDrive's upload session.
const MAX_CHUNK_BYTES = 4 * 1024 * 1024;

function fail(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return fail("יש להתחבר למערכת", 401);
  // Uploads are only the signed quotes, which are partners-only.
  if (user.role !== "partner") return fail("פעולה זו מוגבלת לשותפים בלבד", 403);

  const payload = readUploadToken(request.headers.get("x-upload-token") ?? "");
  if (!payload || payload.ownerId !== user.organizationId) {
    return fail("בקשת ההעלאה פגה או אינה תקינה, נסה שוב", 403);
  }

  const start = Number(request.headers.get("x-chunk-start"));
  const end = Number(request.headers.get("x-chunk-end"));
  const bytes = new Uint8Array(await request.arrayBuffer());

  const valid =
    Number.isInteger(start) &&
    Number.isInteger(end) &&
    start >= 0 &&
    end >= start &&
    end < payload.size &&
    bytes.length === end - start + 1 &&
    bytes.length <= MAX_CHUNK_BYTES;
  if (!valid) return fail("קטע קובץ לא תקין", 400);

  try {
    const result = await uploadChunk(payload.uploadUrl, bytes, start, end, payload.size);
    if (result.done) {
      await recordUpload(payload.ownerId, payload.target, result.item, payload.contentType);
    }
    return NextResponse.json({ done: result.done });
  } catch (err) {
    console.error("OneDrive upload chunk failed:", err);
    return fail("ההעלאה ל-OneDrive נכשלה, נסה שוב", 502);
  }
}
