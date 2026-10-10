"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getAuthUser } from "@/lib/auth-guard";
import { db } from "@/lib/db";
import { user } from "@/lib/db/schema";

const ROLES = ["admin", "almacen", "cajero"] as const;
type Role = (typeof ROLES)[number];

/**
 * Alta de usuarios: solo un administrador con sesión activa puede crear cuentas.
 * El registro público está deshabilitado (ver packages/auth).
 */
export async function signup(formData: FormData) {
  const current = await getAuthUser();
  if (!current) redirect("/login");
  if (current.role !== "admin") redirect("/signup?error=forbidden");

  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const roleInput = String(formData.get("role") ?? "cajero");
  const role: Role = (ROLES as readonly string[]).includes(roleInput)
    ? (roleInput as Role)
    : "cajero";

  let createdId: string | null = null;
  try {
    // Llamada del lado del servidor, sin headers de la petición: no cambia
    // la sesión del administrador (autoSignIn está deshabilitado).
    const res = await auth.api.signUpEmail({ body: { email, password, name } });
    createdId = res.user.id;
  } catch (err) {
    console.error("SignUp failed:", err);
  }
  if (!createdId) redirect("/signup?error=signup-failed");

  await db
    .update(user)
    .set({ role, updatedAt: new Date() })
    .where(eq(user.id, createdId));

  redirect("/signup?created=1");
}
