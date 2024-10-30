#!/usr/bin/env ts-node

import { Expression, SearchQuery, parseSearchQuery } from "./typescript-expression-fields-parser";
import { validate } from "./typescript-field-validator";

interface SqlQueryResult {
  text: string;
  values: any[];
}

interface SqlState {
  paramCounter: number;
  values: any[];
  searchableColumns: string[];
}

// Constants
// const SEARCHABLE_COLUMNS = ["title", "description", "content", "name"] as const;
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
const termToSql = (term: string, state: SqlState): [string, SqlState] => {
  const escapedTerm = escapeSpecialChars(term);
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
const fieldToSql = (
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
  state: SqlState,
): [string, SqlState] => {
  switch (expr.type) {
    case "TERM":
      return termToSql(expr.value, state);
    case "FIELD":
      return fieldToSql(expr.key, expr.value, state);
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
const searchQueryToSql = (query: SearchQuery, searchableColumns: string[]): SqlQueryResult => {
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
const searchStringToSql = (searchString: string): SqlQueryResult => {
  const query = parseSearchQuery(searchString);
  const validFields = ["color", "category", "date"];
  const searchableColumns = ["title", "description", "content", "name"];
  const validQuery = validate(query, validFields);

  if (!validQuery.isValid) {
    throw new Error(`Invalid query: ${validQuery.errors[0].message}`);
  }
  return searchQueryToSql(query, searchableColumns);
};

const testQueries = [
  "comfortable AND (leather OR suede) brand:nike",
  'category:"winter boots" AND (color:black OR color:brown)',
  "red boots color:blue date:2024-01-01",
  "winter boots user_id:123",
];

for (const query of testQueries) {
  console.log("\nSearch query:", query);
  try {
    const result = searchStringToSql(query);
    console.log("SQL:", result.text);
    console.log("Values:", result.values);
  } catch (error) {
    console.error(
      "Error converting query:",
      error instanceof Error ? error.message : error
    );
  }
}

export { searchQueryToSql, searchStringToSql, type SqlQueryResult };
