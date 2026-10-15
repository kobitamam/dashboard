import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

export class MissingAuthSecretError extends Error {
  constructor() {
    super("משתנה הסביבה AUTH_SECRET אינו מוגדר");
    this.name = "MissingAuthSecretError";
  }
}

// AUTH_SECRET is an arbitrary-length string (the NextAuth signing key); hashing
// it down to 32 bytes gives AES-256-GCM a fixed-size key without a second secret.
function encryptionKey(): Buffer {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new MissingAuthSecretError();
  return createHash("sha256").update(secret).digest();
}

/** Encrypts a string for storage at rest (e.g. OAuth refresh tokens in Mongo). */
export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv, authTag, ciphertext].map((buf) => buf.toString("base64")).join(".");
}

export function decryptSecret(stored: string): string {
  const [ivB64, tagB64, dataB64] = stored.split(".");
  if (!ivB64 || !tagB64 || !dataB64) throw new Error("Malformed encrypted value");

  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(dataB64, "base64")),
    decipher.final(),
  ]);
  return plaintext.toString("utf8");
}
