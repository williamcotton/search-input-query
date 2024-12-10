import {
  FirstPassExpression,
} from "./first-pass-parser";

import { FieldSchema } from "./parser";
import { validateInExpression } from "./validate-in-expression";
import { validateString } from "./validate-string";

export enum SearchQueryErrorCode {
  UNKNOWN_ERROR = 0,

  // Syntax Errors (1000-1999)
  UNTERMINATED_QUOTED_STRING = 1001,
  EXPECTED_FIELD_VALUE = 1002,
  MISSING_FIELD_NAME = 1003,
  MISSING_FIELD_VALUE = 1004,
  UNEXPECTED_RIGHT_PAREN = 1005,
  EXPECTED_RIGHT_PAREN = 1006,
  UNEXPECTED_TOKEN = 1007,
  EXPECTED_TOKEN = 1008,
  MISSING_OPERATOR_OR_WHITESPACE = 1009,
  RESERVED_WORD = 1010,

  // Field Validation Errors (2000-2999)
  INVALID_FIELD_NAME = 2001,
  INVALID_FIELD_CHARS = 2002,
  RESERVED_WORD_AS_FIELD = 2003,

  // Value Validation Errors (3000-3999)
  INVALID_NUMERIC_VALUE = 3001,
  INVALID_DATE_FORMAT = 3002,
  INVALID_RANGE_FORMAT = 3003,
  INVALID_RANGE_OPERATOR = 3004,
  EXPECTED_RANGE_VALUE = 3005,
  RANGE_START_GREATER_THAN_END = 3006,
  WILDCARD_NOT_ALLOWED = 3007,

  // Wildcard Errors (4000-4999)
  INVALID_WILDCARD_POSITION = 4001,
  MULTIPLE_WILDCARDS = 4002,

  // IN Expression Errors (5000-5999)
  EMPTY_IN_LIST = 5001,
  INVALID_IN_VALUE = 5002,
  EXPECTED_IN_SEPARATOR = 5003,
  EXPECTED_LPAREN_AFTER_IN = 5004,
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
