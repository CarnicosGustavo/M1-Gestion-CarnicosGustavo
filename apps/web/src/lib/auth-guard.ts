import { headers } from "next/headers";
import { auth } from "./auth";
import { db } from "./db";
import { user } from "./db/schema";
import { eq } from "drizzle-orm";

export async function getAuthUser() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  const sessionUser = session?.user ?? null;
  if (!sessionUser) return null;

  const [dbUser] = await db
    .select({ role: user.role })
    .from(user)
    .where(eq(user.id, sessionUser.id))
    .limit(1);

  return {
    ...sessionUser,
    role: dbUser?.role ?? (sessionUser as any).role ?? "cajero",
  };
}
