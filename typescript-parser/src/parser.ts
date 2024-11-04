import { tokenize, createStream, currentToken, TokenType } from "./lexer";
import { parseExpression, PositionLength, FirstPassExpression } from "./first-pass-parser";
import { validateSearchQuery, ValidationError } from "./validator";

// Second Pass AST types (semantic analysis)
type SearchTerm = {
  readonly type: "SEARCH_TERM";
  readonly value: string;
} & PositionLength;

type FieldValue = {
  readonly type: "FIELD_VALUE";
  readonly field: string;
  readonly value: string;
  readonly fieldPosition: number;
  readonly fieldLength: number;
  readonly valuePosition: number;
  readonly valueLength: number;
} 

type And = {
  readonly type: "AND";
  readonly left: Expression;
  readonly right: Expression;
} & PositionLength;

type Or = {
  readonly type: "OR";
  readonly left: Expression;
  readonly right: Expression;
} & PositionLength;

type Expression = SearchTerm | FieldValue | And | Or;

type SearchQuery = {
  readonly type: "SEARCH_QUERY";
  readonly expression: Expression | null;
};

type SearchQueryError = {
  readonly type: "SEARCH_QUERY_ERROR";
  readonly expression: null;
  readonly errors: ValidationError[];
};

// Helper function to stringify expressions
const stringify = (expr: Expression): string => {
  switch (expr.type) {
    case "SEARCH_TERM":
      return expr.value.includes(" ") ? `"${expr.value}"` : expr.value;
    case "FIELD_VALUE":
      return `${expr.field}:${expr.value}`;
    case "AND":
      return `(${stringify(expr.left)} AND ${stringify(expr.right)})`;
    case "OR":
      return `(${stringify(expr.left)} OR ${stringify(expr.right)})`;
  }
};

// Helper to transform FirstPassExpression into Expression
const transformToExpression = (expr: FirstPassExpression): Expression => {
  switch (expr.type) {
    case "STRING": {
      // Check if the string is a field:value pattern
      const colonIndex = expr.value.indexOf(':');
      if (colonIndex !== -1) {
        const field = expr.value.substring(0, colonIndex).trim();
        const value = expr.value.substring(colonIndex + 1).trim();
        // Remove quotes if present
        const cleanValue = value.startsWith('"') && value.endsWith('"') 
          ? value.slice(1, -1)
          : value;

        return {
          type: "FIELD_VALUE",
          field,
          value: cleanValue,
          fieldPosition: expr.position,
          fieldLength: colonIndex,
          valuePosition: expr.position + colonIndex + 1,
          valueLength: value.length
        };
      }
      
      return {
        type: "SEARCH_TERM",
        value: expr.value,
        position: expr.position,
        length: expr.length
      };
    }

    case "AND":
      return {
        type: "AND",
        left: transformToExpression(expr.left),
        right: transformToExpression(expr.right),
        position: expr.position,
        length: expr.length
      };

    case "OR":
      return {
        type: "OR",
        left: transformToExpression(expr.left),
        right: transformToExpression(expr.right),
        position: expr.position,
        length: expr.length
      };
  }
};

// Main parse function
const parseSearchQuery = (input: string): SearchQuery | SearchQueryError => {
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
        position: finalToken.position,
        length: finalToken.length,
      };
    }

    const errors = validateSearchQuery(result.result);

    if (errors.length > 0) {
      return {
        type: "SEARCH_QUERY_ERROR",
        expression: null,
        errors: errors,
      };
    }

    const expression = transformToExpression(result.result);

    return { type: "SEARCH_QUERY", expression };
  } catch (error: any) {
    return {
      type: "SEARCH_QUERY_ERROR",
      expression: null,
      errors: [error]
    };
  }
};

export {
  parseSearchQuery,
  stringify,
  type SearchQuery,
  type SearchQueryError,
  type Expression,
  type ValidationError
};
