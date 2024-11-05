import { tokenize, createStream, currentToken, TokenType } from "./lexer";
import {
  parseExpression,
  PositionLength,
  FirstPassExpression,
} from "./first-pass-parser";
import { validateSearchQuery, ValidationError } from "./validator";

// Schema types for range queries
interface FieldSchema {
  name: string;
  type: "string" | "number" | "date" | "boolean";
}

// Second Pass AST types (semantic analysis)
type SearchTerm = {
  readonly type: "SEARCH_TERM";
  readonly value: string;
} & PositionLength;

type Field = {
  readonly type: "FIELD";
  readonly value: string;
} & PositionLength;

type Value = {
  readonly type: "VALUE";
  readonly value: string;
} & PositionLength;

type RangeOperator = ">=" | ">" | "<=" | "<" | "BETWEEN";

type RangeExpression = {
  readonly type: "RANGE";
  readonly field: Field;
  readonly operator: RangeOperator;
  readonly value: Value;
  readonly value2?: Value; // For BETWEEN
} & PositionLength;

type FieldValue = {
  readonly type: "FIELD_VALUE";
  readonly field: Field;
  readonly value: Value;
};

type And = {
  readonly type: "AND";
  readonly left: Expression;
  readonly right: Expression;
} & PositionLength;

type Or = {
  readonly type: "OR";
  readonly left: Expression;
  readonly right: Expression;
} & PositionLength;

type Not = {
  readonly type: "NOT";
  readonly expression: Expression;
} & PositionLength;

type Expression = SearchTerm | FieldValue | RangeExpression | And | Or | Not;

type SearchQuery = {
  readonly type: "SEARCH_QUERY";
  readonly expression: Expression | null;
};

type SearchQueryError = {
  readonly type: "SEARCH_QUERY_ERROR";
  readonly expression: null;
  readonly errors: ValidationError[];
};

// Helper function to stringify expressions
const stringify = (expr: Expression): string => {
  switch (expr.type) {
    case "SEARCH_TERM":
      return expr.value.includes(" ") ? `"${expr.value}"` : expr.value;
    case "FIELD_VALUE":
      return `${expr.field.value}:${expr.value.value}`;
    case "RANGE":
      if (expr.operator === "BETWEEN") {
        return `${expr.field.value}:${expr.value.value}..${expr.value2?.value}`;
      }
      return `${expr.field.value}:${expr.operator}${expr.value.value}`;
    case "NOT":
      return `NOT (${stringify(expr.expression)})`;
    case "AND":
      return `(${stringify(expr.left)} AND ${stringify(expr.right)})`;
    case "OR":
      return `(${stringify(expr.left)} OR ${stringify(expr.right)})`;
  }
};

const isRangeOperator = (str: string): str is RangeOperator => {
  return [">=", ">", "<=", "<"].includes(str);
};

const parseRangeExpression = (
  fieldName: string,
  value: string,
  schema: FieldSchema | undefined,
  position: number,
  colonIndex: number
): RangeExpression | FieldValue => {
  // Handle ..20 (less than or equal)
  if (value.startsWith("..")) {
    const numValue = value.slice(2);
    return {
      type: "RANGE",
      field: {
        type: "FIELD",
        value: fieldName,
        position,
        length: colonIndex,
      },
      operator: "<=",
      value: {
        type: "VALUE",
        value: numValue,
        position: position + colonIndex + 3, // after colon and ..
        length: numValue.length,
      },
      position,
      length: colonIndex + 1 + value.length,
    };
  }

  // Handle 10.. (greater than or equal)
  if (value.endsWith("..")) {
    const numValue = value.slice(0, -2);
    return {
      type: "RANGE",
      field: {
        type: "FIELD",
        value: fieldName,
        position,
        length: colonIndex,
      },
      operator: ">=",
      value: {
        type: "VALUE",
        value: numValue,
        position: position + colonIndex + 1,
        length: numValue.length,
      },
      position,
      length: colonIndex + 1 + value.length,
    };
  }

  // Handle date ranges with YYYY-MM-DD format
  if (schema?.type === "date") {
    const betweenMatch = value.match(
      /^(\d{4}-\d{2}-\d{2})\.\.(\d{4}-\d{2}-\d{2})$/
    );
    if (betweenMatch) {
      const [_, start, end] = betweenMatch;
      return {
        type: "RANGE",
        field: {
          type: "FIELD",
          value: fieldName,
          position,
          length: colonIndex,
        },
        operator: "BETWEEN",
        value: {
          type: "VALUE",
          value: start,
          position: position + colonIndex + 1,
          length: start.length,
        },
        value2: {
          type: "VALUE",
          value: end,
          position: position + colonIndex + start.length + 3,
          length: end.length,
        },
        position,
        length: colonIndex + 1 + value.length,
      };
    }
  }

  // Handle 10..20 (between), handling floats and negative numbers
  const betweenMatch = value.match(/^(-?\d*\.?\d+)\.\.(-?\d*\.?\d+)$/);
  if (betweenMatch) {
    const [_, start, end] = betweenMatch;
    return {
      type: "RANGE",
      field: {
        type: "FIELD",
        value: fieldName,
        position,
        length: colonIndex,
      },
      operator: "BETWEEN",
      value: {
        type: "VALUE",
        value: start,
        position: position + colonIndex + 1,
        length: start.length,
      },
      value2: {
        type: "VALUE",
        value: end,
        position: position + colonIndex + start.length + 3,
        length: end.length,
      },
      position,
      length: colonIndex + 1 + value.length,
    };
  }

  // Handle >100, >=100, <100, <=100
  if (value.length > 1 && isRangeOperator(value.slice(0, 2))) {
    const operator = value.slice(0, 2) as RangeOperator;
    const numValue = value.slice(2);
    return {
      type: "RANGE",
      field: {
        type: "FIELD",
        value: fieldName,
        position,
        length: colonIndex,
      },
      operator,
      value: {
        type: "VALUE",
        value: numValue,
        position: position + colonIndex + 3,
        length: numValue.length,
      },
      position,
      length: colonIndex + 1 + value.length,
    };
  }

  if (value.length > 0 && isRangeOperator(value.slice(0, 1))) {
    const operator = value.slice(0, 1) as RangeOperator;
    const numValue = value.slice(1);
    return {
      type: "RANGE",
      field: {
        type: "FIELD",
        value: fieldName,
        position,
        length: colonIndex,
      },
      operator,
      value: {
        type: "VALUE",
        value: numValue,
        position: position + colonIndex + 2,
        length: numValue.length,
      },
      position,
      length: colonIndex + 1 + value.length,
    };
  }

  // If no range pattern is matched, return a regular field value
  return {
    type: "FIELD_VALUE",
    field: {
      type: "FIELD",
      value: fieldName,
      position,
      length: colonIndex,
    },
    value: {
      type: "VALUE",
      value,
      position: position + colonIndex + 1,
      length: value.length,
    },
  };
};

