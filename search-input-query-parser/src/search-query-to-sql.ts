import {
  Expression,
  SearchQuery,
  parseSearchInputQuery,
  FieldSchema,
  WildcardPattern,
} from "./parser";

export {
  searchStringToIlikeSql,
  searchQueryToIlikeSql,
} from "./search-query-to-ilike-sql";
export { searchQueryToTsVectorSql, searchStringToTsVectorSql } from "./search-query-to-tsvector-sql";
export {
  searchQueryToParadeDbSql,
  searchStringToParadeDbSql,
} from "./search-query-to-paradedb-sql";

export interface SqlQueryResult {
  text: string;
  values: any[];
}

interface SqlState {
  paramCounter: number;
  values: any[];
  searchableColumns: string[];
  schemas: Map<string, FieldSchema>;
  searchType: SearchType;
  language?: string; // For tsvector configuration
}

export type SearchType = "ilike" | "tsvector" | "paradedb";

export interface SearchQueryOptions {
  searchType?: SearchType;
  language?: string; // PostgreSQL language configuration for tsvector
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

// Helper to escape special characters for ParadeDB query syntax
const escapeParadeDBChars = (value: string): string => {
  const specialChars = [
    "+",
    "^",
    "`",
    ":",
    "{",
    "}",
    '"',
    "[",
    "]",
    "(",
    ")",
    "<",
    ">",
    "~",
    "!",
    "\\",
    "*",
  ];
  return specialChars.reduce(
    (escaped, char) =>
      escaped.replace(new RegExp(escapeRegExp(char), "g"), `\\${char}`),
    value
  );
};

const stripQuotes = (value: string): string => {
  if (value.startsWith('"') && value.endsWith('"')) {
    return value.slice(1, -1);
  }
  return value;
};

const cleanQuotedString = (
  value: string,
  stripOuterQuotes: boolean = true
): string => {
  // First strip the outer quotes if requested
  let cleaned = stripOuterQuotes ? stripQuotes(value) : value;

  // Replace escaped quotes with regular quotes
  cleaned = cleaned.replace(/\\"/g, '"');

  // Clean up any remaining escape characters
  cleaned = cleaned.replace(/\\\\/g, "\\");

  return cleaned;
};

const isQuotedString = (value: string): boolean => {
  return value.startsWith('"') && value.endsWith('"');
};

const prepareParadeDBString = (
  value: string,
  includeWildcard: boolean = false
): string => {
  // First clean up the string
  const cleaned = cleanQuotedString(value);

  // For ParadeDB, we need to:
  // 1. Escape special characters (except wildcards)
  // 2. Wrap in quotes
  // 3. Add wildcard if needed
  const escaped = escapeParadeDBChars(cleaned);
  const result = `"${escaped}"`;
  return includeWildcard ? `${result}*` : result;
};

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
 * Convert a wildcard pattern to SQL
 */
const wildcardPatternToSql = (
  expr: WildcardPattern,
  state: SqlState
): [string, SqlState] => {
  if (expr.prefix === "") {
    return ["1=1", state];
  }

  const [paramName, newState] = nextParam(state);
  const cleanedPrefix = cleanQuotedString(expr.prefix);

  switch (state.searchType) {
    case "paradedb": {
      const queryValue = prepareParadeDBString(cleanedPrefix, true);
      const conditions = state.searchableColumns.map(
        (column) => `${column} @@@ ${paramName}`
      );
      const sql =
        conditions.length === 1
          ? conditions[0]
          : `(${conditions.join(" OR ")})`;
      return [sql, addValue(newState, queryValue)];
    }
    case "tsvector": {
      const langConfig = state.language || "english";
      const conditions = state.searchableColumns.map(
        (column) => `to_tsvector('${langConfig}', ${column})`
      );
      const tsvectorCondition = `(${conditions.join(
        " || "
      )}) @@ to_tsquery('${langConfig}', ${paramName})`;
      return [tsvectorCondition, addValue(newState, `${cleanedPrefix}:*`)];
    }
    default: {
      // ILIKE behavior
      const escapedPrefix = escapeSpecialChars(cleanedPrefix);
      const conditions = state.searchableColumns.map(
        (column) => `lower(${column}) LIKE lower(${paramName})`
      );
      const sql =
        conditions.length === 1
          ? conditions[0]
          : `(${conditions.join(" OR ")})`;
      return [sql, addValue(newState, `${escapedPrefix}%`)];
    }
  }
};

/**
 * Convert a search term to SQL conditions based on search type
 */
const searchTermToSql = (
  value: string,
  state: SqlState
): [string, SqlState] => {
  const [paramName, newState] = nextParam(state);
  const hasWildcard = value.endsWith("*");
  const isQuoted = isQuotedString(value);
  const cleanedValue = cleanQuotedString(value);
  const baseValue = hasWildcard ? cleanedValue.slice(0, -1) : cleanedValue;

  switch (state.searchType) {
    case "paradedb": {
      const queryValue = prepareParadeDBString(baseValue, hasWildcard);
      const conditions = state.searchableColumns.map(
        (column) => `${column} @@@ ${paramName}`
      );
      const sql =
        conditions.length === 1
          ? conditions[0]
          : `(${conditions.join(" OR ")})`;
      return [sql, addValue(newState, queryValue)];
    }
    case "tsvector": {
      const langConfig = state.language || "english";
      const conditions = state.searchableColumns.map(
        (column) => `to_tsvector('${langConfig}', ${column})`
      );
      const tsvectorCondition = `(${conditions.join(" || ")}) @@ ${
        hasWildcard ? "to_tsquery" : "plainto_tsquery"
      }('${langConfig}', ${paramName})`;
      return [
        tsvectorCondition,
        addValue(newState, hasWildcard ? `${baseValue}:*` : baseValue),
      ];
    }
    case "ilike": {
      // Use lower() for case-insensitive search in SQLite
      const escapedTerm = escapeSpecialChars(baseValue);
      const conditions = state.searchableColumns.map(
        (column) => `lower(${column}) LIKE lower(${paramName})`
      );
      const sql =
        conditions.length === 1
          ? conditions[0]
          : `(${conditions.join(" OR ")})`;

      if (hasWildcard) {
        return [sql, addValue(newState, `${escapedTerm}%`)];
      } else {
        return [sql, addValue(newState, `%${escapedTerm}%`)];
      }
    }
  }
};

/**
 * Convert a field:value pair to SQL based on search type
 */
const fieldValueToSql = (
  field: string,
  value: string,
  state: SqlState
): [string, SqlState] => {
  const [paramName, newState] = nextParam(state);
  const schema = state.schemas.get(field.toLowerCase());
  const hasWildcard = value.endsWith("*");
  const cleanedValue = cleanQuotedString(value);
  const baseValue = hasWildcard ? cleanedValue.slice(0, -1) : cleanedValue;

  if (state.searchType === "paradedb") {
    switch (schema?.type) {
      case "date": {
        // Use parameter binding for dates
        const [dateParam, dateState] = nextParam(state);
        return [
          `${field} @@@ '"' || ${dateParam} || '"'`,
          addValue(dateState, baseValue),
        ];
      }
      case "number":
        return [`${field} @@@ '${baseValue}'`, newState];
      default: {
        const queryValue = prepareParadeDBString(baseValue, hasWildcard);
        return [`${field} @@@ ${paramName}`, addValue(newState, queryValue)];
      }
    }
  }

  // Rest of the function remains the same...
  switch (schema?.type) {
    case "date":
      return [
        `${field} = ${paramName}`,
        addValue(newState, cleanedValue),
      ];
    case "number":
      return [
        `${field} = ${paramName}`,
        addValue(newState, Number(cleanedValue)),
      ];
    default:
      if (
        state.searchType === "tsvector" &&
        state.searchableColumns.includes(field)
      ) {
        const langConfig = state.language || "english";
        return [
          `to_tsvector('${langConfig}', ${field}) @@ ${
            hasWildcard ? "to_tsquery" : "plainto_tsquery"
          }('${langConfig}', ${paramName})`,
          addValue(newState, hasWildcard ? `${baseValue}:*` : baseValue),
        ];
      } else {
        const escapedValue = escapeSpecialChars(baseValue);
        return [
          `lower(${field}) LIKE lower(${paramName})`,
          addValue(
            newState,
            hasWildcard ? `${escapedValue}%` : `%${escapedValue}%`
          ),
        ];
      }
  }
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

  if (state.searchType === "paradedb") {
    if (operator === "BETWEEN" && value2) {
      const [param1, state1] = nextParam(state);
      const [param2, state2] = nextParam(state1);
      let val1 = isDateField ? value : Number(value);
      let val2 = isDateField ? value2 : Number(value2);
      return [
        `${field} @@@ '[' || ${param1} || ' TO ' || ${param2} || ']'`,
        addValue(addValue(state2, val1), val2),
      ];
    } else {
      const [paramName, newState] = nextParam(state);
      const rangeOp = operator.replace(">=", ">=").replace("<=", "<=");
      const val = isDateField ? value : Number(value);
      return [
        `${field} @@@ '${rangeOp}' || ${paramName}`,
        addValue(newState, val),
      ];
    }
  }

  if (operator === "BETWEEN" && value2) {
    const [param1, state1] = nextParam(state);
    const [param2, state2] = nextParam(state1);
    let val1 = isDateField ? value : Number(value);
    let val2 = isDateField ? value2 : Number(value2);
    return [
      `${field} BETWEEN ${param1} AND ${param2}`,
      addValue(addValue(state2, val1), val2),
    ];
  }

  const [paramName, newState] = nextParam(state);
  const val = isDateField ? value : Number(value);
  return [
    `${field} ${operator} ${paramName}`,
    addValue(newState, val),
  ];
};

const inExpressionToSql = (
  field: string,
  values: string[],
  state: SqlState
): [string, SqlState] => {
  let currentState = state;
  const cleanedValues = values.map((v) => cleanQuotedString(v));

  if (state.searchType === "paradedb") {
    const paramNames: string[] = [];

    for (const value of cleanedValues) {
      const [paramName, newState] = nextParam(currentState);
      paramNames.push(paramName);
      currentState = addValue(newState, value);
    }

    const concatExpr = paramNames.join(" || ' ' || ");
    return [`${field} @@@ 'IN[' || ${concatExpr} || ']'`, currentState];
  }

  const paramNames: string[] = [];
  const schema = state.schemas.get(field.toLowerCase());

  for (const value of cleanedValues) {
    const [paramName, newState] = nextParam(currentState);
    paramNames.push(paramName);
    currentState = addValue(
      newState,
      schema?.type === "number" ? Number(value) : value
    );
  }

  return [
    `${field} IN (${paramNames
      .map((p) => p)
      .join(", ")})`,
    currentState,
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

    case "WILDCARD":
      return wildcardPatternToSql(expr, state);

    case "IN":
      return inExpressionToSql(
        expr.field.value,
        expr.values.map((v) => v.value),
        state
      );

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
      return [`NOT ${sqlText}`, newState];
    }

    case "ORDER_BY":
      // OrderBy doesn't contribute to WHERE clause in general SQL
      return ["1=1", state];

    default:
      const exhaustiveCheck: never = expr;
      throw new Error(`Unhandled expression type: ${(exhaustiveCheck as any).type}`);
  }
};

/**
 * Convert a SearchQuery to a SQL WHERE clause with specified search type
 */
export const searchQueryToSql = (
  query: SearchQuery,
  searchableColumns: string[],
  schemas: FieldSchema[] = [],
  options: SearchQueryOptions = {}
): SqlQueryResult => {
  const initialState: SqlState = {
    paramCounter: 1,
    values: [],
    searchableColumns,
    schemas: new Map(schemas.map((s) => [s.name.toLowerCase(), s])),
    searchType: options.searchType || "ilike",
    language: options.language,
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
  schemas: FieldSchema[] = [],
  options: SearchQueryOptions = {}
): SqlQueryResult => {
  const query = parseSearchInputQuery(searchString, schemas);
  if (query.type === "SEARCH_QUERY_ERROR") {
    throw new Error(`Parse error: ${query.errors[0].message}`);
  }

  return searchQueryToSql(query, searchableColumns, schemas, options);
};
