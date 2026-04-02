export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // Only seed if explicitly requested via environment variable
    // This prevents timeouts during login/startup in production
    if (process.env.RUN_SEED === "true") {
      const { seed } = await import("@/lib/db/seed");
      await seed();
    }
  }
}