// Helper to transform FirstPassExpression into Expression
const transformToExpression = (
  expr: FirstPassExpression,
  schemas: Map<string, FieldSchema>
): Expression => {
  switch (expr.type) {
    case "NOT":
      return {
        type: "NOT",
        expression: transformToExpression(expr.expression, schemas),
        position: expr.position,
        length: expr.length,
      };

    case "STRING": {
      // Check if the string is a field:value pattern
      const colonIndex = expr.value.indexOf(":");
      if (colonIndex !== -1) {
        const field = expr.value.substring(0, colonIndex).trim();
        let value = expr.value.substring(colonIndex + 1).trim();
        // Remove quotes if present
        value =
          value.startsWith('"') && value.endsWith('"')
            ? value.slice(1, -1)
            : value;

        const schema = schemas.get(field.toLowerCase());

        // Check for range patterns when we have a numeric or date field
        if (schema && (schema.type === "number" || schema.type === "date")) {
          return parseRangeExpression(
            field,
            value,
            schema,
            expr.position,
            colonIndex
          );
        }

        return {
          type: "FIELD_VALUE",
          field: {
            type: "FIELD",
            value: field,
            position: expr.position,
            length: colonIndex,
          },
          value: {
            type: "VALUE",
            value,
            position: expr.position + colonIndex + 1,
            length: value.length,
          },
        };
      }

      return {
        type: "SEARCH_TERM",
        value: expr.value,
        position: expr.position,
        length: expr.length,
      };
    }

    case "AND":
      return {
        type: "AND",
        left: transformToExpression(expr.left, schemas),
        right: transformToExpression(expr.right, schemas),
        position: expr.position,
        length: expr.length,
      };

    case "OR":
      return {
        type: "OR",
        left: transformToExpression(expr.left, schemas),
        right: transformToExpression(expr.right, schemas),
        position: expr.position,
        length: expr.length,
      };
  }
};

