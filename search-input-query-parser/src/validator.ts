import {
  FirstPassExpression,
  StringLiteral,
  WildcardPattern,
} from "./first-pass-parser";

// Validation error type
export type ValidationError = {
  message: string;
  position: number;
  length: number;
};

const reservedWords = new Set(["AND", "OR"]);

// Helper function to validate wildcard patterns
const validateWildcard = (
  expr: StringLiteral | WildcardPattern,
  errors: ValidationError[]
) => {
  if (expr.type === "STRING") {
    const starCount = (expr.value.match(/\*/g) || []).length;
    if (starCount > 1) {
      const firstStar = expr.value.indexOf("*");
      const secondStar = expr.value.indexOf("*", firstStar + 1);
      errors.push({
        message: "Only one wildcard (*) is allowed per term",
        position: expr.position + secondStar,
        length: 1,
      });
    }
  }
};

// Validate individual strings (field:value pairs or plain terms)
const validateString = (
  expr: StringLiteral | WildcardPattern,
  errors: ValidationError[]
) => {
  // For wildcard patterns, additional validation if needed
  if (expr.type === "WILDCARD") {
    return; // Basic wildcard validation is handled at parse time
  }

  // Check for multiple wildcards in the string
  validateWildcard(expr, errors);

  // Handle STRING type
  // Check for empty field values
  if (expr.value.endsWith(":")) {
    errors.push({
      message: "Expected field value",
      position: expr.position,
      length: expr.length,
    });
    return;
  }

  // Check for field values that start with colon
  if (expr.value.startsWith(":")) {
    errors.push({
      message: "Missing field name",
      position: expr.position,
      length: expr.length,
    });
    return;
  }

  // For field:value patterns, validate the field name
  if (expr.value.includes(":")) {
    const [fieldName] = expr.value.split(":");

    // Check for reserved words used as field names
    if (reservedWords.has(fieldName.toUpperCase())) {
      errors.push({
        message: `${fieldName} is a reserved word`,
        position: expr.position,
        length: fieldName.length,
      });
      return;
    }

    // Check for invalid characters in field names
    if (!/^[a-zA-Z0-9_-]+$/.test(fieldName)) {
      errors.push({
        message: "Invalid characters in field name",
        position: expr.position,
        length: fieldName.length,
      });
      return;
    }
  }

  // Handle standalone reserved words (not in field:value pattern)
  if (!expr.value.includes(":") && reservedWords.has(expr.value)) {
    errors.push({
      message: `${expr.value} is a reserved word`,
      position: expr.position,
      length: expr.length,
    });
  }
};

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