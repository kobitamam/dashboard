import { quotesRepo } from "@/lib/db/entities";
import type { OneDriveItem } from "@/lib/onedrive";
import type { UploadTarget } from "@/lib/types";

/** Remembers a finished OneDrive upload on the quote it belongs to. */
export async function recordUpload(
  ownerId: string,
  target: UploadTarget,
  item: OneDriveItem,
  contentType: string,
) {
  const stored = {
    key: item.id,
    fileName: item.name,
    size: item.size,
    contentType,
    uploadedAt: new Date(),
    webUrl: item.webUrl,
  };

  await quotesRepo.update(ownerId, target.quoteId, { signedFile: stored });
}
