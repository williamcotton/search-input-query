import { tokenize, createStream, currentToken, TokenType } from "./lexer";
import {
  parseExpression,
  PositionLength,
  FirstPassExpression,
} from "./first-pass-parser";
import { validateSearchQuery, ValidationError } from "./validator";

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

type Expression = SearchTerm | FieldValue | And | Or | Not;

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
    case "NOT":
      return `NOT (${stringify(expr.expression)})`;
    case "AND":
      return `(${stringify(expr.left)} AND ${stringify(expr.right)})`;
    case "OR":
      return `(${stringify(expr.left)} OR ${stringify(expr.right)})`;
  }
};

// Helper to transform FirstPassExpression into Expression
const transformToExpression = (expr: FirstPassExpression): Expression => {
  switch (expr.type) {
    case "NOT":
      return {
        type: "NOT",
        expression: transformToExpression(expr.expression),
        position: expr.position,
        length: expr.length,
      };

    case "STRING": {
      // Check if the string is a field:value pattern
      const colonIndex = expr.value.indexOf(":");
      if (colonIndex !== -1) {
        const field = expr.value.substring(0, colonIndex).trim();
        const value = expr.value.substring(colonIndex + 1).trim();
        // Remove quotes if present
        const cleanValue =
          value.startsWith('"') && value.endsWith('"')
            ? value.slice(1, -1)
            : value;

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
            value: cleanValue,
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
        left: transformToExpression(expr.left),
        right: transformToExpression(expr.right),
        position: expr.position,
        length: expr.length,
      };

    case "OR":
      return {
        type: "OR",
        left: transformToExpression(expr.left),
        right: transformToExpression(expr.right),
        position: expr.position,
        length: expr.length,
      };
  }
};

// Field validation helpers
const validateFieldValue = (
  expr: FirstPassExpression,
  allowedFields: Set<string>,
  errors: ValidationError[]
): void => {
  if (expr.type !== "STRING") return;

  const colonIndex = expr.value.indexOf(":");
  if (colonIndex === -1) return;

  const fieldName = expr.value.substring(0, colonIndex).trim();
  if (!allowedFields.has(fieldName.toLowerCase()) && colonIndex > 0) {
    errors.push({
      message: `Invalid field: "${fieldName}"`,
      position: expr.position,
      length: colonIndex,
    });
  }
};

const validateExpressionFields = (
  expr: FirstPassExpression,
  allowedFields: Set<string>,
  errors: ValidationError[]
): void => {
  switch (expr.type) {
    case "STRING":
      validateFieldValue(expr, allowedFields, errors);
      break;
    case "AND":
    case "OR":
      validateExpressionFields(expr.left, allowedFields, errors);
      validateExpressionFields(expr.right, allowedFields, errors);
      break;
    case "NOT":
      validateExpressionFields(expr.expression, allowedFields, errors);
      break;
  }
};

// Main parse function
const parseSearchQuery = (
  input: string,
  allowedFields: string[] = []
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

    if (allowedFields.length > 0) {
      const columnSet = new Set(allowedFields.map((col) => col.toLowerCase()));
      validateExpressionFields(result.result, columnSet, fieldErrors);
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

    const expression = transformToExpression(result.result);

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
  parseSearchQuery,
  stringify,
  type SearchQuery,
  type SearchQueryError,
  type Expression,
  type ValidationError,
};
