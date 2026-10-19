"use server";

import { revalidatePath } from "next/cache";
import { currentUserId, requirePartnerId } from "@/lib/db/queries";
import { createMember, DuplicateEmailError, removeMember, type Role } from "@/lib/users";

function refresh() {
  revalidatePath("/dashboard/team");
}

export async function inviteMember(form: {
  name: string;
  email: string;
  password: string;
  role: Role;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const organizationId = await requirePartnerId();
  const name = form.name.trim();
  const email = form.email.trim();
  const password = form.password;
  const role: Role = form.role === "partner" ? "partner" : "employee";

  // Returned as data: production hides the message of a thrown server-action error.
  if (!name || !email) return { ok: false, error: "יש למלא שם ואימייל" };
  if (password.length < 6) return { ok: false, error: "הסיסמה חייבת להיות באורך של 6 תווים לפחות" };

  try {
    await createMember({ organizationId, name, email, password, role });
  } catch (err) {
    if (err instanceof DuplicateEmailError) return { ok: false, error: err.message };
    console.error("Failed to add a team member:", err);
    return { ok: false, error: "ההוספה נכשלה, נסה שוב" };
  }
  refresh();
  return { ok: true };
}

export async function removeMemberAction(userId: string) {
  const organizationId = await requirePartnerId();
  const selfId = await currentUserId();
  // One's own account can't be removed (the page doesn't offer it either).
  if (userId === selfId) return;

  await removeMember(organizationId, userId);
  refresh();
}
