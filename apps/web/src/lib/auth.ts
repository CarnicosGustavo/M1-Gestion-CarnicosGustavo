import { createAuth } from "@finopenpos/auth";
import { serverUrls } from "@finopenpos/env/server";
import { db } from "./db";
import { sendPasswordResetEmail } from "./email";

export const auth = createAuth({
	db: db as any,
	baseURL: serverUrls.betterAuthUrl,
	sendResetPassword: ({ user, url }) => sendPasswordResetEmail(user, url),
});
