import { initTRPC, TRPCError } from "@trpc/server";
import type { OpenApiMeta } from "trpc-to-openapi";
import superjson from "superjson";

export type UserRole = "admin" | "almacen" | "cajero";

export interface BaseUser {
  id: string;
  name: string;
  email: string;
  role?: string;
}

export interface TRPCContext {
  user: BaseUser | null;
}

const t = initTRPC.context<TRPCContext>().meta<OpenApiMeta>().create({
  transformer: superjson,
});

export const router = t.router;
export const createCallerFactory = t.createCallerFactory;
export const publicProcedure = t.procedure;

export const protectedProcedure = t.procedure.use(async ({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
      uid: ctx.user.id,
      role: (ctx.user.role as UserRole) || "cajero",
    },
  });
});

/** Middleware factory: only allows users with one of the specified roles */
export function withRole(...allowed: UserRole[]) {
  return protectedProcedure.use(async ({ ctx, next }) => {
    const role = ctx.role;
    if (!allowed.includes(role)) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: `Acceso restringido. Se requiere rol: ${allowed.join(" o ")}`,
      });
    }
    return next({ ctx });
  });
}

export const adminProcedure = withRole("admin");
export const almacenProcedure = withRole("admin", "almacen");
export const cajeroProcedure = withRole("admin", "cajero");

export type { OpenApiMeta };
