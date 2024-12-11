import { FieldSchema } from "./parser";
import { FirstPassExpression } from "./first-pass-parser";
import { ValidationError, SearchQueryErrorCode } from "./validator";

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
      code: SearchQueryErrorCode.VALUE_NUMERIC_INVALID,
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

  if (isValid && start && end) {
    const startNum = Number(start);
    const endNum = Number(end);
    if (startNum > endNum) {
      errors.push({
        message: "Range start must be less than or equal to range end",
        code: SearchQueryErrorCode.VALUE_RANGE_START_EXCEEDS_END,
        position: basePosition,
        length: start.length + 2 + end.length,
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
  switch (expr.type) {
    case "IN": {
      if (!allowedFields.has(expr.field.toLowerCase())) {
        errors.push({
          message: `Invalid field: "${expr.field}"`,
          code: SearchQueryErrorCode.FIELD_NAME_INVALID,
          value: expr.field,
          position: expr.position,
          length: expr.field.length,
        });
      }

      // Get schema for type validation
      const schema = schemas.get(expr.field.toLowerCase());
      if (schema) {
        expr.values.forEach((value, index) => {
          switch (schema.type) {
            case "number":
              if (isNaN(Number(value))) {
                errors.push({
                  message: "Invalid numeric value",
                  code: SearchQueryErrorCode.VALUE_NUMERIC_INVALID,
                  position:
                    expr.position +
                    expr.field.length +
                    4 +
                    index * (value.length + 1),
                  length: value.length,
                });
              }
              break;
            case "date":
              if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
                errors.push({
                  message: "Invalid date format",
                  code: SearchQueryErrorCode.VALUE_DATE_FORMAT_INVALID,
                  position:
                    expr.position +
                    expr.field.length +
                    3 +
                    index * (value.length + 1),
                  length: value.length,
                });
              }
              break;
          }
        });
      }
      break;
    }

    case "WILDCARD": {
      // For wildcard patterns, validate against field type constraints
      const schema = schemas.get(expr.prefix.toLowerCase());
      if (schema?.type === "number" || schema?.type === "date") {
        errors.push({
          code: SearchQueryErrorCode.VALUE_WILDCARD_NOT_PERMITTED,
          value: schema.type,
          message: `Wildcards are not allowed for ${schema.type} fields`,
          position: expr.position,
          length: expr.length,
        });
      }
      break;
    }

    case "STRING": {
      const colonIndex = expr.value.indexOf(":");
      if (colonIndex === -1) return;

      const fieldName = expr.value.substring(0, colonIndex).trim();
      const value = expr.value.substring(colonIndex + 1).trim();

      if (!allowedFields.has(fieldName.toLowerCase()) && colonIndex > 0) {
        errors.push({
          message: `Invalid field: "${fieldName}"`,
          code: SearchQueryErrorCode.FIELD_NAME_INVALID,
          value: fieldName,
          position: expr.position,
          length: colonIndex,
        });
      }

      if (!value) {
        errors.push({
          message: "Expected field value",
          code: SearchQueryErrorCode.SYNTAX_VALUE_MISSING,
          position: expr.position,
          length: colonIndex + 1,
        });
        return;
      }

      if (value.startsWith(":")) {
        errors.push({
          message: "Missing field name",
          code: SearchQueryErrorCode.SYNTAX_FIELD_NAME_MISSING,
          position: expr.position,
          length: value.length + colonIndex + 1,
        });
        return;
      }

      const schema = schemas.get(fieldName.toLowerCase());
      if (!schema) return;

      const valueStartPosition = expr.position + colonIndex + 1;

      if (schema.type === "number") {
        if (value.includes("..")) {
          if (value === ".." || value.includes("...")) {
            errors.push({
              message: "Invalid range format",
              code: SearchQueryErrorCode.VALUE_RANGE_FORMAT_INVALID,
              position: valueStartPosition,
              length: value.length,
            });
            return;
          }

          const [start, end] = value.split("..");
          validateNumericRange(start, end, valueStartPosition, errors);
          return;
        }

        const comparisonMatch = value.match(/^(>=|>|<=|<)(.*)$/);
        if (comparisonMatch) {
          const [, operator, compValue] = comparisonMatch;

          const invalidOp = /^[<>]{2,}|>=>/;
          if (invalidOp.test(value)) {
            errors.push({
              message: "Invalid range operator",
              code: SearchQueryErrorCode.VALUE_RANGE_OPERATOR_INVALID,
              position: valueStartPosition,
              length: 3,
            });
            return;
          }

          if (!compValue) {
            errors.push({
              message: "Expected range value",
              code: SearchQueryErrorCode.VALUE_RANGE_MISSING,
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

        validateNumber(value, valueStartPosition, errors);
        return;
      }

      if (schema.type === "date") {
        const dateValidator = (dateStr: string) => {
          if (!dateStr) return true;
          if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
            return false;
          }
          const date = new Date(dateStr);
          return (
            !isNaN(date.getTime()) &&
            dateStr === date.toISOString().split("T")[0]
          );
        };

        if (value.includes("..")) {
          const [start, end] = value.split("..");
          if (!dateValidator(start) || !dateValidator(end)) {
            errors.push({
              message: "Invalid date format",
              code: SearchQueryErrorCode.VALUE_DATE_FORMAT_INVALID,
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
                code: SearchQueryErrorCode.VALUE_DATE_FORMAT_INVALID,
                position: valueStartPosition,
                length: value.length,
              });
              return;
            }
          } else if (!dateValidator(value)) {
            errors.push({
              message: "Invalid date format",
              code: SearchQueryErrorCode.VALUE_DATE_FORMAT_INVALID,
              position: valueStartPosition,
              length: value.length,
            });
            return;
          }
        }
      }
      break;
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
    case "WILDCARD":
    case "IN":
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
