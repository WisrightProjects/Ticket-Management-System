import { PgBoss } from "pg-boss";

// Append keepAlives=true to the connection string so the pg driver sends
// TCP keepalive probes. Without it, the PostgreSQL server closes idle
// connections and pg-boss throws "Connection terminated unexpectedly".
const rawUrl = process.env.DATABASE_URL!;
const connectionString = rawUrl.includes("?")
  ? `${rawUrl}&keepAlives=true`
  : `${rawUrl}?keepAlives=true`;

const boss = new PgBoss({ connectionString });

export default boss;
