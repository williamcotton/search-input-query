import { describe, expect, test } from "@jest/globals";
import { tokenize, createStream } from "./lexer";
import { parseExpression, FirstPassExpression } from "./first-pass-parser";

describe("First Pass Parser", () => {
  const parseQuery = (input: string): FirstPassExpression => {
    const tokens = tokenize(input);
    const stream = createStream(tokens);
    return parseExpression(stream).result;
  };

  describe("Primary Expression Parsing", () => {
    test("parses simple string literals", () => {
      const result = parseQuery("boots");
      expect(result).toEqual({
        type: "STRING",
        value: "boots",
        position: 0,
        length: 5,
      });
    });

    test("parses quoted string literals", () => {
      const result = parseQuery('"red shoes"');
      expect(result).toEqual({
        type: "STRING",
        value: "red shoes",
        position: 0,
        length: 11,
      });
    });

    test("parses field:value pairs", () => {
      const result = parseQuery("color:red");
      expect(result).toEqual({
        type: "STRING",
        value: "color:red",
        position: 0,
        length: 9,
      });
    });

    test("parses quoted field values", () => {
      const result = parseQuery('status:"in progress"');
      expect(result).toEqual({
        type: "STRING",
        value: "status:in progress",
        position: 0,
        length: 20,
      });
    });
  });

  describe("Operator Precedence", () => {
    test("handles implicit AND with higher precedence than OR", () => {
      const result = parseQuery("a b OR c");
      expect(result).toEqual({
        type: "OR",
        left: {
          type: "AND",
          left: {
            type: "STRING",
            value: "a",
            position: 0,
            length: 1,
          },
          right: {
            type: "STRING",
            value: "b",
            position: 2,
            length: 1,
          },
          position: 2,
          length: 1,
        },
        right: {
          type: "STRING",
          value: "c",
          position: 7,
          length: 1,
        },
        position: 4,
        length: 2,
      });
    });

    test("handles explicit AND with higher precedence than OR", () => {
      const result = parseQuery("a AND b OR c");
      expect(result).toEqual({
        type: "OR",
        left: {
          type: "AND",
          left: {
            type: "STRING",
            value: "a",
            position: 0,
            length: 1,
          },
          right: {
            type: "STRING",
            value: "b",
            position: 6,
            length: 1,
          },
          position: 2,
          length: 3,
        },
        right: {
          type: "STRING",
          value: "c",
          position: 11,
          length: 1,
        },
        position: 8,
        length: 2,
      });
    });

    test("handles complex precedence with parentheses", () => {
      const result = parseQuery("(a OR b) AND c");
      expect(result).toEqual({
        type: "AND",
        left: {
          type: "OR",
          left: {
            type: "STRING",
            value: "a",
            position: 1,
            length: 1,
          },
          right: {
            type: "STRING",
            value: "b",
            position: 6,
            length: 1,
          },
          position: 3,
          length: 2,
        },
        right: {
          type: "STRING",
          value: "c",
          position: 13,
          length: 1,
        },
        position: 9,
        length: 3,
      });
    });
  });

  describe("NOT Expression Parsing", () => {
    test("parses simple NOT expressions", () => {
      const result = parseQuery("NOT test");
      expect(result).toEqual({
        type: "NOT",
        expression: {
          type: "STRING",
          value: "test",
          position: 4,
          length: 4,
        },
        position: 0,
        length: 3,
      });
    });

    test("parses NOT with parentheses", () => {
      const result = parseQuery("NOT (test)");
      expect(result).toEqual({
        type: "NOT",
        expression: {
          type: "STRING",
          value: "test",
          position: 5,
          length: 4,
        },
        position: 0,
        length: 3,
      });
    });

    test("parses NOT with field:value pairs", () => {
      const result = parseQuery("NOT status:active");
      expect(result).toEqual({
        type: "NOT",
        expression: {
          type: "STRING",
          value: "status:active",
          position: 4,
          length: 13,
        },
        position: 0,
        length: 3,
      });
    });

    test("parses complex expressions with NOT", () => {
      const result = parseQuery("boots AND NOT leather");
      expect(result).toEqual({
        type: "AND",
        left: {
          type: "STRING",
          value: "boots",
          position: 0,
          length: 5,
        },
        right: {
          type: "NOT",
          expression: {
            type: "STRING",
            value: "leather",
            position: 14,
            length: 7,
          },
          position: 10,
          length: 3,
        },
        position: 6,
        length: 3,
      });
    });
  });

  describe("Parentheses Handling", () => {
    test("parses simple parenthesized expressions", () => {
      const result = parseQuery("(boots)");
      expect(result).toEqual({
        type: "STRING",
        value: "boots",
        position: 1,
        length: 5,
      });
    });

    test("parses nested parentheses", () => {
      const result = parseQuery("((a OR b))");
      expect(result).toEqual({
        type: "OR",
        left: {
          type: "STRING",
          value: "a",
          position: 2,
          length: 1,
        },
        right: {
          type: "STRING",
          value: "b",
          position: 7,
          length: 1,
        },
        position: 4,
        length: 2,
      });
    });

    test("handles multiple nested groups", () => {
      const result = parseQuery("(a AND (b OR c))");
      expect(result).toEqual({
        type: "AND",
        left: {
          type: "STRING",
          value: "a",
          position: 1,
          length: 1,
        },
        right: {
          type: "OR",
          left: {
            type: "STRING",
            value: "b",
            position: 8,
            length: 1,
          },
          right: {
            type: "STRING",
            value: "c",
            position: 13,
            length: 1,
          },
          position: 10,
          length: 2,
        },
        position: 3,
        length: 3,
      });
    });
  });

  describe("Error Handling", () => {
    // TODO: Uncomment these tests after implementing error handling
    // test("throws error for unmatched right parenthesis", () => {
    //   expect(() => parseQuery("a)")).toThrow("Expected RPAREN");
    // });

    test("throws error for empty parentheses", () => {
      expect(() => parseQuery("()")).toThrow('Unexpected ")"');
    });

    test("throws error for missing right parenthesis", () => {
      expect(() => parseQuery("(a")).toThrow("Expected RPAREN");
    });

    test("throws error for standalone operators", () => {
      expect(() => parseQuery("AND")).toThrow("AND is a reserved word");
      expect(() => parseQuery("OR")).toThrow("OR is a reserved word");
    });

    test("throws error for missing right operand", () => {
      expect(() => parseQuery("a AND")).toThrow("Unexpected token");
      expect(() => parseQuery("a OR")).toThrow("Unexpected token");
    });

    test("throws error for consecutive operators", () => {
      expect(() => parseQuery("a AND AND b")).toThrow("AND is a reserved word");
      expect(() => parseQuery("a OR OR b")).toThrow("OR is a reserved word");
    });
  });

  describe("Complex Expressions", () => {
    test("parses complex nested expressions with mixed operators", () => {
      const result = parseQuery("(a AND b) OR (c AND (d OR e))");
      expect(result).toEqual({
        type: "OR",
        left: {
          type: "AND",
          left: {
            type: "STRING",
            value: "a",
            position: 1,
            length: 1,
          },
          right: {
            type: "STRING",
            value: "b",
            position: 7,
            length: 1,
          },
          position: 3,
          length: 3,
        },
        right: {
          type: "AND",
          left: {
            type: "STRING",
            value: "c",
            position: 14,
            length: 1,
          },
          right: {
            type: "OR",
            left: {
              type: "STRING",
              value: "d",
              position: 21,
              length: 1,
            },
            right: {
              type: "STRING",
              value: "e",
              position: 26,
              length: 1,
            },
            position: 23,
            length: 2,
          },
          position: 16,
          length: 3,
        },
        position: 10,
        length: 2,
      });
    });

    test("parses complex field-value expressions", () => {
      const result = parseQuery(
        'category:"winter boots" AND (color:black OR color:brown)'
      );
      expect(result).toEqual({
        type: "AND",
        left: {
          type: "STRING",
          value: "category:winter boots",
          position: 0,
          length: 23,
        },
        right: {
          type: "OR",
          left: {
            type: "STRING",
            value: "color:black",
            position: 29,
            length: 11,
          },
          right: {
            type: "STRING",
            value: "color:brown",
            position: 44,
            length: 11,
          },
          position: 41,
          length: 2,
        },
        position: 24,
        length: 3,
      });
    });
  });
});
