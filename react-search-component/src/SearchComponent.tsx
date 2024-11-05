import { useState } from "react";
import {
  FieldSchema,
  Expression,
  SearchQuery,
} from "../../typescript-parser/src/parser";
import { searchQueryToSql } from "../../typescript-parser/src/search-query-to-sql";
import type { ValidationError } from "../../typescript-parser/src/validator";
import { ExpressionDescription } from "./ExpressionDescription";
import { SearchInputQuery } from "./SearchInputQuery";

// Define available fields and searchable columns
const schemas: FieldSchema[] = [
  { name: "title", type: "string" },
  { name: "description", type: "string" },
  { name: "status", type: "string" },
  { name: "category", type: "string" },
  { name: "price", type: "number" },
  { name: "date", type: "date" },
];
const allowedFields = schemas.map((schema) => schema.name);
const searchableColumns = ["title", "description"];

const SearchComponent = () => {
  const [expression, setExpression] = useState<Expression | null>(null);
  const [parsedResult, setParsedResult] = useState<string>("");
  const [sqlQuery, setSqlQuery] = useState<{
    text: string;
    values: string[];
  } | null>(null);
  const [errors, setErrors] = useState<ValidationError[]>([]);
  const [showSql, setShowSql] = useState(true);

  const handleSearchResult = (result: {
    expression: Expression | null;
    parsedResult: string;
    errors: ValidationError[];
  }) => {
    setExpression(result.expression);
    setParsedResult(result.parsedResult);
    setErrors(result.errors);

    if (result.errors.length === 0 && result.expression) {
      // Generate SQL query
      const parseResult: SearchQuery = {
        type: "SEARCH_QUERY",
        expression: result.expression,
      };
      const sql = searchQueryToSql(parseResult, searchableColumns, schemas);
      setSqlQuery(sql);
    } else {
      setSqlQuery(null);
    }
  };

  return (
    <div className="search-container">
      <div className="available-fields">
        Available fields:{" "}
        {allowedFields.map((field) => (
          <span key={field} className="field-badge">
            {field}
          </span>
        ))}
      </div>

      <SearchInputQuery
        schemas={schemas}
        onSearchResult={handleSearchResult}
      />

      {errors.length > 0 && (
        <div className="error-container">
          {errors.map((error, index) => (
            <div key={index} className="error-message">
              {error.message}
            </div>
          ))}
        </div>
      )}

      {parsedResult && !errors.length && (
        <div className="result-container">
          <ExpressionDescription expression={expression} />
          <div className="parsed-query">
            <h3>Parsed Query:</h3>
            <code>{parsedResult}</code>
          </div>
          <div className="sql-toggle">
            <label className="toggle">
              <span className="toggle-label">Show SQL</span>
              <div className="toggle-switch">
                <input
                  type="checkbox"
                  checked={showSql}
                  onChange={(e) => setShowSql(e.target.checked)}
                />
                <span className="slider"></span>
              </div>
            </label>
          </div>
          {showSql && sqlQuery && (
            <div className="sql-query">
              <h3>SQL WHERE Clause:</h3>
              <code>{sqlQuery.text}</code>
              {sqlQuery.values.length > 0 && (
                <div className="sql-params">
                  <h4>Parameters:</h4>
                  <code>
                    [{sqlQuery.values.map((v) => JSON.stringify(v)).join(", ")}]
                  </code>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SearchComponent;
