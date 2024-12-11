import { useState } from "react";
import {
  FieldSchema,
  Expression,
  SearchQuery,
} from "search-input-query-parser";
import {
  searchQueryToSql,
  SearchType,
} from "search-input-query-parser/search-query-to-sql";
import { searchQueryToIlikeSql } from "search-input-query-parser/search-query-to-sql";
import { searchQueryToParadeDbSql } from "search-input-query-parser/search-query-to-sql";
import { searchQueryToTsVectorSql } from "search-input-query-parser/search-query-to-sql";
import type { ValidationError } from "search-input-query-parser/validator";
import { ExpressionDescription } from "./ExpressionDescription";
import { SearchInputQuery, EditorTheme } from "search-input-query-react";
import SearchTypeSelector from "./SearchTypeSelector";
import { type Product, searchProducts } from "./db-service";

const schemas: FieldSchema[] = [
  { name: "title", type: "string" },
  { name: "description", type: "string" },
  { name: "status", type: "string" },
  { name: "category", type: "string" },
  { name: "price", type: "number" },
  { name: "date", type: "date" },
];

const editorTheme: EditorTheme = {
  base: "vs",
  inherit: true,
  rules: [
    { token: "keyword", foreground: "#794938", fontStyle: "bold" },
    { token: "field", foreground: "#234A97", fontStyle: "bold" },
    { token: "value", foreground: "#0B6125" },
    { token: "operator", foreground: "#811F24" },
    { token: "string", foreground: "#0B6125" },
    {
      token: "string.invalid",
      foreground: "#B52A1D",
      fontStyle: "bold italic underline",
    },
    {
      token: "string.escape",
      foreground: "#CF5628",
      fontStyle: "bold",
    },
    { token: "string.quote", foreground: "#0B6125" },
    { token: "number", foreground: "#A71D5D" },
    { token: "date", foreground: "#A71D5D" },
    { token: "identifier", foreground: "#080808" },
    { token: "@brackets", foreground: "#794938" },
    { token: "delimiter", foreground: "#811F24" },
    { token: "text", foreground: "#080808" },
  ],
  colors: {
    "editor.foreground": "#24292F",
    "editor.background": "#FFFFFF",
    "editorCursor.foreground": "#24292F",
    "editor.lineHighlightBackground": "#FFFFFF",
    "editorLineNumber.foreground": "#57606A",
    "editor.selectionBackground": "#275FFF4D",
    "editor.inactiveSelectionBackground": "#0550AE15",
  },
};

const allowedFields = schemas.map((schema) => schema.name);
const searchableColumns = ["title", "description"];

const SearchComponent = () => {
  const [expression, setExpression] = useState<Expression | null>(null);
  const [parsedResult, setParsedResult] = useState<string>("");
  const [sqlQuery, setSqlQuery] = useState<{
    text: string;
    values: string[];
  } | null>(null);
  const [sqlSearchType, setSqlSearchType] = useState<SearchType>("ilike");
  const [errors, setErrors] = useState<ValidationError[]>([]);
  const [showSql, setShowSql] = useState(true);
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [activeTab, setActiveTab] = useState<"results" | "technical">(
    "results"
  );

  const handleSearchResult = async (result: {
    expression: Expression | null;
    parsedResult: string;
    errors: ValidationError[];
  }): Promise<void> => {
    setExpression(result.expression);
    setParsedResult(result.parsedResult);
    setErrors(result.errors);

    if (result.errors.length === 0 && result.expression) {
      try {
        const parseResult: SearchQuery = {
          type: "SEARCH_QUERY",
          expression: result.expression,
        };

        let sql;
        switch (sqlSearchType) {
          case "ilike":
            sql = searchQueryToIlikeSql(parseResult, searchableColumns, schemas);
            break;
          case "tsvector":
            sql = searchQueryToTsVectorSql(parseResult,searchableColumns,schemas);
            break;
          case "paradedb":
            sql = searchQueryToParadeDbSql(parseResult,searchableColumns,schemas);
            break;
          default:
            throw new Error(`Unknown search type: ${sqlSearchType}`);
        }

        setSqlQuery(sql);

        const results = await searchProducts(sql.text, sql.values);
        setSearchResults(results);

      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "An unknown error occurred";
        setErrors([{ message: errorMessage, code: 0, position: 0, length: 0 }]);
        setSqlQuery(null);
        setSearchResults([]);
      }
    } else {
      setSqlQuery(null);
      setSearchResults([]);
    }
  };

  const renderResultsTab = () => (
    <div className="results-section">
      {searchResults.length > 0 && (
        <div className="search-results">
          <div className="results-grid">
            {searchResults.map((product) => (
              <div key={product.id} className="result-card">
                <h4>{product.title}</h4>
                <p>{product.description}</p>
                <div className="result-details">
                  <span className="price">${product.price.toFixed(2)}</span>
                  <span
                    className={`status status-${product.status.replace(
                      /\s+/g,
                      "-"
                    )}`}
                  >
                    {product.status}
                  </span>
                </div>
                <div className="result-meta">
                  <span className="category">{product.category}</span>
                  <span className="date">
                    {new Date(product.date).toLocaleDateString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      {searchResults.length === 0 && parsedResult && !errors.length && (
        <div className="no-results">
          <p>No results found</p>
        </div>
      )}
    </div>
  );

  const renderTechnicalTab = () => (
    <div className="technical-section">
      {parsedResult && !errors.length && (
        <>
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
            <>
              <SearchTypeSelector
                searchType={sqlSearchType}
                onSearchTypeChange={(newType) => {
                  setSqlSearchType(newType);
                  if (expression) {
                    const parseResult: SearchQuery = {
                      type: "SEARCH_QUERY",
                      expression,
                    };
                    const sql = searchQueryToSql(
                      parseResult,
                      searchableColumns,
                      schemas,
                      {
                        searchType: newType,
                      }
                    );
                    setSqlQuery(sql);
                  }
                }}
              />

              <div className="sql-query">
                <h3>SQL WHERE Clause:</h3>
                <code>{sqlQuery.text}</code>
                {sqlQuery.values.length > 0 && (
                  <div className="sql-params">
                    <h4>Parameters:</h4>
                    <code>
                      [
                      {sqlQuery.values.map((v) => JSON.stringify(v)).join(", ")}
                      ]
                    </code>
                  </div>
                )}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );

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
        // placeholder={`Try "category:boots AND price:>100" or "winter shoes"...`}
        editorTheme={editorTheme}
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

      {(searchResults.length > 0 || (parsedResult && !errors.length)) && (
        <div className="tabs">
          <ul className="tab-list">
            <li>
              <button
                className={`tab ${activeTab === "results" ? "active" : ""}`}
                onClick={() => setActiveTab("results")}
              >
                Results
              </button>
            </li>
            <li>
              <button
                className={`tab ${activeTab === "technical" ? "active" : ""}`}
                onClick={() => setActiveTab("technical")}
              >
                Technical Details
              </button>
            </li>
          </ul>
          <div className="tab-content">
            {activeTab === "results"
              ? renderResultsTab()
              : renderTechnicalTab()}
          </div>
        </div>
      )}
    </div>
  );
};

export default SearchComponent;
