import { StringLiteral, WildcardPattern } from "./first-pass-parser";
import { ValidationError, reservedWords } from "./validator";
import { validateWildcard } from "./validate-wildcard";

// Validate individual strings (field:value pairs or plain terms)
export const validateString = (
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
  if (!expr.value.includes(":") &&
    reservedWords.has(expr.value.toUpperCase())) {
    errors.push({
      message: `${expr.value} is a reserved word`,
      position: expr.position,
      length: expr.length,
    });
  }
};
