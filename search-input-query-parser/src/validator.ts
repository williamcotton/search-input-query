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

// Validates wildcard patterns
const validateWildcard = (
  expr: StringLiteral | WildcardPattern,
  errors: ValidationError[]
) => {
  const value = expr.type === "STRING" ? expr.value : expr.prefix + "*";
  const starCount = (value.match(/\*/g) || []).length;
  const isQuoted = expr.quoted;

  // For unquoted strings
  if (!isQuoted) {
    const firstStar = value.indexOf("*");
    if (starCount > 1) {
      const secondStar = value.indexOf("*", firstStar + 1);
      errors.push({
        message: "Only one trailing wildcard (*) is allowed",
        position: expr.position + secondStar,
        length: 1,
      });
    } 
    if ((firstStar !== -1 && firstStar !== value.length - 1) && !value.endsWith("**")) {
      errors.push({
        message: "Wildcard (*) can only appear at the end of a term",
        position: expr.position + firstStar,
        length: 1,
      });
    }
  }
  // For quoted strings
  else {
    // Handle multiple wildcards or internal wildcards in quoted strings
    if (value.endsWith("**")) {
      errors.push({
        message: "Only one trailing wildcard (*) is allowed",
        position: expr.position + value.length + 1,
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
  // Validate wildcard usage
  validateWildcard(expr, errors);

  // For wildcard patterns, no additional validation needed
  if (expr.type === "WILDCARD") {
    return;
  }

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
  if (
    !expr.value.includes(":") &&
    reservedWords.has(expr.value.toUpperCase())
  ) {
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
