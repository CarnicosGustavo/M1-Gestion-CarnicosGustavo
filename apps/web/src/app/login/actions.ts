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
    const e = err as any;
    const msg = typeof e?.message === "string" ? e.message : "";
    const code = typeof e?.code === "string" ? e.code : "";
    const status =
      typeof e?.status === "number"
        ? String(e.status)
        : typeof e?.status === "string"
          ? e.status
          : "";
    const causeMsg =
      typeof e?.cause?.message === "string"
        ? e.cause.message
        : typeof e?.error?.message === "string"
          ? e.error.message
          : "";
    const causeCode =
      typeof e?.cause?.code === "string"
        ? e.cause.code
        : typeof e?.error?.code === "string"
          ? e.error.code
          : "";

    const reason = [
      code ? `code:${code}` : null,
      status ? `status:${status}` : null,
      msg ? `msg:${msg}` : null,
      causeCode ? `cause_code:${causeCode}` : null,
      causeMsg ? `cause_msg:${causeMsg}` : null,
    ]
      .filter(Boolean)
      .join(" | ")
      .slice(0, 800);
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
