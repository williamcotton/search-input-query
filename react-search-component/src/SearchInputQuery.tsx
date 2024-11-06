import React, { useRef, useState } from "react";
import Editor, { OnMount } from "@monaco-editor/react";
import type { editor, languages, KeyCode, Range } from "monaco-editor";
import {
  FieldSchema,
  Expression,
  parseSearchInputQuery,
  stringify,
} from "../../typescript-parser/src/parser";
import type { ValidationError } from "../../typescript-parser/src/validator";
import { createCompletionItemProvider } from "./create-completion-item-provider";
import { registerSearchQueryLanguage } from "./search-syntax";

interface SearchInputQueryProps {
  schemas: FieldSchema[];
  onSearchResult: (result: {
    expression: Expression | null;
    parsedResult: string;
    errors: ValidationError[];
  }) => void;
}

export interface Monaco {
  editor: typeof editor;
  languages: typeof languages;
  KeyCode: typeof KeyCode;
  Range: typeof Range;
}

export const SearchInputQuery: React.FC<SearchInputQueryProps> = ({
  schemas,
  onSearchResult,
}) => {
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<Monaco | null>(null);
  const [decorations, setDecorations] =
    useState<editor.IEditorDecorationsCollection | null>(null);

  const handleEditorDidMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;

    // Register our custom language
    registerSearchQueryLanguage(monaco);

    // Register the completion provider for our custom language
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
  };

  const updateDecorations = (newErrors: ValidationError[]) => {
    const editor = editorRef.current;
    const monaco = monacoRef.current;
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
      <label className="sr-only">Search Query</label>
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
        }}
      />
    </div>
  );
};
