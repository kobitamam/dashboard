import { auth } from "@/auth";
import { registryFile } from "@/lib/windows-setup";

export const dynamic = "force-dynamic";

/**
 * A registry file (for the current user only, no administrator needed) that registers the
 * "opencase:" address on a Windows computer. It is run once, by double-clicking it.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return new Response("Unauthorized", { status: 401 });

  const text = registryFile();

  // Registry files with Hebrew must be UTF-16 with a byte-order mark.
  const body = Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(text, "utf16le")]);
  return new Response(body, {
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Disposition": 'attachment; filename="ta-estate-open-folder.reg"',
      "Cache-Control": "no-store",
    },
  });
}
