import {
  FirstPassExpression,
} from "./first-pass-parser";

import { FieldSchema } from "./parser";
import { validateInExpression } from "./validate-in-expression";
import { validateString } from "./validate-string";

export enum SearchQueryErrorCode {
  UNKNOWN = 0,

  // Syntax Errors (1000-1999)
  SYNTAX_QUOTE_UNTERMINATED = 1001,
  SYNTAX_VALUE_MISSING = 1002,
  SYNTAX_FIELD_NAME_MISSING = 1003,
  SYNTAX_FIELD_VALUE_MISSING = 1004,
  SYNTAX_PARENTHESIS_UNEXPECTED = 1005,
  SYNTAX_PARENTHESIS_MISSING = 1006,
  SYNTAX_TOKEN_UNEXPECTED = 1007,
  SYNTAX_TOKEN_MISSING = 1008,
  SYNTAX_OPERATOR_OR_SPACE_MISSING = 1009,
  SYNTAX_KEYWORD_RESERVED = 1010,

  // Field Validation Errors (2000-2999)
  FIELD_NAME_INVALID = 2001,
  FIELD_CHARS_INVALID = 2002,
  FIELD_NAME_RESERVED = 2003,

  // Value Validation Errors (3000-3999)
  VALUE_NUMERIC_INVALID = 3001,
  VALUE_DATE_FORMAT_INVALID = 3002,
  VALUE_RANGE_FORMAT_INVALID = 3003,
  VALUE_RANGE_OPERATOR_INVALID = 3004,
  VALUE_RANGE_MISSING = 3005,
  VALUE_RANGE_START_EXCEEDS_END = 3006,
  VALUE_WILDCARD_NOT_PERMITTED = 3007,
  VALUE_BOOLEAN_INVALID = 3008,

  // Wildcard Errors (4000-4999)
  WILDCARD_POSITION_INVALID = 4001,
  WILDCARD_MULTIPLE_NOT_PERMITTED = 4002,

  // IN Expression Errors (5000-5999)
  IN_LIST_EMPTY = 5001,
  IN_VALUE_INVALID = 5002,
  IN_SEPARATOR_MISSING = 5003,
  IN_LPAREN_MISSING = 5004,
}

// Validation error type
export type ValidationError = {
  message: string;
  code: SearchQueryErrorCode;
  value?: string;
  position: number;
  length: number;
};

export const reservedWords = new Set(["AND", "OR"]);

const walkExpression = (
  expr: FirstPassExpression,
  errors: ValidationError[]
) => {
  switch (expr.type) {
    case "STRING":
    case "WILDCARD":
      validateString(expr, errors);
      break;
    case "AND":
    case "OR":
      walkExpression(expr.left, errors);
      walkExpression(expr.right, errors);
      break;
    case "NOT":
      walkExpression(expr.expression, errors);
      break;
    case "IN":
      validateInExpression(expr, errors);
      break;
  }
};

export const validateSearchQuery = (
  expression: FirstPassExpression
): ValidationError[] => {
  const errors: ValidationError[] = [];

  if (expression === null) {
    return errors;
  }

  walkExpression(expression, errors);

  return errors;
};
