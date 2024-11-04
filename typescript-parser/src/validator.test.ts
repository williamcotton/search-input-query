import { describe, expect, test } from "@jest/globals";
import { validateSearchQuery, ValidationError } from "./validator";
import { tokenize, createStream } from "./lexer";
import { parseExpression } from "./first-pass-parser";

describe("Search Query Validator", () => {
  const validateQuery = (input: string): ValidationError[] => {
    const tokens = tokenize(input);
    const stream = createStream(tokens);
    const result = parseExpression(stream);
    return validateSearchQuery(result.result);
  };

  describe("Field Name Validation", () => {
    test("accepts valid field names", () => {
      expect(validateQuery("simple:value")).toEqual([]);
      expect(validateQuery("field123:value")).toEqual([]);
      expect(validateQuery("field_name:value")).toEqual([]);
      expect(validateQuery("field-name:value")).toEqual([]);
    });

    test("handles field names with special characters", () => {
      expect(validateQuery("special@field:value")).toEqual([
        {
          message: "Invalid characters in field name",
          position: 0,
          length: 13,
        },
      ]);
    });

    test("validates multiple field:value pairs", () => {
      expect(validateQuery("valid:value special!:value")).toEqual([
        {
          message: "Invalid characters in field name",
          position: 12,
          length: 8,
        },
      ]);
    });
  });

  describe("Field Value Validation", () => {
    test("detects missing field values", () => {
      expect(validateQuery("field:")).toEqual([
        {
          message: "Expected field value",
          position: 0,
          length: 6,
        },
      ]);
    });

    test("validates field values with spaces", () => {
      expect(validateQuery('field:"value with spaces"')).toEqual([]);
      expect(validateQuery("field:value with spaces")).toEqual([]);
    });

    test("validates empty colon patterns", () => {
      expect(validateQuery(":value")).toEqual([
        {
          message: "Missing field name",
          position: 0,
          length: 6,
        },
      ]);
    });
  });

  describe("Reserved Word Validation", () => {
    test("detects reserved words as field names", () => {
      expect(validateQuery("AND:value")).toEqual([
        {
          message: "AND is a reserved word",
          position: 0,
          length: 3,
        },
      ]);

      expect(validateQuery("OR:value")).toEqual([
        {
          message: "OR is a reserved word",
          position: 0,
          length: 2,
        },
      ]);
    });

    test("detects reserved words as standalone terms", () => {
      // This will throw because it's handled by the parser
      expect(() => validateQuery("AND")).toThrow("AND is a reserved word");
      expect(() => validateQuery("OR")).toThrow("OR is a reserved word");
    });

    test("allows reserved words as field values", () => {
      expect(validateQuery("field:AND")).toEqual([]);
      expect(validateQuery("field:OR")).toEqual([]);
      expect(validateQuery('field:"AND OR"')).toEqual([]);
    });
  });

  describe("Complex Expression Validation", () => {
    test("validates nested expressions", () => {
      expect(validateQuery("(field:value AND invalid!:value)")).toEqual([
        {
          message: "Invalid characters in field name",
          position: 17,
          length: 8,
        },
      ]);
    });

    test("validates multiple errors in one expression", () => {
      expect(validateQuery("AND:test OR invalid!:value")).toEqual([
        {
          message: "AND is a reserved word",
          position: 0,
          length: 3,
        },
        {
          message: "Invalid characters in field name",
          position: 12,
          length: 8,
        },
      ]);
    });

    test("validates complex nested expressions", () => {
      expect(
        validateQuery("(field:value AND (OR:test OR valid:value))")
      ).toEqual([
        {
          message: "OR is a reserved word",
          position: 18,
          length: 2,
        },
      ]);
    });
  });

  describe("Edge Cases", () => {
    test("handles empty input", () => {
      expect(() => validateQuery("")).toThrow("Unexpected token");
    });

    test("handles whitespace-only input", () => {
      expect(() => validateQuery("   ")).toThrow("Unexpected token");
    });

    test("validates consecutive colons", () => {
      // The lexer handles this differently, so no validation error
      expect(validateQuery("field::value")).toEqual([]);
    });

    test("validates field names with only special characters", () => {
      expect(validateQuery("@#$:value")).toEqual([
        {
          message: "Invalid characters in field name",
          position: 0,
          length: 3,
        },
      ]);
    });

    test("validates mixed valid and invalid patterns", () => {
      const complexQuery =
        'valid:value AND field:"test" OR @invalid:value AND OR:test';
      expect(validateQuery(complexQuery)).toEqual([
        {
          message: "Invalid characters in field name",
          position: 32,
          length: 8,
        },
        {
          message: "OR is a reserved word",
          position: 51,
          length: 2,
        },
      ]);
    });
  });
});
