import "dotenv/config";
import { assertDatabaseTarget } from "./src/lib/database-safety.js";

assertDatabaseTarget(process.env.DATABASE_URL);

export default {
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env["DATABASE_URL"] ?? "",
  },
};
