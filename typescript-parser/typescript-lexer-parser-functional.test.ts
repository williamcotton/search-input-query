import { describe, expect, test } from "@jest/globals";

import {
  parseSearchQuery,
  type SearchQuery,
  type SearchQueryError,
  stringify,
} from "./typescript-lexer-parser-functional";

describe("Search Query Parser", () => {
  const testValidQuery = (input: string, expected: string) => {
    const result = parseSearchQuery(input);
    expect(result.type).toBe("SEARCH_QUERY");
    const query = result as SearchQuery;
    expect(query.expression).toBeTruthy();
    if (query.expression) {
      expect(stringify(query.expression)).toBe(expected);
    }
  };

  const testErrorQuery = (input: string, expectedError: string) => {
    const result = parseSearchQuery(input);
    console.log(result);
    expect(result.type).toBe("SEARCH_QUERY_ERROR");
    const error = result as SearchQueryError;
    expect(error.error).toBe(expectedError);
  };

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
      testValidQuery("field: value", "field:value");
      testValidQuery("field :value", "field:value");
      testValidQuery("field : value", "field:value");
      testValidQuery('field:"quoted value"', "field:quoted value");
      testValidQuery('field: "quoted value"', "field:quoted value");
      testValidQuery('field :"quoted value"', "field:quoted value");
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

  describe("Error Cases", () => {
    test("handles empty input", () => {
      const result = parseSearchQuery("");
      expect(result.type).toBe("SEARCH_QUERY");
      expect((result as SearchQuery).expression).toBeNull();
    });

    test("handles whitespace-only input", () => {
      const result = parseSearchQuery("   \t\n   ");
      expect(result.type).toBe("SEARCH_QUERY");
      expect((result as SearchQuery).expression).toBeNull();
    });

    test("handles invalid field syntax", () => {
      testErrorQuery("field:", "Expected field value");
      testErrorQuery(":value", "Unexpected token");
      testErrorQuery(":", "Unexpected token");
      testErrorQuery("field::", "Expected field value");
    });

    test("handles reserved words as identifiers", () => {
      testErrorQuery("AND:value", "AND is a reserved word");
      testErrorQuery("OR:test", "OR is a reserved word");
      testValidQuery("field:AND", "field:AND");
      testValidQuery("field:OR", "field:OR");
    });

    test("handles malformed parentheses", () => {
      testErrorQuery("()", 'Unexpected ")"');
      testValidQuery("((test))", "test");
      testErrorQuery("(test))", 'Unexpected ")"');
    });

    test("handles unterminated quoted strings", () => {
      testErrorQuery('brand:"Nike', "Unterminated quoted string");
      testErrorQuery('brand:"Nike\\', "Unterminated quoted string");
      testErrorQuery('brand:"Nike\\"', "Unterminated quoted string");
      testErrorQuery('"unclosed quote', "Unterminated quoted string");
    });

    test("handles invalid operator usage", () => {
      testErrorQuery("AND term", "AND is a reserved word");
      testErrorQuery("OR term", "OR is a reserved word");
      testErrorQuery("term AND", "Unexpected token");
      testErrorQuery("term OR", "Unexpected token");
      testErrorQuery("AND AND", "AND is a reserved word");
      testErrorQuery("OR OR", "OR is a reserved word");
    });
  });
});
