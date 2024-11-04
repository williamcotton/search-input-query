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
          type: TokenType.STRING,
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
          value: "field:value",
          position: 0,
          length: 12,
        },
      ]);

      expect(tokenize("field :value")).toEqual([
        {
          type: TokenType.STRING,
          value: "field:value",
          position: 0,
          length: 12,
        },
      ]);

      expect(tokenize('field:"quoted value"')).toEqual([
        {
          type: TokenType.STRING,
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
          type: TokenType.STRING,
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
});
