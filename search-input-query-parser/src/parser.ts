import { tokenize, createStream, currentToken, TokenType } from "./lexer";
import {
  parseExpression,
  PositionLength,
  WildcardPattern as FirstPassWildcard,
} from "./first-pass-parser";
import {
  validateSearchQuery,
  ValidationError,
  SearchQueryErrorCode,
} from "./validator";
import { validateExpressionFields } from "./validate-expression-fields";
import { transformToExpression } from "./transform-to-expression";

// Re-export these types from validator for backward compatibility
export { ValidationError, SearchQueryErrorCode };

// Schema types for range queries
export interface FieldSchema {
  name: string;
  type: "string" | "number" | "date" | "boolean";
  values?: string[]; // Optional array of predefined values for autocompletion
}

// Second Pass AST types (semantic analysis)
export type SearchTerm = {
  readonly type: "SEARCH_TERM";
  readonly value: string;
} & PositionLength;

export type WildcardPattern = {
  readonly type: "WILDCARD";
  readonly prefix: string;
  readonly quoted: boolean;
} & PositionLength;

export type Field = {
  readonly type: "FIELD";
  readonly value: string;
} & PositionLength;

export type Value = {
  readonly type: "VALUE";
  readonly value: string;
} & PositionLength;

export type RangeOperator = ">=" | ">" | "<=" | "<" | "BETWEEN";

export type RangeExpression = {
  readonly type: "RANGE";
  readonly field: Field;
  readonly operator: RangeOperator;
  readonly value: Value;
  readonly value2?: Value; // For BETWEEN
} & PositionLength;

export type FieldValue = {
  readonly type: "FIELD_VALUE";
  readonly field: Field;
  readonly value: Value;
};

export type And = {
  readonly type: "AND";
  readonly left: Expression;
  readonly right: Expression;
} & PositionLength;

export type Or = {
  readonly type: "OR";
  readonly left: Expression;
  readonly right: Expression;
} & PositionLength;

export type Not = {
  readonly type: "NOT";
  readonly expression: Expression;
} & PositionLength;

export type InExpression = {
  readonly type: "IN";
  readonly field: Field;
  readonly values: Value[];
} & PositionLength;

export type SortColumn = {
  readonly column: string;
  readonly direction: "asc" | "desc";
};

export type OrderByExpression = {
  readonly type: "ORDER_BY";
  readonly columns: SortColumn[];
} & PositionLength;

export type Expression =
  | SearchTerm
  | WildcardPattern
  | FieldValue
  | RangeExpression
  | And
  | Or
  | Not
  | InExpression
  | OrderByExpression;

export type SearchQuery = {
  readonly type: "SEARCH_QUERY";
  readonly expression: Expression | null;
};

export type SearchQueryError = {
  readonly type: "SEARCH_QUERY_ERROR";
  readonly expression: null;
  readonly errors: ValidationError[];
};

// Helper function to stringify expressions
export const stringify = (expr: Expression): string => {
  switch (expr.type) {
    case "SEARCH_TERM":
      return expr.value;
    case "WILDCARD":
      return `${expr.prefix}*`;
    case "FIELD_VALUE":
      return `${expr.field.value}:${expr.value.value}`;
    case "RANGE":
      if (expr.operator === "BETWEEN") {
        return `${expr.field.value}:${expr.value.value}..${expr.value2?.value}`;
      }
      return `${expr.field.value}:${expr.operator}${expr.value.value}`;
    case "NOT":
      return `NOT (${stringify(expr.expression)})`;
    case "AND":
      return `(${stringify(expr.left)} AND ${stringify(expr.right)})`;
    case "OR":
      return `(${stringify(expr.left)} OR ${stringify(expr.right)})`;
    case "IN": {
      const values = expr.values.map((v: { value: string }) => v.value).join(",");
      return `${expr.field.value}:IN(${values})`;
    }
    case "ORDER_BY": {
      const columns = expr.columns.map(col => `${col.column} ${col.direction}`).join(", ");
      return `orderby:${columns}`;
    }
    default:
      // This should never happen if all Expression types are handled
      const exhaustiveCheck: never = expr;
      throw new Error(`Unhandled expression type: ${(exhaustiveCheck as any).type}`);
  }
};

