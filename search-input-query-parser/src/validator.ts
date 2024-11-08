import { StringLiteral, FirstPassExpression } from "./first-pass-parser";

// Validation error type
export type ValidationError = {
  message: string;
  position: number;
  length: number;
};

const reservedWords = new Set(["AND", "OR"]);

// Helper function to validate wildcard patterns
const validateWildcard = (
  value: string,
  position: number,
  expr: StringLiteral
): ValidationError | null => {
  // Check if this is a field:value pair
  if (expr.value.includes(":")) {
    const [field, ...valueParts] = expr.value.split(":");
    const valueText = valueParts.join(":"); // Rejoin in case value contained colons

    // If this came from a quoted field value, any * is valid
    if (field.toLowerCase() === field) {
      // Simple heuristic - field names don't include spaces
      return null; // This was a quoted value
    }
  } else if (expr.quoted) {
    return null; // Allow * within standalone quoted strings
  }

  const starCount = (value.match(/\*/g) || []).length;
  if (starCount > 1) {
    const firstStar = value.indexOf("*");
    const secondStar = value.indexOf("*", firstStar + 1);
    return {
      message: "Only one wildcard (*) is allowed per term",
      position: position + secondStar,
      length: 1,
    };
  }

  if (starCount === 1 && !value.endsWith("*")) {
    const starPosition = value.indexOf("*");
    return {
      message: "Wildcard (*) can only appear at the end of a term",
      position: position + starPosition,
      length: 1,
    };
  }

  return null;
};

// Validate individual strings (field:value pairs or plain terms)
const validateString = (expr: StringLiteral, errors: ValidationError[]) => {
  const wildcardError = validateWildcard(expr.value, expr.position, expr);
  if (wildcardError) {
    errors.push(wildcardError);
    return;
  }

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
      validateString(expr, errors);
      break;
    case "AND":
    case "OR":
      walkExpression(expr.left, errors);
      walkExpression(expr.right, errors);
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
