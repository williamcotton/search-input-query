import React, { useRef, useState } from "react";
import Editor, { OnMount } from "@monaco-editor/react";
import { editor, languages, KeyCode, Range } from "monaco-editor";
import {
  FieldSchema,
  Expression,
  parseSearchInputQuery,
  stringify,
} from "search-input-query-parser";
import type { ValidationError } from "search-input-query-parser/validator";
import { createCompletionItemProvider } from "./create-completion-item-provider";
import { registerSearchQueryLanguage } from "./search-syntax";
// import { PlaceholderContentWidget } from "./PlaceholderContentWidget";

interface SearchInputQueryProps {
  schemas: FieldSchema[];
  onSearchResult: (result: {
    expression: Expression | null;
    parsedResult: string;
    errors: ValidationError[];
  }) => void;
  // placeholder?: string;
  editorTheme: editor.IStandaloneThemeData;
}

export type EditorTheme = editor.IStandaloneThemeData;

export interface Monaco {
  editor: typeof editor;
  languages: typeof languages;
  KeyCode: typeof KeyCode;
  Range: typeof Range;
}

export const SearchInputQuery: React.FC<SearchInputQueryProps> = ({
  schemas,
  onSearchResult,
  // placeholder,
  editorTheme,
}) => {
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<Monaco | null>(null);
  // const placeholderRef = useRef<PlaceholderContentWidget | null>(null);
  const [decorations, setDecorations] =
    useState<editor.IEditorDecorationsCollection | null>(null);

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
    editorRef.current = editor;
    monacoRef.current = monaco;

    // TODO: fix issues with cursor placement when using placeholder
    // placeholderRef.current = new PlaceholderContentWidget(
    //   placeholder || '',
    //   editor
    // );

    // Register custom language
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

    monaco.languages.registerCompletionItemProvider(
      "searchQuery",
      createCompletionItemProvider(monaco, schemas)
    );

    editor.addAction({
      id: "submitSearch",
      label: "Submit Search",
      keybindings: [monaco.KeyCode.Enter],
      run: () => {
        const currentValue = editor.getValue();
        handleSearch(currentValue);
      },
    });

    editor.focus();
  };

  const updateDecorations = (newErrors: ValidationError[]) => {
    const editor = editorRef.current;
    const monaco = monacoRef.current;
    if (!editor || !monaco) return;

    clearAllErrorDecorations();

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
    clearAllErrorDecorations();

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
      const result = parseSearchInputQuery(value, schemas);
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
      <Editor
        height="2em"
        defaultLanguage="searchQuery"
        defaultValue=""
        theme="searchQueryTheme"
        onMount={handleEditorDidMount}
        onChange={onChange}
        className="search-input"
        options={{
          wordWrap: "off",
          lineNumbers: "off",
          glyphMargin: false,
          folding: false,
          lineDecorationsWidth: 0,
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
        }}
      />
    </div>
  );
};
