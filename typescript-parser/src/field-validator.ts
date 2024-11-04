import { Expression, SearchQuery } from "./parser";

export interface ValidationError {
  field: string;
  message: string;
  position: number;
  length: number;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
}

const createFieldError = (
  field: string,
  position: number,
  length: number,
  allowedColumns: Set<string>
): ValidationError => ({
  field,
  message: `Invalid field: "${field}". Allowed fields are: ${[
    ...allowedColumns,
  ].join(", ")}`,
  position,
  length,
});

const validateFieldValue = (
  expr: Expression,
  allowedColumns: Set<string>
): ValidationError[] => {
  if (expr.type !== "FIELD_VALUE") {
    return [];
  }

  const field = expr.field.value;
  if (!allowedColumns.has(field.toLowerCase())) {
    return [
      createFieldError(
        field,
        expr.field.position,
        expr.field.length,
        allowedColumns
      ),
    ];
  }
  return [];
};

const validateExpressionFields = (
  expr: Expression,
  allowedColumns: Set<string>
): ValidationError[] => {
  switch (expr.type) {
    case "FIELD_VALUE":
      return validateFieldValue(expr, allowedColumns);
    case "AND":
    case "OR":
      return [
        ...validateExpressionFields(expr.left, allowedColumns),
        ...validateExpressionFields(expr.right, allowedColumns),
      ];
    case "SEARCH_TERM":
      return [];
  }
};

export const validateFields = (
  query: SearchQuery,
  columns: string[]
): ValidationResult => {
  const allowedColumns = new Set(columns.map((col) => col.toLowerCase()));

  if (!query.expression) {
    return { isValid: true, errors: [] };
  }

  const errors = validateExpressionFields(query.expression, allowedColumns);
  return {
    isValid: errors.length === 0,
    errors,
  };
};
