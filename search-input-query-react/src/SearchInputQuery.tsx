import React, { useRef, useState, useEffect } from "react";
import Editor, { OnMount } from "@monaco-editor/react";
import { editor, languages, KeyCode, Range } from "monaco-editor";
import { FieldSchema, Expression, parseSearchInputQuery, stringify } from "../../search-input-query-parser/src/parser";
import type { ValidationError } from "../../search-input-query-parser/src/validator";
import { createCompletionItemProvider } from "./create-completion-item-provider";
import { registerSearchQueryLanguage } from "./search-syntax";
// import { PlaceholderContentWidget } from "./PlaceholderContentWidget";

interface SearchInputQueryProps {
  schemas: FieldSchema[];
  onSearchResult: (result: { expression: Expression | null; parsedResult: string; errors: ValidationError[]; query: string }) => void;
  // placeholder?: string;
  editorTheme: editor.IStandaloneThemeData;
  defaultValue?: string;
  autoSearch?: boolean; // New prop to control auto search behavior
}

export type EditorTheme = editor.IStandaloneThemeData;

export interface Monaco {
  editor: typeof editor;
  languages: typeof languages;
  KeyCode: typeof KeyCode;
  Range: typeof Range;
}

// Global flag to prevent duplicate language registration
let isLanguageRegistered = false;

