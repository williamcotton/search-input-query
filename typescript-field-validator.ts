import { Expression, SearchQuery } from "./typescript-expression-fields-parser";

export interface ValidationError {
  field: string;
  message: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
}

const createFieldError = (
  field: string,
  allowedColumns: Set<string>
): ValidationError => ({
  field,
  message: `Invalid field: "${field}". Allowed fields are: ${[
    ...allowedColumns,
  ].join(", ")}`,
});

const validateField = (
  field: string,
  allowedColumns: Set<string>
): ValidationError[] => {
  if (!allowedColumns.has(field.toLowerCase())) {
    return [createFieldError(field, allowedColumns)];
  }
  return [];
};

const validateExpression = (
  expr: Expression,
  allowedColumns: Set<string>
): ValidationError[] => {
  switch (expr.type) {
    case "FIELD":
      return validateField(expr.key, allowedColumns);
    case "AND":
    case "OR":
      return [
        ...validateExpression(expr.left, allowedColumns),
        ...validateExpression(expr.right, allowedColumns),
      ];
    case "TERM":
      return [];
  }
};

export const validate = (
  query: SearchQuery,
  columns: string[]
): ValidationResult => {
  const allowedColumns = new Set(columns.map((col) => col.toLowerCase()));

  if (!query.expression) {
    return { isValid: true, errors: [] };
  }

  const errors = validateExpression(query.expression, allowedColumns);
  return {
    isValid: errors.length === 0,
    errors,
  };
};

// Example usage:
const testValidation = () => {
  const columns = ["title", "description", "category", "status"];

  const validQuery: SearchQuery = {
    expression: {
      type: "AND",
      left: {
        type: "FIELD",
        key: "category",
        value: "books",
      },
      right: {
        type: "OR",
        left: {
          type: "FIELD",
          key: "status",
          value: "active",
        },
        right: {
          type: "TERM",
          value: "fiction",
        },
      },
    },
  };

  const invalidQuery: SearchQuery = {
    expression: {
      type: "AND",
      left: {
        type: "FIELD",
        key: "invalid_field",
        value: "test",
      },
      right: {
        type: "FIELD",
        key: "category",
        value: "books",
      },
    },
  };

  console.log("Valid query validation:", validate(validQuery, columns));
  console.log("Invalid query validation:", validate(invalidQuery, columns));
};
