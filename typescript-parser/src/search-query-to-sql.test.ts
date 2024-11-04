import { describe, expect, test } from "@jest/globals";
import { searchQueryToSql, searchStringToSql } from "./search-query-to-sql";
import { parseSearchQuery } from "./parser";
import type { SearchQuery } from "./parser";

describe("Search Query to SQL Converter", () => {
  const searchableColumns = ["title", "description", "content"];

  const testSqlConversion = (
    query: string,
    expectedSql: string,
    expectedValues: any[]
  ) => {
    const parsedQuery = parseSearchQuery(query);
    expect(parsedQuery.type).toBe("SEARCH_QUERY");
    const result = searchQueryToSql(
      parsedQuery as SearchQuery,
      searchableColumns
    );
    expect(result.text).toBe(expectedSql);
    expect(result.values).toEqual(expectedValues);
  };

  describe("Basic Term Conversion", () => {
    test("converts single search term", () => {
      testSqlConversion(
        "boots",
        "(title ILIKE $1 OR description ILIKE $1 OR content ILIKE $1)",
        ["%boots%"]
      );
    });

    test("converts quoted search term", () => {
      testSqlConversion(
        '"red shoes"',
        "(title ILIKE $1 OR description ILIKE $1 OR content ILIKE $1)",
        ["%red shoes%"]
      );
    });

    test("escapes special characters in search terms", () => {
      testSqlConversion(
        "100%",
        "(title ILIKE $1 OR description ILIKE $1 OR content ILIKE $1)",
        ["%100\\%%"]
      );

      testSqlConversion(
        "under_score",
        "(title ILIKE $1 OR description ILIKE $1 OR content ILIKE $1)",
        ["%under\\_score%"]
      );
    });
  });

  describe("Field Value Conversion", () => {
    test("converts simple field:value pairs", () => {
      testSqlConversion("color:red", "color ILIKE $1", ["%red%"]);
    });

    test("converts field values with spaces", () => {
      testSqlConversion('status:"in progress"', "status ILIKE $1", [
        "%in progress%",
      ]);
    });

    test("handles special date fields", () => {
      testSqlConversion("date:2024-01-01", "date::date = $1::date", [
        "2024-01-01",
      ]);
    });

    test("handles ID fields", () => {
      testSqlConversion("user_id:123", "user_id = $1", ["123"]);
    });

    test("escapes special characters in field values", () => {
      testSqlConversion("category:100%", "category ILIKE $1", ["%100\\%%"]);
    });
  });

  describe("Logical Operators", () => {
    test("converts AND expressions", () => {
      testSqlConversion(
        "comfortable AND leather",
        "((title ILIKE $1 OR description ILIKE $1 OR content ILIKE $1) AND (title ILIKE $2 OR description ILIKE $2 OR content ILIKE $2))",
        ["%comfortable%", "%leather%"]
      );
    });

    test("converts OR expressions", () => {
      testSqlConversion(
        "leather OR suede",
        "((title ILIKE $1 OR description ILIKE $1 OR content ILIKE $1) OR (title ILIKE $2 OR description ILIKE $2 OR content ILIKE $2))",
        ["%leather%", "%suede%"]
      );
    });

    test("converts mixed operators", () => {
      testSqlConversion(
        "comfortable AND (leather OR suede)",
        "((title ILIKE $1 OR description ILIKE $1 OR content ILIKE $1) AND ((title ILIKE $2 OR description ILIKE $2 OR content ILIKE $2) OR (title ILIKE $3 OR description ILIKE $3 OR content ILIKE $3)))",
        ["%comfortable%", "%leather%", "%suede%"]
      );
    });
  });

  describe("Complex Queries", () => {
    test("converts complex field and term combinations", () => {
      testSqlConversion(
        'category:"winter boots" AND (color:black OR color:brown)',
        "(category ILIKE $1 AND (color ILIKE $2 OR color ILIKE $3))",
        ["%winter boots%", "%black%", "%brown%"]
      );
    });

    test("converts nested expressions with multiple operators", () => {
      testSqlConversion(
        '(color:red OR color:blue) AND category:"winter boots" AND available:true',
        "(((color ILIKE $1 OR color ILIKE $2) AND category ILIKE $3) AND available ILIKE $4)",
        ["%red%", "%blue%", "%winter boots%", "%true%"]
      );
    });

    test("handles mixed fields and search terms", () => {
      testSqlConversion(
        'boots AND color:black AND "winter gear"',
        "(((title ILIKE $1 OR description ILIKE $1 OR content ILIKE $1) AND color ILIKE $2) AND (title ILIKE $3 OR description ILIKE $3 OR content ILIKE $3))",
        ["%boots%", "%black%", "%winter gear%"]
      );
    });
  });

  describe("Edge Cases", () => {
    test("handles empty query", () => {
      const result = searchQueryToSql(
        { type: "SEARCH_QUERY", expression: null },
        searchableColumns
      );
      expect(result.text).toBe("1=1");
      expect(result.values).toEqual([]);
    });

    test("throws error for invalid query syntax", () => {
      expect(() => searchStringToSql("AND")).toThrow("Parse error");
      expect(() => searchStringToSql("field:")).toThrow("Parse error");
    });

    test("throws error for invalid fields", () => {
      expect(() => searchStringToSql("invalid_field:value")).toThrow(
        "Invalid query"
      );
    });
  });

  describe("Parameter Counting", () => {
    test("maintains correct parameter count in complex queries", () => {
      testSqlConversion(
        'term1 AND field1:value1 OR (term2 AND field2:"value 2")',
        "(((title ILIKE $1 OR description ILIKE $1 OR content ILIKE $1) AND field1 ILIKE $2) OR ((title ILIKE $3 OR description ILIKE $3 OR content ILIKE $3) AND field2 ILIKE $4))",
        ["%term1%", "%value1%", "%term2%", "%value 2%"]
      );
    });
  });

  describe("Special Character Handling", () => {
    test("escapes SQL wildcards", () => {
      testSqlConversion(
        "prefix% AND suffix_",
        "((title ILIKE $1 OR description ILIKE $1 OR content ILIKE $1) AND (title ILIKE $2 OR description ILIKE $2 OR content ILIKE $2))",
        ["%prefix\\%%", "%suffix\\_%"]
      );
    });

    test("handles quoted strings with escaped characters", () => {
      testSqlConversion(
        '"value\\"with\\"quotes"',
        "(title ILIKE $1 OR description ILIKE $1 OR content ILIKE $1)",
        ['%value"with"quotes%']
      );
    });
  });
});
