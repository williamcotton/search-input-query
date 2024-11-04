import { Expression, SearchQuery, parseSearchQuery } from "./parser";
import { validateFields } from "./field-validator";

export interface SqlQueryResult {
  text: string;
  values: any[];
}

interface SqlState {
  paramCounter: number;
  values: any[];
  searchableColumns: string[];
}

// Constants
const SPECIAL_CHARS = ["%", "_"] as const;
const ESCAPE_CHAR = "\\";

// Helper Functions
const escapeRegExp = (str: string): string =>
  str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const escapeSpecialChars = (value: string): string =>
  SPECIAL_CHARS.reduce(
    (escaped, char) =>
      escaped.replace(new RegExp(escapeRegExp(char), "g"), ESCAPE_CHAR + char),
    value
  );

// Create a new parameter placeholder and update state
const nextParam = (state: SqlState): [string, SqlState] => {
  const paramName = `$${state.paramCounter}`;
  const newState = {
    ...state,
    paramCounter: state.paramCounter + 1,
  };
  return [paramName, newState];
};

// Add a value to the state and return updated state
const addValue = (state: SqlState, value: any): SqlState => ({
  ...state,
  values: [...state.values, value],
});

/**
 * Convert a search term to SQL ILIKE conditions
 */
const searchTermToSql = (
  value: string,
  state: SqlState
): [string, SqlState] => {
  const escapedTerm = escapeSpecialChars(value);
  const [paramName, newState] = nextParam(state);

  const conditions = state.searchableColumns.map(
    (column) => `${column} ILIKE ${paramName}`
  );

  return [
    `(${conditions.join(" OR ")})`,
    addValue(newState, `%${escapedTerm}%`),
  ];
};

/**
 * Handle special date fields
 */
const dateFieldToSql = (
  field: string,
  value: string,
  state: SqlState
): [string, SqlState] => {
  const [paramName, newState] = nextParam(state);
  return [`${field}::date = ${paramName}::date`, addValue(newState, value)];
};

/**
 * Handle ID fields
 */
const idFieldToSql = (
  field: string,
  value: string,
  state: SqlState
): [string, SqlState] => {
  const [paramName, newState] = nextParam(state);
  return [`${field} = ${paramName}`, addValue(newState, value)];
};

/**
 * Handle default field comparison using ILIKE
 */
const defaultFieldToSql = (
  field: string,
  value: string,
  state: SqlState
): [string, SqlState] => {
  const escapedValue = escapeSpecialChars(value);
  const [paramName, newState] = nextParam(state);
  return [
    `${field} ILIKE ${paramName}`,
    addValue(newState, `%${escapedValue}%`),
  ];
};

/**
 * Convert a field:value pair to SQL
 */
const fieldValueToSql = (
  field: string,
  value: string,
  state: SqlState
): [string, SqlState] => {
  switch (field.toLowerCase()) {
    case "date":
    case "timestamp":
      return dateFieldToSql(field, value, state);
    case "id":
    case "user_id":
      return idFieldToSql(field, value, state);
    default:
      return defaultFieldToSql(field, value, state);
  }
};

/**
 * Convert a binary operation (AND/OR) to SQL
 */
const binaryOpToSql = (
  operator: string,
  left: Expression,
  right: Expression,
  state: SqlState
): [string, SqlState] => {
  const [leftText, leftState] = expressionToSql(left, state);
  const [rightText, rightState] = expressionToSql(right, leftState);

  return [`(${leftText} ${operator} ${rightText})`, rightState];
};

/**
 * Convert a single expression to SQL
 */
const expressionToSql = (
  expr: Expression,
  state: SqlState
): [string, SqlState] => {
  switch (expr.type) {
    case "SEARCH_TERM":
      return searchTermToSql(expr.value, state);
    case "FIELD_VALUE":
      return fieldValueToSql(expr.field.value, expr.value.value, state);
    case "NOT":
      const [innerText, innerState] = expressionToSql(expr.expression, state);
      return [`NOT (${innerText})`, innerState];
    case "AND":
      return binaryOpToSql("AND", expr.left, expr.right, state);
    case "OR":
      return binaryOpToSql("OR", expr.left, expr.right, state);
    default:
      throw new Error(`Unknown expression type: ${(expr as any).type}`);
  }
};

/**
 * Convert a SearchQuery to a SQL WHERE clause
 */
export const searchQueryToSql = (
  query: SearchQuery,
  searchableColumns: string[]
): SqlQueryResult => {
  const initialState: SqlState = {
    paramCounter: 1,
    values: [],
    searchableColumns,
  };

  if (!query.expression) {
    return { text: "1=1", values: [] };
  }

  const [text, finalState] = expressionToSql(query.expression, initialState);
  return { text, values: finalState.values };
};

/**
 * Convert a search string directly to SQL
 */
export const searchStringToSql = (searchString: string): SqlQueryResult => {
  const query = parseSearchQuery(searchString);
  if (query.type === "SEARCH_QUERY_ERROR") {
    throw new Error(`Parse error: ${query.errors[0].message}`);
  }

  const validFields = ["color", "category", "date"];
  const searchableColumns = ["title", "description", "content", "name"];
  const validationResult = validateFields(query, validFields);

  if (!validationResult.isValid) {
    throw new Error(`Invalid query: ${validationResult.errors[0].message}`);
  }

  return searchQueryToSql(query, searchableColumns);
};
