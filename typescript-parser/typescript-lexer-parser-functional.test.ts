import { describe, expect, test } from "@jest/globals";

import {
  parseSearchQuery,
  type SearchQuery,
  type SearchQueryError,
  stringify,
} from "./typescript-lexer-parser-functional";

describe("Search Query Parser", () => {
  // Helper function to test successful queries
  const testValidQuery = (input: string, expected: string) => {
    const result = parseSearchQuery(input);
    expect(result.type).toBe("SEARCH_QUERY");
    const query = result as SearchQuery;
    expect(query.expression).toBeTruthy();
    if (query.expression) {
      expect(stringify(query.expression)).toBe(expected);
    }
  };

  // Helper function to test error cases
  const testErrorQuery = (input: string, expectedError: string) => {
    const result = parseSearchQuery(input);
    expect(result.type).toBe("SEARCH_QUERY_ERROR");
    const error = result as SearchQueryError;
    expect(error.error).toBe(expectedError);
  };

  describe("Basic Term Parsing", () => {
    test("parses single terms", () => {
      testValidQuery("boots", "boots");
      testValidQuery('"red shoes"', '"red shoes"');
    });

    test("parses multiple terms with implicit AND", () => {
      testValidQuery("boots summer", "(boots AND summer)");
      testValidQuery("red boots black", "((red AND boots) AND black)");
    });
  });

  describe("Field Value Parsing", () => {
    test("parses simple field:value pairs", () => {
      testValidQuery("color:red", "color:red");
      testValidQuery("size:large", "size:large");
    });

    test("parses field values with spaces", () => {
      testValidQuery('status:"pending review"', "status:pending review");
      testValidQuery('category:"winter boots"', "category:winter boots");
    });

    test("handles various field:value spacing", () => {
      testValidQuery("field: value", "field:value");
      testValidQuery("field :value", "field:value");
      testValidQuery("field : value", "field:value");
    });

    test("handles escaped characters in field values", () => {
      testValidQuery('brand:"Nike\\Air"', "brand:NikeAir");
      testValidQuery('brand:"Nike\\"Air"', 'brand:Nike"Air');
    });
  });

  describe("Logical Operators", () => {
    test("parses AND operator", () => {
      testValidQuery("comfortable AND leather", "(comfortable AND leather)");
      testValidQuery("color:red AND size:large", "(color:red AND size:large)");
    });

    test("parses OR operator", () => {
      testValidQuery("leather OR suede", "(leather OR suede)");
      testValidQuery(
        "color:black OR color:brown",
        "(color:black OR color:brown)"
      );
    });

    test("handles operator precedence correctly", () => {
      testValidQuery("a AND b OR c", "((a AND b) OR c)");
      testValidQuery("a OR b AND c", "(a OR (b AND c))");
      testValidQuery("a OR b OR c AND d", "((a OR b) OR (c AND d))");
    });
  });

  describe("Parentheses Grouping", () => {
    test("parses simple parenthesized expressions", () => {
      testValidQuery(
        "(winter OR summer) AND boots",
        "((winter OR summer) AND boots)"
      );
      testValidQuery("(leather OR suede)", "(leather OR suede)");
    });

    test("parses nested parentheses", () => {
      testValidQuery(
        '"red shoes" OR ((blue OR purple) AND sneakers)',
        '("red shoes" OR ((blue OR purple) AND sneakers))'
      );
      testValidQuery("((a AND b) OR c) AND d", "(((a AND b) OR c) AND d)");
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
    });

    test("parses queries with mixed operators and grouping", () => {
      testValidQuery(
        "comfortable AND (leather OR suede) brand:nike",
        "((comfortable AND (leather OR suede)) AND brand:nike)"
      );
    });
  });

  describe("Error Cases", () => {
    test("handles empty input", () => {
      const result = parseSearchQuery("");
      expect(result.type).toBe("SEARCH_QUERY");
      expect((result as SearchQuery).expression).toBeNull();
    });

    test("handles invalid field syntax", () => {
      testErrorQuery("field:", "Expected field value");
      testErrorQuery(":value", "Unexpected token");
    });

    test("handles reserved words as identifiers", () => {
      testErrorQuery("AND:value", "AND is a reserved word");
      testErrorQuery("OR:test", "OR is a reserved word");
    });

    test("handles malformed parentheses", () => {
      testErrorQuery("()", 'Unexpected ")"');
      testErrorQuery("((test)", "Expected RPAREN");
    });

    test("handles unterminated quoted strings", () => {
      testErrorQuery('brand:"Nike"Air"', "Unterminated quoted string");
    });
  });
});
