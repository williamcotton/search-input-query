import { describe, expect, test } from "@jest/globals";

import {
  parseSearchInputQuery,
  type SearchQuery,
  type SearchQueryError,
  stringify,
  ValidationError,
  FieldSchema,
} from "./parser";

describe("Search Query Parser", () => {
  const testValidQuery = (input: string, expected: string) => {
    const result = parseSearchInputQuery(input);
    expect(result.type).toBe("SEARCH_QUERY");
    const query = result as SearchQuery;
    expect(query.expression).toBeTruthy();
    if (query.expression) {
      expect(stringify(query.expression)).toBe(expected);
    }
  };

  const testErrorQuery = (input: string, expectedError: ValidationError[]) => {
    const result = parseSearchInputQuery(input);
    expect(result.type).toBe("SEARCH_QUERY_ERROR");
    const error = result as SearchQueryError;
    expect(error.errors).toStrictEqual(expectedError);
  };

  const schemas: FieldSchema[] = [
    { name: "price", type: "number" },
    { name: "amount", type: "number" },
    { name: "date", type: "date" },
    { name: "title", type: "string" },
  ];

  const testSchemaQuery = (input: string, expected: string) => {
    const result = parseSearchInputQuery(
      input,
      schemas
    );
    expect(result.type).toBe("SEARCH_QUERY");
    const query = result as SearchQuery;
    expect(query.expression).toBeTruthy();
    if (query.expression) {
      expect(stringify(query.expression)).toBe(expected);
    }
  };

  const testSchemaErrorQuery = (input: string, expectedError: ValidationError[]) => {
    const result = parseSearchInputQuery(input, schemas);
    expect(result.type).toBe("SEARCH_QUERY_ERROR");
    const error = result as SearchQueryError;
    expect(error.errors).toStrictEqual(expectedError);
  }

  describe("Basic Term Parsing", () => {
    test("parses single terms", () => {
      testValidQuery("boots", "boots");
      testValidQuery('"red shoes"', '"red shoes"');
      testValidQuery("simple-term", "simple-term");
      testValidQuery("term_with_underscore", "term_with_underscore");
      testValidQuery("term123", "term123");
    });

    test("parses multiple terms with implicit AND", () => {
      testValidQuery("boots summer", "(boots AND summer)");
      testValidQuery("red boots black", "((red AND boots) AND black)");
      testValidQuery("a b c d", "(((a AND b) AND c) AND d)");
      testValidQuery(
        '"quoted term" normal_term',
        '("quoted term" AND normal_term)'
      );
    });

    test("handles terms with special characters", () => {
      testValidQuery('"term with-dash"', '"term with-dash"');
      testValidQuery('"term with_underscore"', '"term with_underscore"');
      testValidQuery('"term with.period"', '"term with.period"');
      testValidQuery('"term with@symbol"', '"term with@symbol"');
    });
  });

  describe("Field Value Parsing", () => {
    test("parses simple field:value pairs", () => {
      testValidQuery("color:red", "color:red");
      testValidQuery("size:large", "size:large");
      testValidQuery("price:100", "price:100");
      testValidQuery("date:2024-01-01", "date:2024-01-01");
    });

    test("parses field values with spaces", () => {
      testValidQuery('status:"pending review"', "status:pending review");
      testValidQuery('category:"winter boots"', "category:winter boots");
      testValidQuery(
        'description:"very long product description"',
        "description:very long product description"
      );
    });

    test("handles various field:value spacing", () => {
      testErrorQuery("field: value", [
        {
          length: 6,
          message: "Expected field value",
          position: 0,
        },
      ]);
      // testValidQuery("field :value", "field:value");
      testErrorQuery("field: value", [
        {
          length: 6,
          message: "Expected field value",
          position: 0,
        },
      ]);
      // testValidQuery("field : value", "field:value");
      testErrorQuery("field : value", [
        {
          length: 1,
          message: "Expected field value",
          position: 6,
        },
      ]);
      testValidQuery('field:"quoted value"', "field:quoted value");
      // testValidQuery('field: "quoted value"', "field:quoted value");
      testErrorQuery('field: "quoted value"', [
        {
          length: 6,
          message: "Expected field value",
          position: 0,
        },
      ]);
      // testValidQuery('field :"quoted value"', "field:quoted value");
      testErrorQuery('field :"quoted value"', [
        {
          length: 15,
          message: "Missing field name",
          position: 6,
        },
      ]);
    });

    test("handles special characters in field values", () => {
      testValidQuery('brand:"Nike\\Air"', "brand:NikeAir");
      testValidQuery('brand:"Nike\\"Air"', 'brand:Nike"Air');
      testValidQuery('path:"C:\\\\Program Files"', "path:C:\\Program Files");
      testValidQuery(
        'query:"SELECT * FROM table"',
        "query:SELECT * FROM table"
      );
    });

    test("handles fields with numbers and special characters", () => {
      testValidQuery("field2:value", "field2:value");
      testValidQuery("field_name:value", "field_name:value");
      testValidQuery("field-name:value", "field-name:value");
    });

    test("handles reserved words as identifiers", () => {
      testValidQuery("field:AND", "field:AND");
      testValidQuery("field:OR", "field:OR");
    });
  });

  describe("Logical Operators", () => {
    test("parses AND operator", () => {
      testValidQuery("comfortable AND leather", "(comfortable AND leather)");
      testValidQuery("color:red AND size:large", "(color:red AND size:large)");
      testValidQuery("a AND b AND c", "((a AND b) AND c)");
      testValidQuery(
        '"term one" AND "term two"',
        '("term one" AND "term two")'
      );
    });

    test("parses OR operator", () => {
      testValidQuery("leather OR suede", "(leather OR suede)");
      testValidQuery(
        "color:black OR color:brown",
        "(color:black OR color:brown)"
      );
      testValidQuery("a OR b OR c", "((a OR b) OR c)");
      testValidQuery('"term one" OR "term two"', '("term one" OR "term two")');
    });

    test("handles operator precedence correctly", () => {
      testValidQuery("a AND b OR c", "((a AND b) OR c)");
      testValidQuery("a OR b AND c", "(a OR (b AND c))");
      testValidQuery("a OR b OR c AND d", "((a OR b) OR (c AND d))");
      testValidQuery("a AND b AND c OR d", "(((a AND b) AND c) OR d)");
      testValidQuery("a OR b AND c AND d", "(a OR ((b AND c) AND d))");
    });

    test("handles mixed implicit and explicit operators", () => {
      testValidQuery("a b OR c", "((a AND b) OR c)");
      testValidQuery("a OR b c", "(a OR (b AND c))");
      testValidQuery("a b c OR d", "(((a AND b) AND c) OR d)");
      testValidQuery("a OR b c d", "(a OR ((b AND c) AND d))");
    });
  });

  describe("NOT Expression Support", () => {
    test("parses simple NOT expressions", () => {
      testValidQuery("NOT test", "NOT (test)");
    });

    test("parses NOT with parentheses", () => {
      testValidQuery("NOT (test)", "NOT (test)");
    });

    test("parses NOT with field:value", () => {
      testValidQuery("NOT status:active", "NOT (status:active)");
    });

    test("parses NOT with quoted strings", () => {
      testValidQuery('NOT "red shoes"', 'NOT ("red shoes")');
    });

    test("parses complex expressions with NOT", () => {
      testValidQuery("boots AND NOT leather", "(boots AND NOT (leather))");
      testValidQuery("NOT (leather OR suede)", "NOT ((leather OR suede))");
      testValidQuery(
        "category:boots AND NOT (color:brown OR color:black)",
        "(category:boots AND NOT ((color:brown OR color:black)))"
      );
    });
  });

  describe("Negative Term Support", () => {
    test("parses simple negative terms", () => {
      testValidQuery("-test", "NOT (test)");
      testValidQuery('-"red shoes"', 'NOT ("red shoes")');
      testValidQuery("-status:active", "NOT (status:active)");
    });

    test("parses multiple negative terms", () => {
      testValidQuery("-red -blue", "(NOT (red) AND NOT (blue))");
    });

    test("parses mixed positive and negative terms", () => {
      testValidQuery("boots -leather", "(boots AND NOT (leather))");
      testValidQuery(
        "category:shoes -color:brown",
        "(category:shoes AND NOT (color:brown))"
      );
    });

    test("parses negative terms with parentheses", () => {
      testValidQuery("-(red OR blue)", "NOT ((red OR blue))");
      testValidQuery(
        "shoes -(color:red OR color:blue)",
        "(shoes AND NOT ((color:red OR color:blue)))"
      );
    });

    test("parses complex expressions with negative terms", () => {
      testValidQuery(
        "boots -color:brown -(brand:nike OR brand:adidas)",
        "((boots AND NOT (color:brown)) AND NOT ((brand:nike OR brand:adidas)))"
      );
    });
  });

  describe("Parentheses Grouping", () => {
    test("parses simple parenthesized expressions", () => {
      testValidQuery(
        "(winter OR summer) AND boots",
        "((winter OR summer) AND boots)"
      );
      testValidQuery("(leather OR suede)", "(leather OR suede)");
      testValidQuery("((a OR b))", "(a OR b)");
    });

    test("parses nested parentheses", () => {
      testValidQuery(
        '"red shoes" OR ((blue OR purple) AND sneakers)',
        '("red shoes" OR ((blue OR purple) AND sneakers))'
      );
      testValidQuery("((a AND b) OR c) AND d", "(((a AND b) OR c) AND d)");
      testValidQuery("(a AND (b OR (c AND d)))", "(a AND (b OR (c AND d)))");
    });

    test("handles complex parentheses combinations", () => {
      testValidQuery(
        "(a AND b) OR (c AND d) OR (e AND f)",
        "(((a AND b) OR (c AND d)) OR (e AND f))"
      );
      testValidQuery(
        "((a OR b) AND (c OR d)) OR ((e OR f) AND (g OR h))",
        "(((a OR b) AND (c OR d)) OR ((e OR f) AND (g OR h)))"
      );
    });

    test("handles other parentheses", () => {
      testValidQuery("((test))", "test");
    });
  });

  describe("Complex Queries", () => {
    test("parses complex field and term combinations", () => {
      testValidQuery(
        'category:"winter boots" AND (color:black OR color:brown)',
        "(category:winter boots AND (color:black OR color:brown))"
      );
      testValidQuery(
        "size:large color:red status:available",
        "((size:large AND color:red) AND status:available)"
      );
      testValidQuery(
        'type:"running shoes" AND (color:red OR color:blue) AND size:42 AND in_stock:true',
        "(((type:running shoes AND (color:red OR color:blue)) AND size:42) AND in_stock:true)"
      );
    });

    test("handles mixed quoted and unquoted values", () => {
      testValidQuery(
        'category:shoes AND brand:"Nike Air" OR category:boots AND brand:Timberland',
        "((category:shoes AND brand:Nike Air) OR (category:boots AND brand:Timberland))"
      );
    });

    test("handles deeply nested expressions", () => {
      testValidQuery(
        '(category:"winter gear" AND (type:boots OR type:shoes)) OR (category:"summer gear" AND (type:sandals OR type:slippers)) AND in_stock:true',
        "((category:winter gear AND (type:boots OR type:shoes)) OR ((category:summer gear AND (type:sandals OR type:slippers)) AND in_stock:true))"
      );
    });
  });

  describe("Range Query Support", () => {
    test("parses comparison operators", () => {
      testSchemaQuery("price:>100", "price:>100");
      testSchemaQuery("price:>=100", "price:>=100");
      testSchemaQuery("price:<50", "price:<50");
      testSchemaQuery("price:<=50", "price:<=50");
    });

    test("parses between ranges", () => {
      testSchemaQuery("price:10..20", "price:10..20");
      testSchemaQuery("amount:50.99..100.50", "amount:50.99..100.50");
      testSchemaQuery(
        "date:2024-01-01..2024-12-31",
        "date:2024-01-01..2024-12-31"
      );
    });

    test("parses open-ended ranges", () => {
      testSchemaQuery("price:10..", "price:>=10");
      testSchemaQuery("price:..20", "price:<=20");
      testSchemaQuery("date:2024-01-01..", "date:>=2024-01-01");
      testSchemaQuery("date:..2024-12-31", "date:<=2024-12-31");
    });

    test("complex expressions with ranges", () => {
      testSchemaQuery(
        "price:>100 AND amount:<50",
        "(price:>100 AND amount:<50)"
      );
      testSchemaQuery(
        "price:10..20 OR amount:>=100",
        "(price:10..20 OR amount:>=100)"
      );
      testSchemaQuery(
        "(price:>100 AND amount:<50) OR date:>=2024-01-01",
        "((price:>100 AND amount:<50) OR date:>=2024-01-01)"
      );
    });

    test("mixes ranges with regular fields", () => {
      testSchemaQuery(
        "title:shoes AND price:10..20",
        "(title:shoes AND price:10..20)"
      );
    });

    test("only applies range parsing to numeric and date fields", () => {
      const result = parseSearchInputQuery(
        "title:>100",
        schemas
      );
      expect(result.type).toBe("SEARCH_QUERY");
      const query = result as SearchQuery;
      expect(stringify(query.expression!)).toBe("title:>100");
      expect(query.expression!.type).toBe("FIELD_VALUE");
    });

    test("parses decimal numbers in ranges", () => {
      testSchemaQuery("price:10.5..20.99", "price:10.5..20.99");
      testSchemaQuery("amount:50.99..100.50", "amount:50.99..100.50");
    });

    test("parses negative numbers in ranges", () => {
      testSchemaQuery("price:-10..10", "price:-10..10");
      testSchemaQuery("amount:-50.99..-10.50", "amount:-50.99..-10.50");
    });

    test("parses date format ranges", () => {
      testSchemaQuery(
        "date:2024-01-01..2024-12-31",
        "date:2024-01-01..2024-12-31"
      );
      testSchemaQuery(
        "date:2023-12-31..2024-01-01",
        "date:2023-12-31..2024-01-01"
      );
    });
  });

  describe("Error Cases", () => {
    test("handles empty input", () => {
      const result = parseSearchInputQuery("");
      expect(result.type).toBe("SEARCH_QUERY");
      expect((result as SearchQuery).expression).toBeNull();
    });

    test("handles whitespace-only input", () => {
      const result = parseSearchInputQuery("   \t\n   ");
      expect(result.type).toBe("SEARCH_QUERY");
      expect((result as SearchQuery).expression).toBeNull();
    });

    test("handles invalid field syntax", () => {
      testErrorQuery("field:", [{
        "length": 6,
        "message": "Expected field value",
        "position": 0,
      }]);
      testErrorQuery(":value", [{
        "length": 6,
        "message": "Missing field name",
        "position": 0,
      }]);
      testErrorQuery(":", [
        {
          length: 1,
          message: "Expected field value",
          position: 0,
        },
      ]);
      testErrorQuery("field::", [
        {
          length: 6,
          message: "Expected field value",
          position: 0,
        },
        {
          length: 1,
          message: "Expected field value",
          position: 6,
        },
      ]);
    });

    test("handles reserved words as identifiers", () => {
      testErrorQuery("AND:value", [
        {
          length: 3,
          message: "AND is a reserved word",
          position: 0,
        },
      ]);
      testErrorQuery("OR:test", [
        {
          length: 2,
          message: "OR is a reserved word",
          position: 0,
        },
      ]);
    });

    test("handles malformed parentheses", () => {
      testErrorQuery("()", [
        {
          length: 1,
          message: 'Unexpected ")"',
          position: 1,
        },
      ]);
      testErrorQuery("(test))", [
        {
          length: 1,
          message: 'Unexpected ")"',
          position: 6,
        },
      ]);
    });

    test("handles unterminated quoted strings", () => {
      testErrorQuery('brand:"Nike', [
        {
          length: 6,
          message: "Unterminated quoted string",
          position: 6,
        },
      ]);
      testErrorQuery('brand:"Nike\\', [
        {
          length: 7,
          message: "Unterminated quoted string",
          position: 6,
        },
      ]);
      testErrorQuery('brand:"Nike\\"', [
        {
          length: 8,
          message: "Unterminated quoted string",
          position: 6,
        },
      ]);
      testErrorQuery('"unclosed quote', [
        {
          length: 16,
          message: "Unterminated quoted string",
          position: 0,
        },
      ]);
    });

    test("handles invalid operator usage", () => {
      testErrorQuery("AND term", [
        {
          length: 3,
          message: "AND is a reserved word",
          position: 0,
        },
      ]);
      testErrorQuery("OR term", [
        {
          length: 2,
          message: "OR is a reserved word",
          position: 0,
        },
      ]);
      testErrorQuery("term AND", [
        {
          length: 3,
          message: "Unexpected token: AND",
          position: 5,
        },
      ]);
      testErrorQuery("term OR", [
        {
          length: 2,
          message: "Unexpected token: OR",
          position: 5,
        },
      ]);
      testErrorQuery("AND AND", [
        {
          length: 3,
          message: "AND is a reserved word",
          position: 0,
        },
      ]);
      testErrorQuery("OR OR", [
        {
          length: 2,
          message: "OR is a reserved word",
          position: 0,
        },
      ]);
    });

    test("handle multiple errors", () => {
      testErrorQuery(
        'category:"winter boots" AND (value: OR color:) AND size:',
        [
          {
            length: 6,
            message: "Expected field value",
            position: 29,
          },
          {
            length: 6,
            message: "Expected field value",
            position: 39,
          },
          {
            length: 5,
            message: "Expected field value",
            position: 51,
          },
        ]
      );
      testErrorQuery(
        'category:"winter boots" AND (value: OR color:) AND size: AND AND',
        [
          {
            length: 3,
            message: "AND is a reserved word",
            position: 61,
          },
        ]
      );
    });

    test("handles malformed ranges", () => {
      testSchemaErrorQuery("amount:>", [
        {
          message: "Expected range value",
          position: 8,
          length: 0,
        },
      ]);

      testSchemaErrorQuery("price:>=>100", [
        {
          message: "Invalid range operator",
          position: 6,
          length: 3,
        },
      ]);

      testSchemaErrorQuery("price:>..", [
        {
          message: "Invalid numeric value",
          position: 6,
          length: 3,
        },
      ]);

      testSchemaErrorQuery("price:...", [
        {
          message: "Invalid range format",
          position: 6,
          length: 3,
        },
      ]);

      testSchemaErrorQuery("price:100...", [
        {
          message: "Invalid range format",
          position: 6,
          length: 6,
        },
      ]);

      testSchemaErrorQuery("price:...200", [
        {
          message: "Invalid range format",
          position: 6,
          length: 6,
        },
      ]);
    });

    test("handles invalid numeric ranges", () => {
      testSchemaErrorQuery("price:abc..def", [
        {
          message: "Invalid numeric value",
          position: 6,
          length: 8,
        },
      ]);

      testSchemaErrorQuery("amount:>abc", [
        {
          message: "Invalid numeric value",
          position: 8,
          length: 3,
        },
      ]);
    });

    test("handles invalid date ranges", () => {
      testSchemaErrorQuery("date:>not-a-date", [
        {
          message: "Invalid date format",
          position: 5,
          length: 11,
        },
      ]);

      testSchemaErrorQuery("date:2024-13-01..2024-12-31", [
        {
          message: "Invalid date format",
          position: 5,
          length: 22,
        },
      ]);
    });
  });
});
