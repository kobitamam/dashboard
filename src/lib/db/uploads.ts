import { casesRepo, quotesRepo } from "@/lib/db/entities";
import type { OneDriveItem } from "@/lib/onedrive";
import type { UploadTarget } from "@/lib/types";

/** Remembers a finished OneDrive upload on the case or quote it belongs to. */
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

  if (target.kind === "case") {
    await casesRepo.push(ownerId, target.caseId, "attachments", stored);
  } else {
    await quotesRepo.update(ownerId, target.quoteId, { signedFile: stored });
  }
}
