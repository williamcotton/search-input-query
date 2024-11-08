import { FieldSchema } from "./parser";
import { FirstPassExpression } from "./first-pass-parser";
import { ValidationError } from "./validator";

// Helper to validate numeric values
const validateNumber = (
  value: string,
  position: number,
  errors: ValidationError[]
): boolean => {
  if (value === "") return false;
  if (isNaN(Number(value))) {
    errors.push({
      message: "Invalid numeric value",
      position,
      length: value.length,
    });
    return false;
  }
  return true;
};

// Helper to validate range values for numeric fields
const validateNumericRange = (
  start: string,
  end: string,
  basePosition: number,
  errors: ValidationError[]
): boolean => {
  let isValid = true;
  const startPos = basePosition;
  const endPos = basePosition + start.length + 2; // +2 for the '..'

  if (start && !validateNumber(start, startPos, errors)) {
    isValid = false;
  }
  if (end && !validateNumber(end, endPos, errors)) {
    isValid = false;
  }

  // Additional validation: ensure start <= end if both are valid numbers
  if (isValid && start && end) {
    const startNum = Number(start);
    const endNum = Number(end);
    if (startNum > endNum) {
      errors.push({
        message: "Range start must be less than or equal to range end",
        position: basePosition,
        length: start.length + 2 + end.length, // total length including '..'
      });
      isValid = false;
    }
  }

  return isValid;
};

// Helper to validate numeric comparison operators
const validateNumericComparison = (
  operator: string,
  value: string,
  basePosition: number,
  errors: ValidationError[]
): boolean => {
  const valuePosition = basePosition + operator.length;
  return validateNumber(value, valuePosition, errors);
};

// Helper to check if a string is a valid wildcard pattern
const isValidWildcardPattern = (value: string, quoted: boolean): boolean => {
  // If it's marked as quoted, any wildcards are valid
  if (quoted) {
    // But only allow at most one trailing wildcard
    if (value.endsWith("*")) {
      // Check for multiple trailing wildcards
      const lastNonWildcard = value.lastIndexOf("*", value.length - 2);
      if (lastNonWildcard === value.length - 2) {
        return false; // Multiple trailing wildcards
      }
    }
    return true;
  }

  // For unquoted strings, only allow wildcard at the end
  if (value.includes("*")) {
    return value.indexOf("*") === value.length - 1;
  }

  // If no wildcard, it's valid
  return true;
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
  if (colonIndex === -1) {
    // For non-field values, validate wildcard pattern
    if (!isValidWildcardPattern(expr.value, expr.quoted)) {
      errors.push({
        message:
          "Invalid wildcard pattern. Wildcard (*) can only appear at the end.",
        position: expr.position,
        length: expr.value.length,
      });
    }
    return;
  }

  const fieldName = expr.value.substring(0, colonIndex).trim();
  const value = expr.value.substring(colonIndex + 1).trim();

  if (!allowedFields.has(fieldName.toLowerCase()) && colonIndex > 0) {
    errors.push({
      message: `Invalid field: "${fieldName}"`,
      position: expr.position,
      length: colonIndex,
    });
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

  // Validate wildcard pattern for the value
  if (!isValidWildcardPattern(value, expr.quoted)) {
    console.log(expr)
    errors.push({
      message:
        "Invalid wildcard pattern. Wildcards (*) are allowed inside quoted strings and at most one wildcard is allowed at the end.",
      position: expr.position + colonIndex + 1,
      length: value.length,
    });
    return;
  }

  const schema = schemas.get(fieldName.toLowerCase());
  if (!schema) return; // No schema validation needed for unknown fields

  const valueStartPosition = expr.position + colonIndex + 1;

  if (schema.type === "number") {
    // Don't allow wildcards for numeric fields
    if (value.includes("*")) {
      errors.push({
        message: "Wildcards are not allowed for numeric fields",
        position: valueStartPosition,
        length: value.length,
      });
      return;
    }

    // Handle range queries first (e.g., 10..20, ..20, 10..)
    if (value.includes("..")) {
      // Validate range format
      if (value === ".." || value.includes("...")) {
        errors.push({
          message: "Invalid range format",
          position: valueStartPosition,
          length: value.length,
        });
        return;
      }

      const [start, end] = value.split("..");
      validateNumericRange(start, end, valueStartPosition, errors);
      return;
    }

    // Handle comparison operators (>, >=, <, <=)
    const comparisonMatch = value.match(/^(>=|>|<=|<)(.*)$/);
    if (comparisonMatch) {
      const [, operator, compValue] = comparisonMatch;

      // Validate operator format
      const invalidOp = /^[<>]{2,}|>=>/;
      if (invalidOp.test(value)) {
        errors.push({
          message: "Invalid range operator",
          position: valueStartPosition,
          length: 3,
        });
        return;
      }

      // Check for empty comparison value
      if (!compValue) {
        errors.push({
          message: "Expected range value",
          position: valueStartPosition + operator.length,
          length: 0,
        });
        return;
      }

      validateNumericComparison(
        operator,
        compValue,
        valueStartPosition,
        errors
      );
      return;
    }

    // Simple numeric value
    validateNumber(value, valueStartPosition, errors);
    return;
  }

  // Date validation logic remains the same
  if (schema.type === "date") {
    // Don't allow wildcards for date fields
    if (value.includes("*")) {
      errors.push({
        message: "Wildcards are not allowed for date fields",
        position: valueStartPosition,
        length: value.length,
      });
      return;
    }

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
          position: valueStartPosition,
          length: value.length,
        });
        return;
      }
    } else {
      const comparisonMatch = value.match(/^(>=|>|<=|<)(.*)$/);
      if (comparisonMatch) {
        const [, , dateStr] = comparisonMatch;
        if (!dateValidator(dateStr)) {
          errors.push({
            message: "Invalid date format",
            position: valueStartPosition,
            length: value.length,
          });
          return;
        }
      } else if (!dateValidator(value)) {
        errors.push({
          message: "Invalid date format",
          position: valueStartPosition,
          length: value.length,
        });
        return;
      }
    }
  }
};

export const validateExpressionFields = (
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
