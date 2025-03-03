import { describe, expect, test } from "@jest/globals";
import { searchStringToParadeDbSql } from "./search-query-to-paradedb-sql";
import { FieldSchema } from "./parser";

describe("ParadeDB SQL Converter", () => {
  const schemas: FieldSchema[] = [
    { name: "title", type: "string" },
    { name: "description", type: "string" },
    { name: "content", type: "string" },
    { name: "price", type: "number" },
    { name: "date", type: "date" },
    { name: "in_stock", type: "boolean" },
  ];

  const searchableColumns = ["title", "description", "content"];

  const testParadeDBConversion = (
    query: string,
    expectedSql: string,
    expectedValues: any[]
  ) => {
    const result = searchStringToParadeDbSql(
      query,
      searchableColumns,
      schemas
    );
    expect(result.text).toBe(expectedSql);
    expect(result.values).toEqual(expectedValues);
  };

  describe("ParadeDB Date Handling", () => {
    test("handles date year shorthand format", () => {
      testParadeDBConversion(
        "date:2024",
        "date @@@ '[' || $1 || ' TO ' || $2 || ']'",
        ["2024-01-01", "2024-12-31"]
      );
    });

    test("handles date month shorthand format", () => {
      testParadeDBConversion(
        "date:2024-02",
        "date @@@ '[' || $1 || ' TO ' || $2 || ']'",
        ["2024-02-01", "2024-02-29"] // 2024 is a leap year
      );
      
      testParadeDBConversion(
        "date:2023-04",
        "date @@@ '[' || $1 || ' TO ' || $2 || ']'",
        ["2023-04-01", "2023-04-30"]
      );
    });

    test("handles date shorthand formats with comparison operators", () => {
      testParadeDBConversion(
        "date:>=2024 AND date:<2025",
        "(date @@@ '>=' || $1 AND date @@@ '<' || $2)",
        ["2024-01-01", "2025-12-31"]
      );
    });
  });
}); 