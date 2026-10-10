import { betterAuth } from "better-auth";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";

type DrizzleDb = Parameters<typeof drizzleAdapter>[0];

interface AuthOptions {
  db: DrizzleDb;
  baseURL?: string;
  trustedOrigins?: string[];
}

/**
 * El registro público está deshabilitado: el endpoint HTTP /sign-up/email
 * responde 403. Los usuarios los crea un administrador desde /signup
 * (llamada del lado del servidor). Para reactivar el registro público
 * (solo desarrollo local) define ALLOW_PUBLIC_SIGNUP=true.
 */
const allowPublicSignup = process.env.ALLOW_PUBLIC_SIGNUP === "true";

export function createAuth({ db, baseURL, trustedOrigins }: AuthOptions) {
  return betterAuth({
    baseURL,
    database: drizzleAdapter(db, { provider: "pg" }),
    // autoSignIn=false: crear un usuario no abre sesión como ese usuario
    // (el admin que lo crea conserva su propia sesión).
    emailAndPassword: { enabled: true, autoSignIn: false },
    trustedOrigins,
    hooks: {
      before: createAuthMiddleware(async (ctx) => {
        // ctx.request solo existe cuando la llamada llega por HTTP;
        // las llamadas internas (auth.api.signUpEmail en el servidor) no lo traen.
        if (ctx.path === "/sign-up/email" && ctx.request && !allowPublicSignup) {
          throw new APIError("FORBIDDEN", {
            message: "Public sign-up is disabled",
          });
        }
      }),
    },
    plugins: [nextCookies()],
  });
}

export type Auth = ReturnType<typeof createAuth>;
