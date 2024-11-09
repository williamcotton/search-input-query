import { InExpression } from "./first-pass-parser";
import { ValidationError, reservedWords } from "./validator";

export const validateInExpression = (
  expr: InExpression,
  errors: ValidationError[]
): void => {
  // Validate field name pattern
  if (!/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(expr.field)) {
    errors.push({
      message: "Invalid characters in field name",
      position: expr.position,
      length: expr.field.length,
    });
  }

  // Check for reserved words
  if (reservedWords.has(expr.field.toUpperCase())) {
    errors.push({
      message: `${expr.field} is a reserved word`,
      position: expr.position,
      length: expr.field.length,
    });
  }

  // Validate value format based on field type
  expr.values.forEach((value, index) => {
    if (value.includes(",")) {
      errors.push({
        message: "Invalid character in IN value",
        position: expr.position + expr.field.length + 3 + index * (value.length + 1),
        length: value.length,
      });
    }
  });
};