// Field validation helpers
const validateFieldValue = (
  expr: FirstPassExpression,
  allowedFields: Set<string>,
  errors: ValidationError[],
  schemas: Map<string, FieldSchema>
): void => {
  if (expr.type !== "STRING") return;

  const colonIndex = expr.value.indexOf(":");
  if (colonIndex === -1) return;

  const fieldName = expr.value.substring(0, colonIndex).trim();
  const value = expr.value.substring(colonIndex + 1).trim();

  if (!allowedFields.has(fieldName.toLowerCase()) && colonIndex > 0) {
    errors.push({
      message: `Invalid field: "${fieldName}"`,
      position: expr.position,
      length: colonIndex,
    });
    return;
  }

  // Check for empty values
  if (!value) {
    errors.push({
      message: "Expected field value",
      position: expr.position,
      length: colonIndex + 1,
    });
    return;
  }

  // Handle standalone colon (treated as empty field name)
  if (value.startsWith(":")) {
    errors.push({
      message: "Missing field name",
      position: expr.position,
      length: value.length + colonIndex + 1,
    });
    return;
  }

  // First validate range operators
  if (value.startsWith(">") || value.startsWith("<")) {
    const invalidOp = /^[<>]{2,}|>=>/;
    if (invalidOp.test(value)) {
      errors.push({
        message: "Invalid range operator",
        position: expr.position + colonIndex + 1,
        length: 3,
      });
      return;
    }
  }

  // Then check for malformed range patterns
  if (value === ".." || value.includes("...")) {
    errors.push({
      message: "Invalid range format",
      position: expr.position + colonIndex + 1,
      length: value.length,
    });
    return;
  }

  // Check for empty range values
  const rangeOp = /^(>=|>|<=|<|\.\.)/;
  const match = value.match(rangeOp);
  if (match && !value.substring(match[1].length)) {
    errors.push({
      message: "Expected range value",
      position: expr.position + colonIndex + 1 + match[1].length,
      length: 0,
    });
    return;
  }

  const schema = schemas.get(fieldName.toLowerCase());
  if (schema) {
    if (schema.type === "number") {
      if (value.includes("..")) {
        const [start, end] = value.split("..");
        if ((start && isNaN(Number(start))) || (end && isNaN(Number(end)))) {
          errors.push({
            message: "Invalid numeric value",
            position: expr.position + colonIndex + 1,
            length: value.length,
          });
          return;
        }
      } else if (match && isNaN(Number(value.substring(match[1].length)))) {
        errors.push({
          message: "Invalid numeric value",
          position: expr.position + colonIndex + 1 + match[1].length,
          length: value.length - match[1].length,
        });
        return;
      }
    } else if (schema.type === "date") {
      const dateValidator = (dateStr: string) => {
        if (!dateStr) return true;
        if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
          return false;
        }
        const date = new Date(dateStr);
        return (
          !isNaN(date.getTime()) && dateStr === date.toISOString().split("T")[0]
        );
      };

      if (value.includes("..")) {
        const [start, end] = value.split("..");
        if (!dateValidator(start) || !dateValidator(end)) {
          errors.push({
            message: "Invalid date format",
            position: expr.position + colonIndex + 1,
            length: value.length,
          });
          return;
        }
      } else if (match && !dateValidator(value.substring(match[1].length))) {
        errors.push({
          message: "Invalid date format",
          position: expr.position + colonIndex + 1,
          length: value.length,
        });
        return;
      }
    }
  }
};

const validateExpressionFields = (
  expr: FirstPassExpression,
  allowedFields: Set<string>,
  errors: ValidationError[],
  schemas: Map<string, FieldSchema>
): void => {
  switch (expr.type) {
    case "STRING":
      validateFieldValue(expr, allowedFields, errors, schemas);
      break;
    case "AND":
    case "OR":
      validateExpressionFields(expr.left, allowedFields, errors, schemas);
      validateExpressionFields(expr.right, allowedFields, errors, schemas);
      break;
    case "NOT":
      validateExpressionFields(expr.expression, allowedFields, errors, schemas);
      break;
  }
};


// Main parse function
export const parseSearchQuery = (
  input: string,
  fieldSchemas: FieldSchema[] = []
): SearchQuery | SearchQueryError => {
  try {
    const tokens = tokenize(input);
    const stream = createStream(tokens);

    if (currentToken(stream).type === TokenType.EOF) {
      return { type: "SEARCH_QUERY", expression: null };
    }

    const result = parseExpression(stream);

    const finalToken = currentToken(result.stream);
    if (finalToken.type !== TokenType.EOF) {
      throw {
        message: 'Unexpected ")"',
        position: finalToken.position,
        length: finalToken.length,
      };
    }

    const errors = validateSearchQuery(result.result);
    const fieldErrors: ValidationError[] = [];

    const allowedFields = fieldSchemas.map((s) => s.name.toLowerCase());

    if (allowedFields.length > 0) {
      const columnSet = new Set(allowedFields.map((col) => col.toLowerCase()));
      const schemaMap = new Map(fieldSchemas.map((s) => [s.name.toLowerCase(), s]));
      validateExpressionFields(result.result, columnSet, fieldErrors, schemaMap);
    }

    const fieldErrorKeys = fieldErrors.map(
      ({ position, length }) => `${position}-${length}`
    );
    const errorsToRemove = errors.filter(({ position, length }) =>
      fieldErrorKeys.includes(`${position}-${length}`)
    );
    const fieldErrorsFiltered = fieldErrors.filter(
      ({ position, length }) =>
        !errorsToRemove.some(
          (error) => error.position === position && error.length === length
        )
    );

    const allErrors = [...errors, ...fieldErrorsFiltered].sort(
      (a, b) => a.position - b.position
    );

    if (allErrors.length > 0) {
      return {
        type: "SEARCH_QUERY_ERROR",
        expression: null,
        errors: allErrors,
      };
    }

    // Create schema map for efficient lookups
    const schemaMap = new Map(
      fieldSchemas.map((s) => [s.name.toLowerCase(), s])
    );
    const expression = transformToExpression(result.result, schemaMap);

    return { type: "SEARCH_QUERY", expression };
  } catch (error: any) {
    return {
      type: "SEARCH_QUERY_ERROR",
      expression: null,
      errors: [error],
    };
  }
};

export {
  type SearchQuery,
  type SearchQueryError,
  type Expression,
  type ValidationError,
  type FieldSchema,
  type RangeOperator,
  type RangeExpression,
  stringify,
};
