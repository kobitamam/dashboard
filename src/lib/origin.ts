import { headers } from "next/headers";

/** This deployment's own address (e.g. https://…vercel.app), as the browser reached it. */
export async function requestOrigin() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  return `${proto}://${host}`;
}
