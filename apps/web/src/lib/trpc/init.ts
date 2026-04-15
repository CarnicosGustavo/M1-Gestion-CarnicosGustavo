import {
  router,
  createCallerFactory,
  publicProcedure,
  protectedProcedure,
  adminProcedure,
  almacenProcedure,
  cajeroProcedure,
  withRole,
  type TRPCContext,
  type UserRole,
} from "@finopenpos/api";
import { getAuthUser } from "@/lib/auth-guard";

export {
  router,
  createCallerFactory,
  publicProcedure,
  protectedProcedure,
  adminProcedure,
  almacenProcedure,
  cajeroProcedure,
  withRole,
};
export type { TRPCContext, UserRole };

export const createTRPCContext = async (): Promise<TRPCContext> => {
  const user = await getAuthUser();
  return { user: user ? { ...user, role: (user as any).role ?? "cajero" } : null };
};
