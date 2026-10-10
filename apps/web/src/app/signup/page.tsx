import { redirect } from "next/navigation";
import { getAuthUser } from "@/lib/auth-guard";
import SignupForm from "./signup-form";

export const dynamic = "force-dynamic";

/** Alta de usuarios: solo administradores. */
export default async function SignupPage() {
  const current = await getAuthUser();
  if (!current) redirect("/login");
  if (current.role !== "admin") redirect("/admin");
  return <SignupForm />;
}
