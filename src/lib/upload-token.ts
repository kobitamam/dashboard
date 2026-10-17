import { decryptSecret, encryptSecret } from "@/lib/crypto";
import type { UploadTarget } from "@/lib/types";

// The browser never sees OneDrive's pre-authenticated upload URL: it gets this
// opaque, encrypted token instead and hands it back with each chunk, so the
// server can't be pointed at an arbitrary URL.
export type UploadTokenPayload = {
  uploadUrl: string;
  ownerId: string;
  target: UploadTarget;
  size: number;
  contentType: string;
  expires: number;
};

const TOKEN_TTL_MS = 60 * 60 * 1000;

export function createUploadToken(payload: Omit<UploadTokenPayload, "expires">): string {
  return encryptSecret(JSON.stringify({ ...payload, expires: Date.now() + TOKEN_TTL_MS }));
}

export function readUploadToken(token: string): UploadTokenPayload | null {
  try {
    const payload = JSON.parse(decryptSecret(token)) as UploadTokenPayload;
    return payload.expires > Date.now() ? payload : null;
  } catch {
    return null;
  }
}
