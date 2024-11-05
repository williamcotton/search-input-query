import { Expression, SearchQuery, parseSearchQuery, FieldSchema } from "./parser";

export interface SqlQueryResult {
  text: string;
  values: any[];
}

interface SqlState {
  paramCounter: number;
  values: any[];
  searchableColumns: string[];
  schemas: Map<string, FieldSchema>;
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

  // This part ensures we always wrap search term conditions in parentheses
  const sql =
    conditions.length === 1 ? conditions[0] : `(${conditions.join(" OR ")})`;

  return [sql, addValue(newState, `%${escapedTerm}%`)];
};

/**
 * Convert a range expression to SQL
 */
const rangeToSql = (
  field: string,
  operator: string,
  value: string,
  value2: string | undefined,
  state: SqlState
): [string, SqlState] => {
  const schema = state.schemas.get(field.toLowerCase());
  const isDateField = schema?.type === "date";
  const typeCast = isDateField ? "::date" : "";
  const paramCast = isDateField ? "::date" : "";

  // Handle BETWEEN case
  if (operator === "BETWEEN" && value2) {
    const [param1, state1] = nextParam(state);
    const [param2, state2] = nextParam(state1);

    let val1 = isDateField ? value : Number(value);
    let val2 = isDateField ? value2 : Number(value2);

    return [
      `${field}${typeCast} BETWEEN ${param1}${paramCast} AND ${param2}${paramCast}`,
      addValue(addValue(state2, val1), val2),
    ];
  }

  // Handle regular comparison operators
  const [paramName, newState] = nextParam(state);
  const val = isDateField ? value : Number(value);

  return [
    `${field}${typeCast} ${operator} ${paramName}${paramCast}`,
    addValue(newState, val),
  ];
};

/**
 * Convert a field:value pair to SQL
 */
// In search-query-to-sql.ts

// Update fieldValueToSql to handle dates and IDs
const fieldValueToSql = (
  field: string,
  value: string,
  state: SqlState
): [string, SqlState] => {
  const [paramName, newState] = nextParam(state);

  const schema = state.schemas.get(field.toLowerCase());
  const isDateField = schema?.type === "date";
  
  // Special handling for date equality
  if (isDateField) {
    return [`${field}::date = ${paramName}::date`, addValue(newState, value)];
  }

  // Special handling for ID fields
  if (field.toLowerCase().endsWith('_id')) {
    return [
      `${field} = ${paramName}`,
      addValue(newState, value)
    ];
  }

  const escapedValue = escapeSpecialChars(value);
  return [
    `${field} ILIKE ${paramName}`,
    addValue(newState, `%${escapedValue}%`),
  ];
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

    case "RANGE":
      return rangeToSql(
        expr.field.value,
        expr.operator,
        expr.value.value,
        expr.value2?.value,
        state
      );

    case "AND":
      return binaryOpToSql("AND", expr.left, expr.right, state);

    case "OR":
      return binaryOpToSql("OR", expr.left, expr.right, state);

    case "NOT": {
      const [sqlText, newState] = expressionToSql(expr.expression, state);
      // Always wrap the inner expression in parentheses for NOT
      const wrappedText = sqlText.startsWith("(") ? sqlText : `(${sqlText})`;
      return [`NOT ${wrappedText}`, newState];
    }
  }
};

/**
 * Convert a SearchQuery to a SQL WHERE clause
 */
export const searchQueryToSql = (
  query: SearchQuery,
  searchableColumns: string[],
  schemas: FieldSchema[] = []
): SqlQueryResult => {
  const initialState: SqlState = {
    paramCounter: 1,
    values: [],
    searchableColumns,
    schemas: new Map(schemas.map((s) => [s.name.toLowerCase(), s])),
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
export const searchStringToSql = (
  searchString: string,
  searchableColumns: string[],
  schemas: FieldSchema[] = []
): SqlQueryResult => {
  const query = parseSearchQuery(searchString, schemas);
  if (query.type === "SEARCH_QUERY_ERROR") {
    throw new Error(`Parse error: ${query.errors[0].message}`);
  }

  return searchQueryToSql(query, searchableColumns, schemas);
};
