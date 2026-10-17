"use server";

import { revalidatePath } from "next/cache";
import { currentUserId, requirePartnerId } from "@/lib/db/queries";
import { createMember, removeMember, type Role } from "@/lib/users";

function refresh() {
  revalidatePath("/dashboard/team");
}

export async function inviteMember(form: {
  name: string;
  email: string;
  password: string;
  role: Role;
}) {
  const organizationId = await requirePartnerId();
  const name = form.name.trim();
  const email = form.email.trim();
  const password = form.password;
  const role: Role = form.role === "partner" ? "partner" : "employee";

  if (!name || !email) throw new Error("יש למלא שם ואימייל");
  if (password.length < 6) throw new Error("הסיסמה חייבת להיות באורך של 6 תווים לפחות");

  await createMember({ organizationId, name, email, password, role });
  refresh();
}

export async function removeMemberAction(userId: string) {
  const organizationId = await requirePartnerId();
  const selfId = await currentUserId();
  if (userId === selfId) throw new Error("לא ניתן להסיר את החשבון שלך");

  await removeMember(organizationId, userId);
  refresh();
}
