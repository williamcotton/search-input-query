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

// Field validation helpers
const validateFieldValue = (
  expr: FirstPassExpression,
  allowedFields: Set<string>,
  errors: ValidationError[],
  schemas: Map<string, FieldSchema>
): void => {
  if (expr.type !== "STRING") return;

  const colonIndex = expr.value.indexOf(":");
  if (colonIndex === -1) return;

  const fieldName = expr.value.substring(0, colonIndex).trim();
  const value = expr.value.substring(colonIndex + 1).trim();

  if (!allowedFields.has(fieldName.toLowerCase()) && colonIndex > 0) {
    errors.push({
      message: `Invalid field: "${fieldName}"`,
      position: expr.position,
      length: colonIndex,
    });
    return;
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

  const schema = schemas.get(fieldName.toLowerCase());
  if (!schema) return; // No schema validation needed for unknown fields

  const valueStartPosition = expr.position + colonIndex + 1;

  if (schema.type === "number") {
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
