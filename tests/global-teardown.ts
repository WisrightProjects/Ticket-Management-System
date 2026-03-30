import pg from "pg";

async function globalTeardown() {
  console.log("Cleaning up test database...");

  const pool = new pg.Pool({
    connectionString: "postgresql://postgres:1234@localhost:5433/ticket_management_test",
  });

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
