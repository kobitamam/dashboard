"use server";

import { revalidatePath } from "next/cache";
import { currentUserId, requirePartnerId } from "@/lib/db/queries";
import { createEmployee, removeEmployee } from "@/lib/users";

function refresh() {
  revalidatePath("/dashboard/team");
}

export async function inviteEmployee(form: {
  name: string;
  email: string;
  password: string;
}) {
  const organizationId = await requirePartnerId();
  const name = form.name.trim();
  const email = form.email.trim();
  const password = form.password;

  if (!name || !email) throw new Error("יש למלא שם ואימייל");
  if (password.length < 6) throw new Error("הסיסמה חייבת להיות באורך של 6 תווים לפחות");

  await createEmployee({ organizationId, name, email, password });
  refresh();
}

export async function removeEmployeeAction(employeeId: string) {
  const organizationId = await requirePartnerId();
  const selfId = await currentUserId();
  if (employeeId === selfId) throw new Error("לא ניתן להסיר את החשבון שלך");

  await removeEmployee(organizationId, employeeId);
  refresh();
}
