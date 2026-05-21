import { execSync } from "child_process";
import path from "path";
import pg from "pg";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(__dirname, "../server/.env") });

const serverDir = path.resolve(__dirname, "../server");
const testDbUrl =
  process.env.TEST_DATABASE_URL ??
  "postgresql://tms_user:tms_password@localhost:5433/ticket_management_test";

// Derive the admin DB URL (same host/credentials, connect to main DB to create test DB)
const adminDbUrl = testDbUrl.replace(/\/[^/]*$/, "/ticket_management");

// Resolve the bun executable at runtime so it works in git hook contexts where
// shell aliases like "bunx" are not available (cmd.exe doesn't know "bunx").
function resolveBun(): string {
  try {
    const cmd = process.platform === "win32" ? "where bun" : "which bun";
    const result = execSync(cmd, { encoding: "utf8", stdio: "pipe" });
    return result.split("\n")[0].trim();
  } catch {
    return "bun";
  }
}
const BUN = resolveBun();

async function globalSetup() {
  console.log("Setting up test database...");

  // Ensure the test database exists (create it if missing)
  const adminPool = new pg.Pool({ connectionString: adminDbUrl });
  try {
    await adminPool.query("CREATE DATABASE ticket_management_test");
    console.log("Created test database.");
  } catch (err: any) {
    if (err.code !== "42P04") throw err; // 42P04 = duplicate_database (already exists)
  } finally {
    await adminPool.end();
  }

  // Drop and recreate the public schema for a clean slate
  const pool = new pg.Pool({ connectionString: testDbUrl });
  await pool.query("DROP SCHEMA public CASCADE");
  await pool.query("CREATE SCHEMA public");
  await pool.end();

  // Run migrations on test database
  execSync(`"${BUN}" x prisma migrate deploy`, {
    cwd: serverDir,
    env: { ...process.env, DATABASE_URL: testDbUrl },
    stdio: "inherit",
  });

  // Seed test database
  execSync(`"${BUN}" run prisma/seed.ts`, {
    cwd: serverDir,
    env: {
      ...process.env,
      DATABASE_URL: testDbUrl,
      ADMIN_EMAIL: "admin@wisright.com",
      ADMIN_PASSWORD: "Test@123",
    },
    stdio: "inherit",
  });

  console.log("Test database ready.");
}

export default globalSetup;
