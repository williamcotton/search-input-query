// Re-export everything from parser.ts
export * from "./parser";

// Re-export everything from validator.ts
export * from "./validator";

// Re-export everything from lexer.ts
export * from "./lexer";

// Re-export everything from first-pass-parser.ts with renamed types to avoid conflicts
export {
  parseExpression,
  type PositionLength,
  type StringLiteral,
  type WildcardPattern as FirstPassWildcardPattern,
  type AndExpression,
  type OrExpression,
  type NotExpression,
  type InExpression as FirstPassInExpression,
  type FirstPassExpression,
  type ParseResult,
} from "./first-pass-parser";

// Re-export SQL-related files with renamed types to avoid conflicts
export {
  searchQueryToSql,
  searchStringToSql,
  type SqlQueryResult as SqlQueryResultBase,
  type SearchType,
  type SearchQueryOptions as SearchQueryOptionsBase,
} from "./search-query-to-sql";

export {
  searchQueryToTsVectorSql,
  searchStringToTsVectorSql,
  type SqlQueryResult as TsVectorSqlQueryResult,
  type SearchQueryOptions as TsVectorSearchQueryOptions,
} from "./search-query-to-tsvector-sql";

export {
  searchQueryToIlikeSql,
  searchStringToIlikeSql,
  type SqlQueryResult as IlikeSqlQueryResult,
  type SearchQueryOptions as IlikeSearchQueryOptions,
} from "./search-query-to-ilike-sql";

export {
  searchQueryToParadeDbSql,
  searchStringToParadeDbSql,
  type SqlQueryResult as ParadeDbSqlQueryResult,
  type SearchQueryOptions as ParadeDbSearchQueryOptions,
} from "./search-query-to-paradedb-sql";

// Re-export utility functions
export * from "./validate-expression-fields";
export * from "./validate-string";
export * from "./validate-wildcard";
export * from "./validate-in-expression";
export * from "./parse-in-values";
export * from "./parse-primary";
export * from "./parse-range-expression";
export * from "./transform-to-expression"; 