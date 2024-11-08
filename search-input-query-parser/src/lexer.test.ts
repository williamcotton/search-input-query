import { describe, expect, test } from "@jest/globals";
import { tokenize, TokenType } from "./lexer";

describe("Lexer", () => {
  describe("Basic Token Generation", () => {
    test("generates tokens for single terms", () => {
      expect(tokenize("boots")).toEqual([
        { type: TokenType.STRING, value: "boots", position: 0, length: 5 },
      ]);

      expect(tokenize("simple-term")).toEqual([
        {
          type: TokenType.STRING,
          value: "simple-term",
          position: 0,
          length: 11,
        },
      ]);

      expect(tokenize("term_with_underscore")).toEqual([
        {
          type: TokenType.STRING,
          value: "term_with_underscore",
          position: 0,
          length: 20,
        },
      ]);
    });

    test("handles multiple terms with whitespace", () => {
      expect(tokenize("boots summer")).toEqual([
        { type: TokenType.STRING, value: "boots", position: 0, length: 5 },
        { type: TokenType.STRING, value: "summer", position: 6, length: 6 },
      ]);

      expect(tokenize("  term1   term2  ")).toEqual([
        { type: TokenType.STRING, value: "term1", position: 2, length: 5 },
        { type: TokenType.STRING, value: "term2", position: 10, length: 5 },
      ]);
    });

    test("handles logical operators", () => {
      expect(tokenize("boots AND shoes")).toEqual([
        { type: TokenType.STRING, value: "boots", position: 0, length: 5 },
        { type: TokenType.AND, value: "AND", position: 6, length: 3 },
        { type: TokenType.STRING, value: "shoes", position: 10, length: 5 },
      ]);

      expect(tokenize("boots OR shoes")).toEqual([
        { type: TokenType.STRING, value: "boots", position: 0, length: 5 },
        { type: TokenType.OR, value: "OR", position: 6, length: 2 },
        { type: TokenType.STRING, value: "shoes", position: 9, length: 5 },
      ]);

      expect(tokenize("NOT test")).toEqual([
        { type: TokenType.NOT, value: "NOT", position: 0, length: 3 },
        { type: TokenType.STRING, value: "test", position: 4, length: 4 },
      ]);
    });
  });

  describe("Logical Operators", () => {
    test("handles case-insensitive AND operator", () => {
      const variations = ["AND", "and", "And", "aNd"];
      variations.forEach((op) => {
        expect(tokenize(`boots ${op} shoes`)).toEqual([
          { type: TokenType.STRING, value: "boots", position: 0, length: 5 },
          { type: TokenType.AND, value: "AND", position: 6, length: op.length },
          {
            type: TokenType.STRING,
            value: "shoes",
            position: 6 + op.length + 1,
            length: 5,
          },
        ]);
      });
    });

    test("handles case-insensitive OR operator", () => {
      const variations = ["OR", "or", "Or", "oR"];
      variations.forEach((op) => {
        expect(tokenize(`boots ${op} shoes`)).toEqual([
          { type: TokenType.STRING, value: "boots", position: 0, length: 5 },
          { type: TokenType.OR, value: "OR", position: 6, length: op.length },
          {
            type: TokenType.STRING,
            value: "shoes",
            position: 6 + op.length + 1,
            length: 5,
          },
        ]);
      });
    });

    test("handles case-insensitive NOT operator", () => {
      const variations = ["NOT", "not", "Not", "nOt"];
      variations.forEach((op) => {
        expect(tokenize(`${op} test`)).toEqual([
          { type: TokenType.NOT, value: "NOT", position: 0, length: op.length },
          {
            type: TokenType.STRING,
            value: "test",
            position: op.length + 1,
            length: 4,
          },
        ]);
      });
    });

    test("handles operators as field values", () => {
      expect(tokenize("field:and")).toEqual([
        { type: TokenType.STRING, value: "field:and", position: 0, length: 9 },
      ]);
      expect(tokenize("field:or")).toEqual([
        { type: TokenType.STRING, value: "field:or", position: 0, length: 8 },
      ]);
      expect(tokenize('field:"AND"')).toEqual([
        { type: TokenType.QUOTED_STRING, value: "field:AND", position: 0, length: 11 },
      ]);
    });

    test("handles mixed case in complex queries", () => {
      expect(tokenize("boots AND shoes or sneakers AND sandals")).toEqual([
        { type: TokenType.STRING, value: "boots", position: 0, length: 5 },
        { type: TokenType.AND, value: "AND", position: 6, length: 3 },
        { type: TokenType.STRING, value: "shoes", position: 10, length: 5 },
        { type: TokenType.OR, value: "OR", position: 16, length: 2 },
        { type: TokenType.STRING, value: "sneakers", position: 19, length: 8 },
        { type: TokenType.AND, value: "AND", position: 28, length: 3 },
        { type: TokenType.STRING, value: "sandals", position: 32, length: 7 },
      ]);
    });
  });

  describe("Quoted Strings", () => {
    test("handles simple quoted strings", () => {
      expect(tokenize('"red shoes"')).toEqual([
        {
          type: TokenType.QUOTED_STRING,
          value: "red shoes",
          position: 0,
          length: 11,
        },
      ]);
    });

    test("handles escaped quotes in quoted strings", () => {
      expect(tokenize('"Nike\\"Air"')).toEqual([
        {
          type: TokenType.QUOTED_STRING,
          value: 'Nike"Air',
          position: 0,
          length: 11,
        },
      ]);
    });

    test("handles escaped characters in quoted strings", () => {
      expect(tokenize('"path\\\\to\\\\file"')).toEqual([
        {
          type: TokenType.QUOTED_STRING,
          value: "path\\to\\file",
          position: 0,
          length: 16,
        },
      ]);
    });

    test("throws error for unterminated quotes", () => {
      expect(() => tokenize('"unclosed')).toThrow();
      expect(() => tokenize('"escaped quote\\"')).toThrow();
    });
  });

  describe("Field:Value Pairs", () => {
    test("handles basic field:value pairs", () => {
      expect(tokenize("color:red")).toEqual([
        { type: TokenType.STRING, value: "color:red", position: 0, length: 9 },
      ]);

      expect(tokenize("size:42")).toEqual([
        { type: TokenType.STRING, value: "size:42", position: 0, length: 7 },
      ]);
    });

    test("handles field:value pairs with quoted values", () => {
      expect(tokenize('status:"in progress"')).toEqual([
        {
          type: TokenType.QUOTED_STRING,
          value: "status:in progress",
          position: 0,
          length: 20,
        },
      ]);
    });

    test("handles field:value pairs with various spacing", () => {
      expect(tokenize("field: value")).toEqual([
        {
          type: TokenType.STRING,
          value: "field:",
          position: 0,
          length: 6,
        },
        {
          type: TokenType.STRING,
          value: "value",
          position: 7,
          length: 5,
        },
      ]);

      expect(tokenize("field :value")).toEqual([
        {
          type: TokenType.STRING,
          value: "field",
          position: 0,
          length: 5,
        },
        {
          type: TokenType.STRING,
          value: ":value",
          position: 6,
          length: 6,
        },
      ]);

      expect(tokenize('field:"quoted value"')).toEqual([
        {
          type: TokenType.QUOTED_STRING,
          value: "field:quoted value",
          position: 0,
          length: 20,
        },
      ]);
    });
  });

  describe("Parentheses", () => {
    test("handles simple parentheses", () => {
      expect(tokenize("(term)")).toEqual([
        { type: TokenType.LPAREN, value: "(", position: 0, length: 1 },
        { type: TokenType.STRING, value: "term", position: 1, length: 4 },
        { type: TokenType.RPAREN, value: ")", position: 5, length: 1 },
      ]);
    });

    test("handles nested parentheses", () => {
      expect(tokenize("((a))")).toEqual([
        { type: TokenType.LPAREN, value: "(", position: 0, length: 1 },
        { type: TokenType.LPAREN, value: "(", position: 1, length: 1 },
        { type: TokenType.STRING, value: "a", position: 2, length: 1 },
        { type: TokenType.RPAREN, value: ")", position: 3, length: 1 },
        { type: TokenType.RPAREN, value: ")", position: 4, length: 1 },
      ]);
    });

    test("handles complex expressions with parentheses", () => {
      expect(tokenize("(a AND b) OR c")).toEqual([
        { type: TokenType.LPAREN, value: "(", position: 0, length: 1 },
        { type: TokenType.STRING, value: "a", position: 1, length: 1 },
        { type: TokenType.AND, value: "AND", position: 3, length: 3 },
        { type: TokenType.STRING, value: "b", position: 7, length: 1 },
        { type: TokenType.RPAREN, value: ")", position: 8, length: 1 },
        { type: TokenType.OR, value: "OR", position: 10, length: 2 },
        { type: TokenType.STRING, value: "c", position: 13, length: 1 },
      ]);
    });
  });

  describe("Complex Queries", () => {
    test("handles complex field:value expressions", () => {
      expect(
        tokenize('category:"winter boots" AND (color:black OR color:brown)')
      ).toEqual([
        {
          type: TokenType.QUOTED_STRING,
          value: "category:winter boots",
          position: 0,
          length: 23,
        },
        { type: TokenType.AND, value: "AND", position: 24, length: 3 },
        { type: TokenType.LPAREN, value: "(", position: 28, length: 1 },
        {
          type: TokenType.STRING,
          value: "color:black",
          position: 29,
          length: 11,
        },
        { type: TokenType.OR, value: "OR", position: 41, length: 2 },
        {
          type: TokenType.STRING,
          value: "color:brown",
          position: 44,
          length: 11,
        },
        { type: TokenType.RPAREN, value: ")", position: 55, length: 1 },
      ]);
    });

    test("handles nested expressions with multiple operators including NOT", () => {
      expect(tokenize("NOT (a OR b) AND c")).toEqual([
        { type: TokenType.NOT, value: "NOT", position: 0, length: 3 },
        { type: TokenType.LPAREN, value: "(", position: 4, length: 1 },
        { type: TokenType.STRING, value: "a", position: 5, length: 1 },
        { type: TokenType.OR, value: "OR", position: 7, length: 2 },
        { type: TokenType.STRING, value: "b", position: 10, length: 1 },
        { type: TokenType.RPAREN, value: ")", position: 11, length: 1 },
        { type: TokenType.AND, value: "AND", position: 13, length: 3 },
        { type: TokenType.STRING, value: "c", position: 17, length: 1 },
      ]);
    });

    test("handles mixed terms and operators", () => {
      expect(tokenize('boots AND "red shoes" OR leather')).toEqual([
        { type: TokenType.STRING, value: "boots", position: 0, length: 5 },
        { type: TokenType.AND, value: "AND", position: 6, length: 3 },
        {
          type: TokenType.QUOTED_STRING,
          value: "red shoes",
          position: 10,
          length: 11,
        },
        { type: TokenType.OR, value: "OR", position: 22, length: 2 },
        { type: TokenType.STRING, value: "leather", position: 25, length: 7 },
      ]);
    });

    test("handles empty input", () => {
      expect(tokenize("")).toEqual([]);
      expect(tokenize("   ")).toEqual([]);
      expect(tokenize("\n\t")).toEqual([]);
    });
  });

  describe("Negative Terms", () => {
    test("handles simple negative terms", () => {
      expect(tokenize("-test")).toEqual([
        { type: TokenType.NOT, value: "NOT", position: 0, length: 1 },
        { type: TokenType.STRING, value: "test", position: 1, length: 4 },
      ]);
    });

    test("handles negative quoted strings", () => {
      expect(tokenize('-"red shoes"')).toEqual([
        { type: TokenType.NOT, value: "NOT", position: 0, length: 1 },
        {
          type: TokenType.QUOTED_STRING,
          value: "red shoes",
          position: 1,
          length: 11,
        },
      ]);
    });

    test("handles negative field:value pairs", () => {
      expect(tokenize("-status:active")).toEqual([
        { type: TokenType.NOT, value: "NOT", position: 0, length: 1 },
        {
          type: TokenType.STRING,
          value: "status:active",
          position: 1,
          length: 13,
        },
      ]);
    });

    test("handles negative terms with parentheses", () => {
      expect(tokenize("-(red OR blue)")).toEqual([
        { type: TokenType.NOT, value: "NOT", position: 0, length: 1 },
        { type: TokenType.LPAREN, value: "(", position: 1, length: 1 },
        { type: TokenType.STRING, value: "red", position: 2, length: 3 },
        { type: TokenType.OR, value: "OR", position: 6, length: 2 },
        { type: TokenType.STRING, value: "blue", position: 9, length: 4 },
        { type: TokenType.RPAREN, value: ")", position: 13, length: 1 },
      ]);
    });

    test("handles mixed positive and negative terms", () => {
      expect(tokenize("boots -leather")).toEqual([
        { type: TokenType.STRING, value: "boots", position: 0, length: 5 },
        { type: TokenType.NOT, value: "NOT", position: 6, length: 1 },
        { type: TokenType.STRING, value: "leather", position: 7, length: 7 },
      ]);
    });

    test("handles multiple negative terms", () => {
      expect(tokenize("-red -blue")).toEqual([
        { type: TokenType.NOT, value: "NOT", position: 0, length: 1 },
        { type: TokenType.STRING, value: "red", position: 1, length: 3 },
        { type: TokenType.NOT, value: "NOT", position: 5, length: 1 },
        { type: TokenType.STRING, value: "blue", position: 6, length: 4 },
      ]);
    });

    test("handles hyphens within terms", () => {
      expect(tokenize("pre-owned")).toEqual([
        { type: TokenType.STRING, value: "pre-owned", position: 0, length: 9 },
      ]);
    });

    test("handles hyphens in field:value pairs", () => {
      expect(tokenize("product-type:pre-owned")).toEqual([
        {
          type: TokenType.STRING,
          value: "product-type:pre-owned",
          position: 0,
          length: 22,
        },
      ]);
    });
  });

  describe("Adjacent Terms Validation", () => {
    test("rejects adjacent quoted strings", () => {
      expect(() => tokenize('"test""test"')).toThrow(
        "Invalid syntax: Missing operator or whitespace between terms"
      );
      expect(() => tokenize('"test""test""test"')).toThrow(
        "Invalid syntax: Missing operator or whitespace between terms"
      );
    });

    test("rejects adjacent terms without operators", () => {
      expect(() => tokenize('test"test"')).toThrow(
        "Invalid syntax: Missing operator or whitespace between terms"
      );
      expect(() => tokenize('"test"test')).toThrow(
        "Invalid syntax: Missing operator or whitespace between terms"
      );
    });

    test("accepts properly separated terms", () => {
      expect(() => tokenize('"test" "test"')).not.toThrow();
      expect(() => tokenize('"test" AND "test"')).not.toThrow();
      expect(() => tokenize('"test" OR "test"')).not.toThrow();
    });
  });
});
