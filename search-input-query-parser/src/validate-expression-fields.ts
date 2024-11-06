import { FieldSchema } from "./parser";
import {
  FirstPassExpression,
} from "./first-pass-parser";
import { ValidationError } from "./validator";

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

  // First validate range operators
  if (value.startsWith(">") || value.startsWith("<")) {
    const invalidOp = /^[<>]{2,}|>=>/;
    if (invalidOp.test(value)) {
      errors.push({
        message: "Invalid range operator",
        position: expr.position + colonIndex + 1,
        length: 3,
      });
      return;
    }
  }

  // Then check for malformed range patterns
  if (value === ".." || value.includes("...")) {
    errors.push({
      message: "Invalid range format",
      position: expr.position + colonIndex + 1,
      length: value.length,
    });
    return;
  }

  // Check for empty range values
  const rangeOp = /^(>=|>|<=|<|\.\.)/;
  const match = value.match(rangeOp);
  if (match && !value.substring(match[1].length)) {
    errors.push({
      message: "Expected range value",
      position: expr.position + colonIndex + 1 + match[1].length,
      length: 0,
    });
    return;
  }

  const schema = schemas.get(fieldName.toLowerCase());
  if (schema) {
    if (schema.type === "number") {
      if (value.includes("..")) {
        const [start, end] = value.split("..");
        if ((start && isNaN(Number(start))) || (end && isNaN(Number(end)))) {
          errors.push({
            message: "Invalid numeric value",
            position: expr.position + colonIndex + 1,
            length: value.length,
          });
          return;
        }
      } else if (match && isNaN(Number(value.substring(match[1].length)))) {
        errors.push({
          message: "Invalid numeric value",
          position: expr.position + colonIndex + 1 + match[1].length,
          length: value.length - match[1].length,
        });
        return;
      }
    } else if (schema.type === "date") {
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
            position: expr.position + colonIndex + 1,
            length: value.length,
          });
          return;
        }
      } else if (match && !dateValidator(value.substring(match[1].length))) {
        errors.push({
          message: "Invalid date format",
          position: expr.position + colonIndex + 1,
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
