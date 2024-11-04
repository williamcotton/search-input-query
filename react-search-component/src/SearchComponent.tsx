import { useRef, useState } from "react";
import Editor, { OnMount } from "@monaco-editor/react";
import type { editor } from "monaco-editor";
import { parseSearchQuery, stringify } from "../../typescript-parser/src/parser";
import type { ValidationError } from "../../typescript-parser/src/validator";

const SearchComponent = () => {
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const [monaco, setMonaco] = useState<typeof import("monaco-editor") | null>(
    null
  );
  const [decorations, setDecorations] =
    useState<editor.IEditorDecorationsCollection | null>(null);
  const [parsedResult, setParsedResult] = useState<string>("");
  const [errors, setErrors] = useState<ValidationError[]>([]);

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

    // Clear previous decorations
    if (decorations) {
      decorations.clear();
    }

    if (newErrors.length > 0) {
      // Create new decorations for each error
      const newDecorations = newErrors.map((error) => ({
        range: new monaco.Range(
          1, // startLineNumber
          error.position + 1, // startColumn (Monaco is 1-based)
          1, // endLineNumber
          error.position + error.length + 1 // endColumn
        ),
        options: {
          inlineClassName: "myInlineDecoration",
          hoverMessage: { value: error.message },
        },
      }));

      // Set new decorations
      const decorationCollection =
        editor.createDecorationsCollection(newDecorations);
      setDecorations(decorationCollection);
    }
  };

  const handleSearch = (value: string) => {
    if (!value.trim()) {
      setParsedResult("");
      setErrors([]);
      updateDecorations([]);
      return;
    }

    try {
      const result = parseSearchQuery(value);
      if (result.type === "SEARCH_QUERY_ERROR") {
        setErrors(result.errors);
        setParsedResult("");
        updateDecorations(result.errors);
      } else {
        setErrors([]);
        updateDecorations([]);
        setParsedResult(
          result.expression ? stringify(result.expression) : "Empty query"
        );
      }
    } catch (err: unknown) {
      console.error(err);
      const error = {
        // @ts-expect-error "fix later"
        message: err.message || "An error occurred while parsing the query",
        // @ts-expect-error "fix later"
        position: err.position || 0,
        // @ts-expect-error "fix later"
        length: err.length || value.length,
      };
      setErrors([error]);
      setParsedResult("");
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
      <div>
        <label>Search Query</label>
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
            hover: {
              delay: 100,
            },
            roundedSelection: false,
            contextmenu: false,
            cursorStyle: "line-thin",
            occurrencesHighlight: "off",
            links: false,
            minimap: { enabled: false },
            // see: https://github.com/microsoft/monaco-editor/issues/1746
            wordBasedSuggestions: "off",
            // disable `Find`
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
              // avoid can not scroll page when hover monaco
              alwaysConsumeMouseWheel: false,
            },
          }}
        />
      </div>

      {errors &&
        errors.map((error, index) => <div key={index} className="error-message">{error.message}</div>)}

      {parsedResult && !errors.length && (
        <div>
          <h3>Parsed Query:</h3>
          <code>{parsedResult}</code>
        </div>
      )}
    </div>
  );
};
 
export default SearchComponent;