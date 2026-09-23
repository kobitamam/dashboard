import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export class MissingR2ConfigError extends Error {
  constructor() {
    super("תצורת האחסון (R2) חסרה");
    this.name = "MissingR2ConfigError";
  }
}

// Client documents are sensitive (טאבו, חוזים), so the bucket stays private:
// every read and write goes through a short-lived signed URL, never a public link.
const UPLOAD_URL_TTL_SECONDS = 600;
const DOWNLOAD_URL_TTL_SECONDS = 300;
export const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024;

let cachedClient: S3Client | null = null;

function client(): S3Client {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new MissingR2ConfigError();
  }

  if (!cachedClient) {
    cachedClient = new S3Client({
      region: "auto",
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId, secretAccessKey },
      // Recent SDK versions attach flexible-checksum params by default, which
      // R2 does not reliably honor and can turn into a rejected upload with
      // no useful error. R2 does not need them, so only send one if asked to.
      requestChecksumCalculation: "WHEN_REQUIRED",
      responseChecksumValidation: "WHEN_REQUIRED",
    });
  }
  return cachedClient;
}

function bucket(): string {
  const name = process.env.R2_BUCKET_NAME;
  if (!name) throw new MissingR2ConfigError();
  return name;
}

export function isR2Configured() {
  return !!(
    process.env.R2_ACCOUNT_ID &&
    process.env.R2_ACCESS_KEY_ID &&
    process.env.R2_SECRET_ACCESS_KEY &&
    process.env.R2_BUCKET_NAME
  );
}

export async function createUploadUrl(key: string, contentType: string) {
  const command = new PutObjectCommand({
    Bucket: bucket(),
    Key: key,
    ContentType: contentType,
  });
  return getSignedUrl(client(), command, { expiresIn: UPLOAD_URL_TTL_SECONDS });
}

export async function createDownloadUrl(key: string, fileName: string) {
  const command = new GetObjectCommand({
    Bucket: bucket(),
    Key: key,
    ResponseContentDisposition: `attachment; filename="${encodeURIComponent(fileName)}"`,
  });
  return getSignedUrl(client(), command, { expiresIn: DOWNLOAD_URL_TTL_SECONDS });
}

// A client can lie about a file's size before upload, so the real size is
// checked against the object R2 actually received, not what the browser claimed.
export async function getObjectSize(key: string): Promise<number | null> {
  try {
    const head = await client().send(new HeadObjectCommand({ Bucket: bucket(), Key: key }));
    return head.ContentLength ?? null;
  } catch {
    return null;
  }
}

export async function deleteObject(key: string) {
  await client().send(new DeleteObjectCommand({ Bucket: bucket(), Key: key }));
}
