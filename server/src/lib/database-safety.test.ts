import { describe, expect, test } from "bun:test";
import { assertDatabaseTarget } from "./database-safety";

describe("local database isolation", () => {
  test("rejects remote database hosts before opening connections", () => {
    expect(() => assertDatabaseTarget("postgresql://user:password@192.0.2.1:5432/live")).toThrow(/localhost/);
    expect(() => assertDatabaseTarget("postgresql://user:password@127.0.0.1:5433/local")).not.toThrow();
    expect(() => assertDatabaseTarget(undefined)).toThrow(/required/);
  });
});
