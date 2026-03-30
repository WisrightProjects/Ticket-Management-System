import { execSync } from "child_process";
import path from "path";
import pg from "pg";

const serverDir = path.resolve(__dirname, "../server");
const testDbUrl = "postgresql://postgres:1234@localhost:5433/ticket_management_test";

async function globalSetup() {
  console.log("Setting up test database...");

  // Drop and recreate the public schema to ensure a clean state
  const pool = new pg.Pool({ connectionString: testDbUrl });
  await pool.query("DROP SCHEMA public CASCADE");
  await pool.query("CREATE SCHEMA public");
  await pool.end();

  // Run migrations on test database
  execSync("bunx prisma migrate deploy", {
    cwd: serverDir,
    env: { ...process.env, DATABASE_URL: testDbUrl },
    stdio: "inherit",
  });

  // Seed test database
  execSync("bun run prisma/seed.ts", {
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
