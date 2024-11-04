import { describe, expect, test } from "@jest/globals";
import { validateFields } from "./field-validator";
import { SearchQuery } from "./parser";

describe("Field Validator", () => {
  const columns = [
    "title",
    "description",
    "category",
    "status",
    "price",
    "date",
  ];

  const createSearchQuery = (expression: any): SearchQuery => ({
    type: "SEARCH_QUERY",
    expression,
  });

  describe("Basic Validation", () => {
    test("validates empty query", () => {
      const result = validateFields(createSearchQuery(null), columns);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test("validates simple search term", () => {
      const query = createSearchQuery({
        type: "SEARCH_TERM",
        value: "test",
        position: 0,
        length: 4,
      });

      const result = validateFields(query, columns);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test("validates valid field", () => {
      const query = createSearchQuery({
        type: "FIELD_VALUE",
        field: {
          type: "FIELD",
          value: "title",
          position: 0,
          length: 5,
        },
        value: {
          type: "VALUE",
          value: "test",
          position: 6,
          length: 4,
        },
      });

      const result = validateFields(query, columns);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test("validates invalid field", () => {
      const query = createSearchQuery({
        type: "FIELD_VALUE",
        field: {
          type: "FIELD",
          value: "invalid_field",
          position: 0,
          length: 12,
        },
        value: {
          type: "VALUE",
          value: "test",
          position: 13,
          length: 4,
        },
      });

      const result = validateFields(query, columns);
      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].field).toBe("invalid_field");
      expect(result.errors[0].position).toBe(0);
      expect(result.errors[0].length).toBe(12);
    });
  });

  describe("Complex Expressions", () => {
    test("validates AND expression with valid fields", () => {
      const query = createSearchQuery({
        type: "AND",
        position: 13,
        length: 3,
        left: {
          type: "FIELD_VALUE",
          field: {
            type: "FIELD",
            value: "category",
            position: 0,
            length: 8,
          },
          value: {
            type: "VALUE",
            value: "books",
            position: 9,
            length: 5,
          },
        },
        right: {
          type: "FIELD_VALUE",
          field: {
            type: "FIELD",
            value: "status",
            position: 17,
            length: 6,
          },
          value: {
            type: "VALUE",
            value: "active",
            position: 24,
            length: 6,
          },
        },
      });

      const result = validateFields(query, columns);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test("validates OR expression with mixed valid/invalid fields", () => {
      const query = createSearchQuery({
        type: "OR",
        position: 13,
        length: 2,
        left: {
          type: "FIELD_VALUE",
          field: {
            type: "FIELD",
            value: "invalid_field",
            position: 0,
            length: 12,
          },
          value: {
            type: "VALUE",
            value: "test",
            position: 13,
            length: 4,
          },
        },
        right: {
          type: "FIELD_VALUE",
          field: {
            type: "FIELD",
            value: "status",
            position: 20,
            length: 6,
          },
          value: {
            type: "VALUE",
            value: "active",
            position: 27,
            length: 6,
          },
        },
      });

      const result = validateFields(query, columns);
      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].field).toBe("invalid_field");
    });

    test("validates complex nested expression", () => {
      const query = createSearchQuery({
        type: "AND",
        position: 22,
        length: 3,
        left: {
          type: "OR",
          position: 13,
          length: 2,
          left: {
            type: "FIELD_VALUE",
            field: {
              type: "FIELD",
              value: "category",
              position: 0,
              length: 8,
            },
            value: {
              type: "VALUE",
              value: "books",
              position: 9,
              length: 5,
            },
          },
          right: {
            type: "SEARCH_TERM",
            value: "fiction",
            position: 16,
            length: 7,
          },
        },
        right: {
          type: "FIELD_VALUE",
          field: {
            type: "FIELD",
            value: "nonexistent",
            position: 26,
            length: 11,
          },
          value: {
            type: "VALUE",
            value: "test",
            position: 38,
            length: 4,
          },
        },
      });

      const result = validateFields(query, columns);
      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].field).toBe("nonexistent");
    });
  });

  describe("Case Sensitivity", () => {
    test("validates fields case-insensitively", () => {
      const query = createSearchQuery({
        type: "AND",
        position: 13,
        length: 3,
        left: {
          type: "FIELD_VALUE",
          field: {
            type: "FIELD",
            value: "TITLE",
            position: 0,
            length: 5,
          },
          value: {
            type: "VALUE",
            value: "test",
            position: 6,
            length: 4,
          },
        },
        right: {
          type: "FIELD_VALUE",
          field: {
            type: "FIELD",
            value: "Category",
            position: 17,
            length: 8,
          },
          value: {
            type: "VALUE",
            value: "books",
            position: 26,
            length: 5,
          },
        },
      });

      const result = validateFields(query, columns);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe("Multiple Errors", () => {
    test("captures all invalid fields in complex expression", () => {
      const query = createSearchQuery({
        type: "AND",
        position: 22,
        length: 3,
        left: {
          type: "OR",
          position: 13,
          length: 2,
          left: {
            type: "FIELD_VALUE",
            field: {
              type: "FIELD",
              value: "invalid1",
              position: 0,
              length: 8,
            },
            value: {
              type: "VALUE",
              value: "test",
              position: 9,
              length: 4,
            },
          },
          right: {
            type: "FIELD_VALUE",
            field: {
              type: "FIELD",
              value: "invalid2",
              position: 16,
              length: 8,
            },
            value: {
              type: "VALUE",
              value: "test",
              position: 25,
              length: 4,
            },
          },
        },
        right: {
          type: "FIELD_VALUE",
          field: {
            type: "FIELD",
            value: "invalid3",
            position: 32,
            length: 8,
          },
          value: {
            type: "VALUE",
            value: "test",
            position: 41,
            length: 4,
          },
        },
      });

      const result = validateFields(query, columns);
      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(3);
      expect(result.errors.map((e) => e.field)).toEqual([
        "invalid1",
        "invalid2",
        "invalid3",
      ]);
    });
  });
});
