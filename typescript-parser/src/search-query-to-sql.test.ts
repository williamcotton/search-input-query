import { describe, expect, test } from "@jest/globals";
import { searchQueryToSql, searchStringToSql } from "./search-query-to-sql";
import { parseSearchQuery } from "./parser";
import type { SearchQuery, FieldSchema } from "./parser";

describe("Search Query to SQL Converter", () => {
  const searchableColumns = ["title", "description", "content"];
  const schemas: FieldSchema[] = [
    { name: "price", type: "number" },
    { name: "amount", type: "number" },
    { name: "date", type: "date" },
    { name: "title", type: "string" },
    { name: "color", type: "string" },
    { name: "status", type: "string" },
    { name: "category", type: "string" },
    { name: "available", type: "string" },
    { name: "field1", type: "string" },
    { name: "field2", type: "string" },
    { name: "user_id", type: "number" },
  ];

  const testSqlConversion = (
    query: string,
    expectedSql: string,
    expectedValues: any[]
  ) => {
    const parsedQuery = parseSearchQuery(
      query,
      schemas
    );
    // console.log(parsedQuery);
    expect(parsedQuery.type).toBe("SEARCH_QUERY");
    const result = searchQueryToSql(
      parsedQuery as SearchQuery,
      searchableColumns,
      schemas
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

  describe("NOT SQL Conversion", () => {
    test("converts simple NOT expressions", () => {
      testSqlConversion(
        "NOT test",
        "NOT (title ILIKE $1 OR description ILIKE $1 OR content ILIKE $1)",
        ["%test%"]
      );
    });

    test("converts NOT with field:value", () => {
      testSqlConversion("NOT status:active", "NOT (status ILIKE $1)", [
        "%active%",
      ]);
    });

    test("converts complex NOT expressions", () => {
      testSqlConversion(
        "boots AND NOT leather",
        "((title ILIKE $1 OR description ILIKE $1 OR content ILIKE $1) AND NOT (title ILIKE $2 OR description ILIKE $2 OR content ILIKE $2))",
        ["%boots%", "%leather%"]
      );

      testSqlConversion(
        "NOT (color:red OR color:blue)",
        "NOT (color ILIKE $1 OR color ILIKE $2)",
        ["%red%", "%blue%"]
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
      expect(() => searchStringToSql("AND", searchableColumns, schemas)).toThrow("Parse error");
      expect(() =>
        searchStringToSql("field:", searchableColumns, schemas)
      ).toThrow("Parse error");
    });

    test("throws error for invalid fields", () => {
      expect(() =>
        searchStringToSql("invalid_field:value", searchableColumns, schemas)
      ).toThrow('Parse error: Invalid field: "invalid_field"');
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

  describe("Range Query Conversion", () => {
    test("converts comparison operators for numbers", () => {
      testSqlConversion("price:>100", "price > $1", [100]);
      testSqlConversion("price:>=100", "price >= $1", [100]);
      testSqlConversion("price:<50", "price < $1", [50]);
      testSqlConversion("price:<=50", "price <= $1", [50]);
    });

    test("converts between ranges for numbers", () => {
      testSqlConversion("price:10..20", "price BETWEEN $1 AND $2", [10, 20]);
      testSqlConversion(
        "amount:50.99..100.50",
        "amount BETWEEN $1 AND $2",
        [50.99, 100.5]
      );
    });

    test("converts open-ended ranges for numbers", () => {
      testSqlConversion("price:10..", "price >= $1", [10]);
      testSqlConversion("price:..20", "price <= $1", [20]);
    });

    test("converts date ranges", () => {
      testSqlConversion("date:>2024-01-01", "date::date > $1::date", [
        "2024-01-01",
      ]);
      testSqlConversion(
        "date:2024-01-01..2024-12-31",
        "date::date BETWEEN $1::date AND $2::date",
        ["2024-01-01", "2024-12-31"]
      );
    });

    test("converts complex expressions with ranges", () => {
      testSqlConversion(
        "price:>100 AND amount:<50",
        "(price > $1 AND amount < $2)",
        [100, 50]
      );
      testSqlConversion(
        "price:10..20 OR amount:>=100",
        "(price BETWEEN $1 AND $2 OR amount >= $3)",
        [10, 20, 100]
      );
      testSqlConversion(
        "(price:>100 AND amount:<50) OR date:>=2024-01-01",
        "((price > $1 AND amount < $2) OR date::date >= $3::date)",
        [100, 50, "2024-01-01"]
      );
    });

    test("mixes ranges with regular field searches", () => {
      testSqlConversion(
        'title:"winter boots" AND price:10..20',
        "(title ILIKE $1 AND price BETWEEN $2 AND $3)",
        ["%winter boots%", 10, 20]
      );
    });

    test("handles multiple date ranges in one query", () => {
      testSqlConversion(
        "date:>=2024-01-01 AND date:<=2024-12-31",
        "(date::date >= $1::date AND date::date <= $2::date)",
        ["2024-01-01", "2024-12-31"]
      );
    });

    test("handles decimal numbers in ranges", () => {
      testSqlConversion(
        "price:10.5..20.99",
        "price BETWEEN $1 AND $2",
        [10.5, 20.99]
      );
    });

    test("preserves numeric precision", () => {
      testSqlConversion("price:>=99.99", "price >= $1", [99.99]);
    });

    test("handles negative numbers in ranges", () => {
      testSqlConversion(
        "amount:-10..10",
        "amount BETWEEN $1 AND $2",
        [-10, 10]
      );
      testSqlConversion("amount:<-10", "amount < $1", [-10]);
    });
  });
});
