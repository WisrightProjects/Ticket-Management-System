export function assertDatabaseTarget(value: string | undefined): void {
  if (!value) throw new Error("DATABASE_URL is required");
  const url = new URL(value);
  if ((process.env.LOCAL_DEVELOPMENT_ONLY === "true" || process.env.NODE_ENV !== "production") && !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)) {
    throw new Error("Development and tests require a localhost database. Remote connections are blocked.");
  }
}
