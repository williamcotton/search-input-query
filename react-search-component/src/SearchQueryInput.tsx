import { useRef, useState } from "react";
import Editor, { OnMount } from "@monaco-editor/react";
import type { editor } from "monaco-editor";
import {
  parseSearchQuery,
  stringify,
  FieldSchema,
  Expression,
} from "../../typescript-parser/src/parser";
import type { ValidationError } from "../../typescript-parser/src/validator";

interface SearchQueryInputProps {
  allowedFields: string[];
  schemas: FieldSchema[];
  onSearchResult: (result: {
    expression: Expression | null;
    parsedResult: string;
    errors: ValidationError[];
  }) => void;
}

export const SearchQueryInput: React.FC<SearchQueryInputProps> = ({
  schemas,
  onSearchResult,
}) => {
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const [monaco, setMonaco] = useState<typeof import("monaco-editor") | null>(
    null
  );
  const [decorations, setDecorations] =
    useState<editor.IEditorDecorationsCollection | null>(null);

  const handleEditorDidMount: OnMount = (editor, monacoInstance) => {
    editorRef.current = editor;
    setMonaco(monacoInstance);

    editor.addAction({
      id: "submitSearch",
      label: "Submit Search",
      keybindings: [monacoInstance.KeyCode.Enter],
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
      onSearchResult({
        expression: null,
        parsedResult: "",
        errors: [],
      });
      updateDecorations([]);
      return;
    }

    try {
      const result = parseSearchQuery(value, schemas);
      if (result.type === "SEARCH_QUERY_ERROR") {
        onSearchResult({
          expression: null,
          parsedResult: "",
          errors: result.errors,
        });
        updateDecorations(result.errors);
      } else {
        const expression = result.expression;
        updateDecorations([]);
        const parsedResult = expression ? stringify(expression) : "Empty query";

        onSearchResult({
          expression,
          parsedResult,
          errors: [],
        });
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

      onSearchResult({
        expression: null,
        parsedResult: "",
        errors: [error],
      });
      updateDecorations([error]);
    }
  };

  const onChange = (value: string | undefined) => {
    if (value !== undefined) {
      handleSearch(value);
    }
  };

  return (
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
  );
};
