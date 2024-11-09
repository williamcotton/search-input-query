import {
  FirstPassExpression,
} from "./first-pass-parser";

import { FieldSchema } from "./parser";
import { validateInExpression } from "./validate-in-expression";
import { validateString } from "./validate-string";

// Validation error type
export type ValidationError = {
  message: string;
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
