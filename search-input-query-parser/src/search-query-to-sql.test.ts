import { describe, expect, test } from "@jest/globals";
import { searchQueryToIlikeSql, searchStringToIlikeSql } from "./search-query-to-ilike-sql";
import { searchQueryToTsVectorSql } from "./search-query-to-tsvector-sql";
import { searchQueryToParadeDbSql } from "./search-query-to-paradedb-sql";
import { parseSearchInputQuery } from "./parser";
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

  const testIlikeConversion = (
    query: string,
    expectedSql: string,
    expectedValues: any[]
  ) => {
    const parsedQuery = parseSearchInputQuery(query, schemas);
    expect(parsedQuery.type).toBe("SEARCH_QUERY");
    const result = searchQueryToIlikeSql(
      parsedQuery as SearchQuery,
      searchableColumns,
      schemas
    );
    expect(result.text).toBe(expectedSql);
    expect(result.values).toEqual(expectedValues);
  };

  describe("Basic Term Conversion", () => {
    test("converts single search term", () => {
      testIlikeConversion(
        "boots",
        "(lower(title) LIKE lower($1) OR lower(description) LIKE lower($1) OR lower(content) LIKE lower($1))",
        ["%boots%"]
      );
    });

    test("converts quoted search term", () => {
      testIlikeConversion(
        '"red shoes"',
        "(lower(title) LIKE lower($1) OR lower(description) LIKE lower($1) OR lower(content) LIKE lower($1))",
        ["%red shoes%"]
      );
    });

    test("escapes special characters in search terms", () => {
      // testIlikeConversion(
      //   "100%",
      //   "(lower(title) LIKE lower($1) OR lower(description) LIKE lower($1) OR lower(content) LIKE lower($1))",
      //   ["%100\\%%"]
      // );

      testIlikeConversion(
        "under_score",
        "(lower(title) LIKE lower($1) OR lower(description) LIKE lower($1) OR lower(content) LIKE lower($1))",
        ["%under\\_score%"]
      );
    });
  });

  describe("Field Value Conversion", () => {
    test("converts simple field:value pairs", () => {
      // testIlikeConversion("color:red", "lower(color) LIKE lower($1)", ["%red%"]);
    });

    test("converts field values with spaces", () => {
      testIlikeConversion('status:"in progress"', "lower(status) LIKE lower($1)", [
        "%in progress%",
      ]);
    });

    test("handles special date fields", () => {
      testIlikeConversion("date:2024-01-01", "date = $1", [
        "2024-01-01",
      ]);
    });

    test("handles ID fields", () => {
      testIlikeConversion("user_id:123", "user_id = $1", [123]);
    });

    test("escapes special characters in field values", () => {
      testIlikeConversion("category:100%", "lower(category) LIKE lower($1)", [
        "%100\\%%",
      ]);
    });
  });

  describe("Logical Operators", () => {
    test("converts AND expressions", () => {
      testIlikeConversion(
        "comfortable AND leather",
        "((lower(title) LIKE lower($1) OR lower(description) LIKE lower($1) OR lower(content) LIKE lower($1)) AND (lower(title) LIKE lower($2) OR lower(description) LIKE lower($2) OR lower(content) LIKE lower($2)))",
        ["%comfortable%", "%leather%"]
      );
    });

    test("converts OR expressions", () => {
      testIlikeConversion(
        "leather OR suede",
        "((lower(title) LIKE lower($1) OR lower(description) LIKE lower($1) OR lower(content) LIKE lower($1)) OR (lower(title) LIKE lower($2) OR lower(description) LIKE lower($2) OR lower(content) LIKE lower($2)))",
        ["%leather%", "%suede%"]
      );
    });

    test("converts mixed operators", () => {
      testIlikeConversion(
        "comfortable AND (leather OR suede)",
        "((lower(title) LIKE lower($1) OR lower(description) LIKE lower($1) OR lower(content) LIKE lower($1)) AND ((lower(title) LIKE lower($2) OR lower(description) LIKE lower($2) OR lower(content) LIKE lower($2)) OR (lower(title) LIKE lower($3) OR lower(description) LIKE lower($3) OR lower(content) LIKE lower($3))))",
        ["%comfortable%", "%leather%", "%suede%"]
      );
    });
  });

  describe("NOT SQL Conversion", () => {
    test("converts simple NOT expressions", () => {
      testIlikeConversion(
        "NOT test",
        "NOT (lower(title) LIKE lower($1) OR lower(description) LIKE lower($1) OR lower(content) LIKE lower($1))",
        ["%test%"]
      );
    });

    test("converts NOT with field:value", () => {
      testIlikeConversion("NOT status:active", "NOT lower(status) LIKE lower($1)", [
        "%active%",
      ]);
    });

    test("converts complex NOT expressions", () => {
      testIlikeConversion(
        "boots AND NOT leather",
        "((lower(title) LIKE lower($1) OR lower(description) LIKE lower($1) OR lower(content) LIKE lower($1)) AND NOT (lower(title) LIKE lower($2) OR lower(description) LIKE lower($2) OR lower(content) LIKE lower($2)))",
        ["%boots%", "%leather%"]
      );

      testIlikeConversion(
        "NOT (color:red OR color:blue)",
        "NOT (lower(color) LIKE lower($1) OR lower(color) LIKE lower($2))",
        ["%red%", "%blue%"]
      );
    });
  });

  describe("Complex Queries", () => {
    test("converts complex field and term combinations", () => {
      testIlikeConversion(
        'category:"winter boots" AND (color:black OR color:brown)',
        "(lower(category) LIKE lower($1) AND (lower(color) LIKE lower($2) OR lower(color) LIKE lower($3)))",
        ["%winter boots%", "%black%", "%brown%"]
      );
    });

    test("converts nested expressions with multiple operators", () => {
      testIlikeConversion(
        '(color:red OR color:blue) AND category:"winter boots" AND available:true',
        "(((lower(color) LIKE lower($1) OR lower(color) LIKE lower($2)) AND lower(category) LIKE lower($3)) AND lower(available) LIKE lower($4))",
        ["%red%", "%blue%", "%winter boots%", "%true%"]
      );
    });

    test("handles mixed fields and search terms", () => {
      testIlikeConversion(
        'boots AND color:black AND "winter gear"',
        "(((lower(title) LIKE lower($1) OR lower(description) LIKE lower($1) OR lower(content) LIKE lower($1)) AND lower(color) LIKE lower($2)) AND (lower(title) LIKE lower($3) OR lower(description) LIKE lower($3) OR lower(content) LIKE lower($3)))",
        ["%boots%", "%black%", "%winter gear%"]
      );
    });
  });

  describe("Edge Cases", () => {
    test("handles empty query", () => {
      const result = searchQueryToIlikeSql(
        { type: "SEARCH_QUERY", expression: null },
        searchableColumns
      );
      expect(result.text).toBe("1=1");
      expect(result.values).toEqual([]);
    });

    test("throws error for invalid query syntax", () => {
      expect(() =>
        searchStringToIlikeSql("AND", searchableColumns, schemas)
      ).toThrow("Parse error");
      expect(() =>
        searchStringToIlikeSql("field:", searchableColumns, schemas)
      ).toThrow("Parse error");
    });

    test("throws error for invalid fields", () => {
      expect(() =>
        searchStringToIlikeSql("invalid_field:value", searchableColumns, schemas)
      ).toThrow('Parse error: Invalid field: "invalid_field"');
    });
  });

  describe("Parameter Counting", () => {
    test("maintains correct parameter count in complex queries", () => {
      testIlikeConversion(
        'term1 AND field1:value1 OR (term2 AND field2:"value 2")',
        "(((lower(title) LIKE lower($1) OR lower(description) LIKE lower($1) OR lower(content) LIKE lower($1)) AND lower(field1) LIKE lower($2)) OR ((lower(title) LIKE lower($3) OR lower(description) LIKE lower($3) OR lower(content) LIKE lower($3)) AND lower(field2) LIKE lower($4)))",
        ["%term1%", "%value1%", "%term2%", "%value 2%"]
      );
    });
  });

  describe("Special Character Handling", () => {
    test("escapes SQL wildcards", () => {
      testIlikeConversion(
        "prefix% AND suffix_",
        "((lower(title) LIKE lower($1) OR lower(description) LIKE lower($1) OR lower(content) LIKE lower($1)) AND (lower(title) LIKE lower($2) OR lower(description) LIKE lower($2) OR lower(content) LIKE lower($2)))",
        ["%prefix\\%%", "%suffix\\_%"]
      );
    });

    test("handles quoted strings with escaped characters", () => {
      testIlikeConversion(
        '"value\\"with\\"quotes"',
        "(lower(title) LIKE lower($1) OR lower(description) LIKE lower($1) OR lower(content) LIKE lower($1))",
        ['%value"with"quotes%']
      );
    });
  });

  describe("Range Query Conversion", () => {
    test("converts comparison operators for numbers", () => {
      testIlikeConversion("price:>100", "price > $1", [100]);
      testIlikeConversion("price:>=100", "price >= $1", [100]);
      testIlikeConversion("price:<50", "price < $1", [50]);
      testIlikeConversion("price:<=50", "price <= $1", [50]);
    });

    test("converts between ranges for numbers", () => {
      testIlikeConversion("price:10..20", "price BETWEEN $1 AND $2", [10, 20]);
      testIlikeConversion(
        "amount:50.99..100.50",
        "amount BETWEEN $1 AND $2",
        [50.99, 100.5]
      );
    });

    test("converts open-ended ranges for numbers", () => {
      testIlikeConversion("price:10..", "price >= $1", [10]);
      testIlikeConversion("price:..20", "price <= $1", [20]);
    });

    test("converts date ranges", () => {
      testIlikeConversion("date:>2024-01-01", "date > $1", [
        "2024-01-01",
      ]);
      testIlikeConversion(
        "date:2024-01-01..2024-12-31",
        "date BETWEEN $1 AND $2",
        ["2024-01-01", "2024-12-31"]
      );
    });

    test("converts complex expressions with ranges", () => {
      testIlikeConversion(
        "price:>100 AND amount:<50",
        "(price > $1 AND amount < $2)",
        [100, 50]
      );
      testIlikeConversion(
        "price:10..20 OR amount:>=100",
        "(price BETWEEN $1 AND $2 OR amount >= $3)",
        [10, 20, 100]
      );
      testIlikeConversion(
        "(price:>100 AND amount:<50) OR date:>=2024-01-01",
        "((price > $1 AND amount < $2) OR date >= $3)",
        [100, 50, "2024-01-01"]
      );
    });

    test("mixes ranges with regular field searches", () => {
      testIlikeConversion(
        'title:"winter boots" AND price:10..20',
        "(lower(title) LIKE lower($1) AND price BETWEEN $2 AND $3)",
        ["%winter boots%", 10, 20]
      );
    });

    test("handles multiple date ranges in one query", () => {
      testIlikeConversion(
        "date:>=2024-01-01 AND date:<=2024-12-31",
        "(date >= $1 AND date <= $2)",
        ["2024-01-01", "2024-12-31"]
      );
    });

    test("handles decimal numbers in ranges", () => {
      testIlikeConversion(
        "price:10.5..20.99",
        "price BETWEEN $1 AND $2",
        [10.5, 20.99]
      );
    });

    test("preserves numeric precision", () => {
      testIlikeConversion("price:>=99.99", "price >= $1", [99.99]);
    });

    test("handles negative numbers in ranges", () => {
      testIlikeConversion(
        "amount:-10..10",
        "amount BETWEEN $1 AND $2",
        [-10, 10]
      );
      testIlikeConversion("amount:<-10", "amount < $1", [-10]);
    });
  });

  describe("tsvector Search Type", () => {
    const testTsvectorConversion = (
      query: string,
      expectedSql: string,
      expectedValues: any[]
    ) => {
      const parsedQuery = parseSearchInputQuery(query, schemas);
      expect(parsedQuery.type).toBe("SEARCH_QUERY");
      const result = searchQueryToTsVectorSql(
        parsedQuery as SearchQuery,
        searchableColumns,
        schemas,
        {
          language: "english",
        }
      );
      expect(result.text).toBe(expectedSql);
      expect(result.values).toEqual(expectedValues);
    };

    test("converts single search term", () => {
      testTsvectorConversion(
        "boots",
        "(to_tsvector('english', title) || to_tsvector('english', description) || to_tsvector('english', content)) @@ plainto_tsquery('english', $1)",
        ["boots"]
      );
    });

    test("converts field:value pairs", () => {
      testTsvectorConversion(
        "title:boots",
        "to_tsvector('english', title) @@ plainto_tsquery('english', $1)",
        ["boots"]
      );
    });

    test("converts wildcards to prefix matching", () => {
      testTsvectorConversion(
        "boots*",
        "(to_tsvector('english', title) || to_tsvector('english', description) || to_tsvector('english', content)) @@ to_tsquery('english', $1)",
        ["boots:*"]
      );
    });

    test("handles complex AND/OR expressions", () => {
      testTsvectorConversion(
        'boots AND "winter gear"',
        "((to_tsvector('english', title) || to_tsvector('english', description) || to_tsvector('english', content)) @@ plainto_tsquery('english', $1) AND (to_tsvector('english', title) || to_tsvector('english', description) || to_tsvector('english', content)) @@ plainto_tsquery('english', $2))",
        ["boots", "winter gear"]
      );
    });
  });

  describe("paradedb Search Type", () => {
    const testParadeDBConversion = (
      query: string,
      expectedSql: string,
      expectedValues: any[]
    ) => {
      const parsedQuery = parseSearchInputQuery(query, schemas);
      expect(parsedQuery.type).toBe("SEARCH_QUERY");
      const result = searchQueryToParadeDbSql(
        parsedQuery as SearchQuery,
        searchableColumns,
        schemas
      );
      expect(result.text).toBe(expectedSql);
      expect(result.values).toEqual(expectedValues);
    };

    test("converts single search term", () => {
      testParadeDBConversion(
        "boots",
        "(title @@@ $1 OR description @@@ $1 OR content @@@ $1)",
        ['"boots"']
      );
    });

    test("handles numeric ranges", () => {
      testParadeDBConversion(
        "price:10..20",
        "price @@@ '[' || $1 || ' TO ' || $2 || ']'",
        [10, 20]
      );

      testParadeDBConversion("price:>100", "price @@@ '>' || $1", [100]);
    });

    test("handles wildcards", () => {
      testParadeDBConversion(
        "boots*",
        "(title @@@ $1 OR description @@@ $1 OR content @@@ $1)",
        ['"boots"*']
      );
    });

    test("handles complex expressions", () => {
      testParadeDBConversion(
        'title:"winter boots" AND price:>100',
        "(title @@@ $1 AND price @@@ '>' || $2)",
        ['"winter boots"', 100]
      );
    });
    
    test("handles simple quoted strings", () => {
      testParadeDBConversion(
        '"test phrase"',
        "(title @@@ $1 OR description @@@ $1 OR content @@@ $1)",
        ['"test phrase"']
      );
    });

    test("handles quoted strings with wildcards", () => {
      testParadeDBConversion(
        '"test phrase*"',
        "(title @@@ $1 OR description @@@ $1 OR content @@@ $1)",
        ['"test phrase\\*\"']
      );

      testParadeDBConversion(
        '"test phrase"*',
        "(title @@@ $1 OR description @@@ $1 OR content @@@ $1)",
        ['"test phrase"*']
      );
    });

    test("handles field values with quoted strings", () => {
      testParadeDBConversion('title:"test phrase"', "title @@@ $1", [
        '"test phrase"',
      ]);

      testParadeDBConversion('title:"test phrase*"', "title @@@ $1", [
        '"test phrase"*',
      ]);
    });

    test("handles mixed quoted and unquoted terms", () => {
      testParadeDBConversion(
        'title:test title:"test and test" "test and test"',
        "((title @@@ $1 AND title @@@ $2) AND (title @@@ $3 OR description @@@ $3 OR content @@@ $3))",
        ['"test"', '"test and test"', '"test and test"']
      );
    });

    test("handles IN expressions with quoted strings", () => {
      testParadeDBConversion(
        'status:IN("test one", "test two")',
        "status @@@ 'IN[' || $1 || ' ' || $2 || ']'",
        ["test one", "test two"]
      );
    });

    test("handles numeric fields with quoted strings", () => {
      testParadeDBConversion(
        'price:>100 AND title:"expensive items"',
        "(price @@@ '>' || $1 AND title @@@ $2)",
        [100, '"expensive items"']
      );
    });

    test("handles dates with quoted strings", () => {
      testParadeDBConversion(
        'date:2024-01-01 AND title:"new items"',
        "(date @@@ '\"' || $1 || '\"' AND title @@@ $2)",
        ["2024-01-01", '"new items"']
      );
    });

    test("handles complex query with multiple field types", () => {
      testParadeDBConversion(
        'title:"test*" AND price:>100 AND status:IN("active", "pending")',
        "((title @@@ $1 AND price @@@ '>' || $2) AND status @@@ 'IN[' || $3 || ' ' || $4 || ']')",
        ['"test"*', 100, "active", "pending"]
      );
    });
  });
});
