import { NextResponse } from "next/server";
import { createUser, DuplicateEmailError } from "@/lib/users";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const email = typeof body?.email === "string" ? body.email.trim() : "";
  const password = typeof body?.password === "string" ? body.password : "";

  if (!name || !email || !password) {
    return NextResponse.json({ error: "יש למלא שם, אימייל וסיסמה" }, { status: 400 });
  }

  if (password.length < 6) {
    return NextResponse.json({ error: "הסיסמה חייבת להיות באורך של 6 תווים לפחות" }, { status: 400 });
  }

  try {
    await createUser({ name, email, password });
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof DuplicateEmailError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error("Registration failed:", err);
    return NextResponse.json(
      { error: "לא הצלחנו להתחבר למסד הנתונים כרגע, נסה שוב מאוחר יותר" },
      { status: 500 },
    );
  }
}
