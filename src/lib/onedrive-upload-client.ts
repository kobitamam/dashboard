import type { UploadTarget } from "@/lib/types";

// Graph needs every chunk but the last to be a multiple of 320 KiB, and a
// request body can't exceed ~4.5MB on Vercel - 9 x 320 KiB (~2.8MB) fits both.
const CHUNK_BYTES = 9 * 320 * 1024;

type StartUpload = (
  target: UploadTarget,
  fileName: string,
  contentType: string,
  size: number,
) => Promise<{ ok: true; token: string } | { ok: false; error: string }>;

/** Sends a file to the target's OneDrive folder through our own upload route. */
export async function uploadFileToOneDrive(
  file: File,
  target: UploadTarget,
  startUpload: StartUpload,
): Promise<void> {
  const started = await startUpload(target, file.name, file.type, file.size);
  if (!started.ok) throw new Error(started.error);

  for (let start = 0; start < file.size; start += CHUNK_BYTES) {
    const end = Math.min(start + CHUNK_BYTES, file.size) - 1;
    const res = await fetch("/api/onedrive/upload", {
      method: "POST",
      headers: {
        "x-upload-token": started.token,
        "x-chunk-start": String(start),
        "x-chunk-end": String(end),
      },
      body: file.slice(start, end + 1),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error ?? "ההעלאה נכשלה, נסה שוב");
    }
  }
}