// Validation function to ensure orderby is the last expression
const validateOrderByPosition = (expr: Expression | null): ValidationError[] => {
  const errors: ValidationError[] = [];
  
  if (!expr) return errors;
  
  // Check if there's an orderby anywhere that's not at the top level
  const findOrderBy = (expression: Expression, inSubExpression: boolean = false): void => {
    switch (expression.type) {
      case "ORDER_BY":
        if (inSubExpression) {
          errors.push({
            message: "orderby can only be used at the end of the query",
            code: SearchQueryErrorCode.FIELD_NAME_INVALID,
            position: expression.position,
            length: expression.length,
          });
        }
        break;
      case "AND":
        // In AND expressions, orderby can only be on the right side
        findOrderBy(expression.left, true);
        findOrderBy(expression.right, false);
        break;
      case "OR":
        // orderby cannot be in OR expressions
        findOrderBy(expression.left, true);
        findOrderBy(expression.right, true);
        break;
      case "NOT":
        findOrderBy(expression.expression, true);
        break;
    }
  };
  
  findOrderBy(expr);
  return errors;
};

// Main parse function
export const parseSearchInputQuery = (
  input: string,
  fieldSchemas: FieldSchema[] = []
): SearchQuery | SearchQueryError => {
  try {
    const tokens = tokenize(input);
    const stream = createStream(tokens);

    if (currentToken(stream).type === TokenType.EOF) {
      return { type: "SEARCH_QUERY", expression: null };
    }

    const result = parseExpression(stream);

    const finalToken = currentToken(result.stream);
    if (finalToken.type !== TokenType.EOF) {
      throw {
        message: 'Unexpected ")"',
        code: SearchQueryErrorCode.SYNTAX_PARENTHESIS_UNEXPECTED,
        position: finalToken.position,
        length: finalToken.length,
      };
    }

    const errors = validateSearchQuery(result.result);
    const fieldErrors: ValidationError[] = [];

    const allowedFields = fieldSchemas.map((s) => s.name.toLowerCase());

    if (allowedFields.length > 0) {
      const columnSet = new Set(allowedFields.map((col) => col.toLowerCase()));
      const schemaMap = new Map(
        fieldSchemas.map((s) => [s.name.toLowerCase(), s])
      );
      validateExpressionFields(
        result.result,
        columnSet,
        fieldErrors,
        schemaMap
      );
    }

    const fieldErrorKeys = fieldErrors.map(
      ({ position, length }) => `${position}-${length}`
    );
    const errorsToRemove = errors.filter(({ position, length }) =>
      fieldErrorKeys.includes(`${position}-${length}`)
    );
    const fieldErrorsFiltered = fieldErrors.filter(
      ({ position, length }) =>
        !errorsToRemove.some(
          (error) => error.position === position && error.length === length
        )
    );

    const allErrors = [...errors, ...fieldErrorsFiltered].sort(
      (a, b) => a.position - b.position
    );

    if (allErrors.length > 0) {
      return {
        type: "SEARCH_QUERY_ERROR",
        expression: null,
        errors: allErrors,
      };
    }

    const schemaMap = new Map(
      fieldSchemas.map((s) => [s.name.toLowerCase(), s])
    );
    const expression = transformToExpression(result.result, schemaMap);

    // Validate orderby position
    const orderByErrors = validateOrderByPosition(expression);
    if (orderByErrors.length > 0) {
      return {
        type: "SEARCH_QUERY_ERROR",
        expression: null,
        errors: orderByErrors,
      };
    }

    return { type: "SEARCH_QUERY", expression };
  } catch (error: any) {
    return {
      type: "SEARCH_QUERY_ERROR",
      expression: null,
      errors: [error],
    };
  }
};

