import { useRef, useState } from "react";
import Editor, { OnMount } from "@monaco-editor/react";
import type { editor } from "monaco-editor";
import {
  parseSearchQuery,
  stringify,
  FieldSchema,
  Expression
} from "../../typescript-parser/src/parser";
import type { ValidationError } from "../../typescript-parser/src/validator";
import { searchQueryToSql } from "../../typescript-parser/src/search-query-to-sql";

import { ExpressionDescription } from "./ExpressionDescription";

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
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const [monaco, setMonaco] = useState<typeof import("monaco-editor") | null>(
    null
  );
  const [decorations, setDecorations] =
    useState<editor.IEditorDecorationsCollection | null>(null);
  const [expression, setExpression] = useState<Expression | null>(null);
  const [parsedResult, setParsedResult] = useState<string>("");
  const [sqlQuery, setSqlQuery] = useState<{
    text: string;
    values: string[];
  } | null>(null);
  const [errors, setErrors] = useState<ValidationError[]>([]);
  const [showSql, setShowSql] = useState(true);

  const handleEditorDidMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    setMonaco(monaco);

    editor.addAction({
      id: "submitSearch",
      label: "Submit Search",
      keybindings: [monaco.KeyCode.Enter],
      run: () => {
        const currentValue = editor.getValue();
        handleSearch(currentValue);
      },
    });
  };

  const updateDecorations = (newErrors: ValidationError[]) => {
    const editor = editorRef.current;
    if (!editor || !monaco) return;

    if (decorations) {
      decorations.clear();
    }

    if (newErrors.length > 0) {
      const newDecorations = newErrors.map((error) => ({
        range: new monaco.Range(
          1,
          error.position + 1,
          1,
          error.position + error.length + 1
        ),
        options: {
          inlineClassName: "search-input-error",
          hoverMessage: { value: error.message },
        },
      }));

      const decorationCollection =
        editor.createDecorationsCollection(newDecorations);
      setDecorations(decorationCollection);
    }
  };

  const handleSearch = (value: string) => {
    if (!value.trim()) {
      setParsedResult("");
      setSqlQuery(null);
      setErrors([]);
      updateDecorations([]);
      return;
    }

    try {
      const result = parseSearchQuery(value, schemas);
      if (result.type === "SEARCH_QUERY_ERROR") {
        setErrors(result.errors);
        setParsedResult("");
        setSqlQuery(null);
        updateDecorations(result.errors);
      }  else {
        setExpression(result.expression);
        setErrors([]);
        updateDecorations([]);
        setParsedResult(
          result.expression ? stringify(result.expression) : "Empty query"
        );
        // Generate SQL query
        const sql = result.expression
          ? searchQueryToSql(result, searchableColumns, schemas)
          : { text: "1=1", values: [] };
        setSqlQuery(sql);
      }
    } catch (err: unknown) {
      console.error(err);

      const isValidationError = (e: unknown): e is ValidationError => {
        const validationError = e as ValidationError;
        return (
          typeof validationError?.position === "number" &&
          typeof validationError?.length === "number" &&
          typeof validationError?.message === "string"
        );
      };

      const error: ValidationError = {
        message: isValidationError(err)
          ? err.message
          : err instanceof Error
          ? err.message
          : "An error occurred while parsing the query",
        position: isValidationError(err) ? err.position : 0,
        length: isValidationError(err) ? err.length : value.length,
      };

      setErrors([error]);
      setParsedResult("");
      setSqlQuery(null);
      updateDecorations([error]);
    }
  };

  const onChange = (value: string | undefined) => {
    if (value !== undefined) {
      handleSearch(value);
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

      <div className="search-wrapper">
        <label className="sr-only">Search Query</label>
        <Editor
          height="2em"
          defaultLanguage="plaintext"
          defaultValue=""
          onMount={handleEditorDidMount}
          onChange={onChange}
          className="search-input"
          options={{
            renderLineHighlight: "none",
            quickSuggestions: false,
            glyphMargin: false,
            lineDecorationsWidth: 0,
            folding: false,
            fixedOverflowWidgets: true,
            acceptSuggestionOnEnter: "on",
            hover: { delay: 100 },
            roundedSelection: false,
            contextmenu: false,
            cursorStyle: "line-thin",
            occurrencesHighlight: "off",
            links: false,
            minimap: { enabled: false },
            wordBasedSuggestions: "off",
            find: {
              addExtraSpaceOnTop: false,
              autoFindInSelection: "never",
              seedSearchStringFromSelection: "never",
            },
            fontSize: 14,
            fontWeight: "normal",
            wordWrap: "off",
            lineNumbers: "off",
            lineNumbersMinChars: 0,
            overviewRulerLanes: 0,
            overviewRulerBorder: false,
            hideCursorInOverviewRuler: true,
            scrollBeyondLastColumn: 0,
            scrollbar: {
              horizontal: "hidden",
              vertical: "hidden",
              alwaysConsumeMouseWheel: false,
            },
          }}
        />
      </div>

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
