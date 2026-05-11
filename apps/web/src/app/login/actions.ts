"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

export async function login(formData: FormData) {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  try {
    await auth.api.signInEmail({
      body: { email, password },
      headers: await headers(),
    });
  } catch (err) {
    const e = err as unknown as { message?: string; code?: string; status?: number };
    const reason = [
      e.code ? `code:${e.code}` : null,
      typeof e.status === "number" ? `status:${e.status}` : null,
      e.message ? `msg:${e.message}` : null,
    ]
      .filter(Boolean)
      .join(" | ")
      .slice(0, 200);
    console.error("SignIn failed:", err);
    redirect(`/login?error=invalid-credentials&reason=${encodeURIComponent(reason)}`);
  }

  revalidatePath("/admin", "layout");
  redirect("/admin");
}

export async function logout() {
  await auth.api.signOut({
    headers: await headers(),
  });

  revalidatePath("/", "layout");
  redirect("/");
}