export const SearchInputQuery: React.FC<SearchInputQueryProps> = ({
  schemas,
  onSearchResult,
  // placeholder,
  editorTheme,
  defaultValue = "",
  autoSearch = false, // Default to manual search
}) => {
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<Monaco | null>(null);
  // const placeholderRef = useRef<PlaceholderContentWidget | null>(null);
  const [decorations, setDecorations] = useState<editor.IEditorDecorationsCollection | null>(null);

  // Store disposable references for cleanup
  const completionProviderRef = useRef<{ dispose(): void } | null>(null);
  const schemasRef = useRef<FieldSchema[]>(schemas);

  const cleanup = () => {
    // Dispose of old completion provider

    if (completionProviderRef.current) {
      completionProviderRef.current.dispose();
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return cleanup;
  }, []);

  // Update completion provider when schemas change
  const updateCompletionProvider = () => {
    // Register new completion provider with updated schemas
    // Clean up any existing completion provider first
    if (!monacoRef.current) {
      console.log("🔄 monacoRef.current is null");
      return;
    }
    if (completionProviderRef.current) {
      completionProviderRef.current.dispose();
      console.log("🔄 cleanup");
    }

    completionProviderRef.current = monacoRef.current?.languages.registerCompletionItemProvider("searchQuery", createCompletionItemProvider(monacoRef.current, schemas)) || null;
    console.log("🔄 updated schemas to:", schemasRef.current);
  };

  const clearAllErrorDecorations = () => {
    const editor = editorRef.current;
    if (!editor) return;

    const model = editor.getModel();
    if (!model) return;

    const oldDecorations = model
      .getAllDecorations()
      .filter((d) => d.options.inlineClassName === "search-input-error")
      .map((d) => d.id);

    if (oldDecorations.length > 0) {
      model.deltaDecorations(oldDecorations, []);
    }

    if (decorations) {
      decorations.clear();
      setDecorations(null);
    }
  };

  const handleEditorDidMount: OnMount = (editor, monaco) => {
    console.log("🔄 handleEditorDidMount", editor, monaco);
    editorRef.current = editor;
    monacoRef.current = monaco;

    // TODO: fix issues with cursor placement when using placeholder
    // placeholderRef.current = new PlaceholderContentWidget(
    //   placeholder || '',
    //   editor
    // );

    editor.setValue(defaultValue);

    // Register custom language only once globally
    if (!isLanguageRegistered) {
      registerSearchQueryLanguage(monaco, editorTheme);

      monaco.languages.setLanguageConfiguration("searchQuery", {
        autoClosingPairs: [
          { open: "(", close: ")" },
          { open: '"', close: '"' },
        ],
        surroundingPairs: [
          { open: "(", close: ")" },
          { open: '"', close: '"' },
        ],
        brackets: [["(", ")"]],
      });

      isLanguageRegistered = true;
    }

    // // Clean up any existing completion provider first
    // if (completionProviderRef.current) {
    //   completionProviderRef.current.dispose();
    // }

    // // Register new completion provider and store disposable
    // completionProviderRef.current = monaco.languages.registerCompletionItemProvider("searchQuery", createCompletionItemProvider(monaco, schemas));

    editor.addAction({
      id: "submitSearch",
      label: "Submit Search",
      keybindings: [monaco.KeyCode.Enter],
      run: () => {
        const currentValue = editor.getValue();
        handleSearch(currentValue);
      },
    });

    monaco.editor.addKeybindingRule({
      keybinding: monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyF,
      command: null,
    });

    editor.focus();
    updateCompletionProvider();
  };

  const updateDecorations = (newErrors: ValidationError[]) => {
    const editor = editorRef.current;
    const monaco = monacoRef.current;
    if (!editor || !monaco) return;

    clearAllErrorDecorations();

    if (newErrors.length > 0) {
      const newDecorations = newErrors.map((error) => ({
        range: new monaco.Range(1, error.position + 1, 1, error.position + error.length + 1),
        options: {
          inlineClassName: "search-input-error",
          hoverMessage: { value: error.message },
        },
      }));

      const decorationCollection = editor.createDecorationsCollection(newDecorations);
      setDecorations(decorationCollection);
    }
  };

  const handleSearch = (value: string) => {
    clearAllErrorDecorations();

    if (!value.trim()) {
      onSearchResult({
        expression: null,
        parsedResult: "",
        errors: [],
        query: value,
      });
      updateDecorations([]);
      return;
    }

    try {
      const result = parseSearchInputQuery(value, schemasRef.current);
      if (result.type === "SEARCH_QUERY_ERROR") {
        onSearchResult({
          expression: null,
          parsedResult: "",
          errors: result.errors,
          query: value,
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
          query: value,
        });
      }
    } catch (err: unknown) {
      console.error(err);

      const isValidationError = (e: unknown): e is ValidationError => {
        const validationError = e as ValidationError;
        return typeof validationError?.position === "number" && typeof validationError?.length === "number" && typeof validationError?.message === "string";
      };

      const error: ValidationError = {
        message: isValidationError(err) ? err.message : err instanceof Error ? err.message : "An error occurred while parsing the query",
        code: 0,
        position: isValidationError(err) ? err.position : 0,
        length: isValidationError(err) ? err.length : value.length,
      };

      onSearchResult({
        expression: null,
        parsedResult: "",
        errors: [error],
        query: value,
      });
      updateDecorations([error]);
    }
  };

  const onChange = (value: string | undefined) => {
    if (value !== undefined && autoSearch) {
      handleSearch(value);
    }
  };

  const handleManualSearch = () => {
    const editor = editorRef.current;
    if (editor) {
      const currentValue = editor.getValue();
      handleSearch(currentValue);
    }
  };

  return (
    <div className="search-wrapper flex items-center w-full min-w-0 gap-2">
      <div className="flex-1 min-w-0">
        <Editor
          height="2em"
          defaultLanguage="searchQuery"
          defaultValue={defaultValue}
          theme="searchQueryTheme"
          onMount={handleEditorDidMount}
          onChange={onChange}
          className="search-input"
          options={{
            wordWrap: "off",
            lineNumbers: "off",
            glyphMargin: false,
            folding: false,
            lineDecorationsWidth: 8, // 8px left padding (equivalent to px-2)
            lineNumbersMinChars: 0,
            minimap: { enabled: false },
            scrollbar: {
              horizontal: "hidden",
              vertical: "hidden",
            },
            overviewRulerLanes: 0,
            hideCursorInOverviewRuler: true,
            overviewRulerBorder: false,
            renderLineHighlight: "none",
            theme: "searchQueryTheme",
            autoClosingBrackets: "always",
            autoClosingQuotes: "always",
            autoClosingOvertype: "always",
            autoSurround: "languageDefined",
            // Vertical centering and padding options
            padding: { top: 4, bottom: 4 }, // Vertical padding for centering
            revealHorizontalRightPadding: 8, // 8px right padding
            fontFamily: "inherit",
            fontSize: 14,
            lineHeight: 20,
            fixedOverflowWidgets: true,
            automaticLayout: true, // Enable responsive layout
            suggest: {
              showIcons: true,
              showSnippets: true,
              showWords: true,
              showStatusBar: false,
            },
          }}
        />
      </div>
      {!autoSearch && (
        <button
          onClick={handleManualSearch}
          className="search-button"
          style={{
            backgroundColor: "#2563eb",
            color: "white",
            border: "none",
            borderRadius: "4px",
            padding: "6px 12px",
            fontSize: "14px",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "4px",
          }}
          title="Search (or press Enter)"
        >
          🔍
        </button>
      )}
    </div>
  );
};

export default SearchInputQuery;
