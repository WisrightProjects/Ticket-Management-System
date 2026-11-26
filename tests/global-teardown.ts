import pg from "pg";
import path from "path";
import dotenv from "dotenv";
import { assertDatabaseTarget } from "../server/src/lib/database-safety";

dotenv.config({ path: path.resolve(__dirname, "../server/.env") });

const testDbUrl =
  process.env.TEST_DATABASE_URL ??
  "postgresql://tms_user:tms_password@localhost:5433/ticket_management_test";

async function globalTeardown() {
  assertDatabaseTarget(testDbUrl);
  if (new URL(testDbUrl).pathname !== "/ticket_management_test") throw new Error("Test teardown may clean only ticket_management_test");
  console.log("Cleaning up test database...");

  const pool = new pg.Pool({ connectionString: testDbUrl });

  // Clean all data but keep the schema
  await pool.query(`
    DO $$ DECLARE
      r RECORD;
    BEGIN
      FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
        EXECUTE 'TRUNCATE TABLE ' || quote_ident(r.tablename) || ' CASCADE';
      END LOOP;
    END $$;
  `);

  await pool.end();
  console.log("Test database cleaned.");
}

export default globalTeardown;
