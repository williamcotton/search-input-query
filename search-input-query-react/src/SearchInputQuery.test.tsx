import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
// import userEvent from "@testing-library/user-event";
import SearchInputQuery from "./SearchInputQuery";
import { FieldSchema } from "search-input-query-parser";
import type { EditorTheme } from "./SearchInputQuery";

// Mock Monaco types and interfaces
interface MockDecoration {
  id: string;
  options: {
    inlineClassName?: string;
    hoverMessage?: { value: string };
  };
}

interface DecorationOptions {
  range: {
    startLineNumber: number;
    startColumn: number;
    endLineNumber: number;
    endColumn: number;
  };
  options: {
    inlineClassName?: string;
    hoverMessage?: { value: string };
    className?: string;
    marginClassName?: string;
    isWholeLine?: boolean;
  };
}

interface MockEditorModel {
  getAllDecorations: () => MockDecoration[];
  deltaDecorations: (
    oldDecorations: string[],
    newDecorations: DecorationOptions[]
  ) => string[];
}

interface MockEditorInstance {
  getValue: () => string;
  setValue: (value: string) => void;
  focus: () => void;
  addAction: (action: {
    id: string;
    label: string;
    run: () => void;
    keybindings?: number[];
  }) => void;
  getModel: () => MockEditorModel;
}

interface MockEditorProps {
  onChange?: (value: string) => void;
  onMount?: (editor: MockEditorInstance, monaco: typeof mockMonaco) => void;
}

// Create mock Monaco instance
const mockMonaco = {
  editor: {
    defineTheme: jest.fn(),
    setThemeData: jest.fn(),
  },
  languages: {
    register: jest.fn(),
    setLanguageConfiguration: jest.fn(),
    setMonarchTokensProvider: jest.fn(),
    registerCompletionItemProvider: jest.fn(),
    CompletionItemKind: {
      Field: 1,
      Operator: 2,
      Value: 3,
    },
  },
  KeyCode: {
    Enter: 13,
  },
  Range: jest.fn(),
};

// Mock Monaco Editor
jest.mock("@monaco-editor/react", () => {
  return function MockEditor({ onChange, onMount }: MockEditorProps) {
    React.useEffect(() => {
      if (onMount) {
        const mockEditor: MockEditorInstance = {
          getValue: () => "",
          setValue: () => {},
          focus: () => {},
          addAction: () => {},
          getModel: () => ({
            getAllDecorations: () => [],
            deltaDecorations: () => [],
          }),
        };
        onMount(mockEditor, mockMonaco);
      }
    }, [onMount]);

    return (
      <div data-testid="mock-editor">
        <input
          type="text"
          onChange={(e) => onChange?.(e.target.value)}
          data-testid="editor-input"
        />
      </div>
    );
  };
});

const mockSchemas: FieldSchema[] = [
  { name: "title", type: "string" },
  { name: "price", type: "number" },
  { name: "date", type: "date" },
];

const mockEditorTheme: EditorTheme = {
  base: "vs",
  inherit: true,
  rules: [
    { token: "keyword", foreground: "#794938", fontStyle: "bold" },
    { token: "field", foreground: "#234A97", fontStyle: "bold" },
    { token: "value", foreground: "#0B6125" },
  ],
  colors: {
    "editor.foreground": "#24292F",
    "editor.background": "#FFFFFF",
  },
};

describe("SearchInputQuery", () => {
  const mockOnSearchResult = jest.fn();

  beforeEach(() => {
    mockOnSearchResult.mockClear();
    // Clear Monaco mock calls
    Object.values(mockMonaco.languages).forEach((fn) => {
      if (jest.isMockFunction(fn)) {
        fn.mockClear();
      }
    });
    mockMonaco.editor.defineTheme.mockClear();
  });

  describe("Rendering", () => {
    it("renders with required props", () => {
      render(
        <SearchInputQuery
          schemas={mockSchemas}
          onSearchResult={mockOnSearchResult}
          editorTheme={mockEditorTheme}
        />
      );

      const editorElement = screen.getByTestId("mock-editor");
      expect(editorElement).toBeInTheDocument();
    });

    it("initializes Monaco editor with search query language", async () => {
      render(
        <SearchInputQuery
          schemas={mockSchemas}
          onSearchResult={mockOnSearchResult}
          editorTheme={mockEditorTheme}
        />
      );

      await waitFor(() => {
        expect(mockMonaco.languages.register).toHaveBeenCalledWith({
          id: "searchQuery",
        });
        expect(
          mockMonaco.languages.setMonarchTokensProvider
        ).toHaveBeenCalled();
        expect(
          mockMonaco.languages.setLanguageConfiguration
        ).toHaveBeenCalled();
        expect(
          mockMonaco.languages.registerCompletionItemProvider
        ).toHaveBeenCalled();
      });
    });
  });

  describe("Monaco Integration", () => {
    it("sets up language configuration", async () => {
      render(
        <SearchInputQuery
          schemas={mockSchemas}
          onSearchResult={mockOnSearchResult}
          editorTheme={mockEditorTheme}
        />
      );

      await waitFor(() => {
        expect(
          mockMonaco.languages.setLanguageConfiguration
        ).toHaveBeenCalledWith(
          "searchQuery",
          expect.objectContaining({
            autoClosingPairs: expect.any(Array),
            surroundingPairs: expect.any(Array),
            brackets: expect.any(Array),
          })
        );
      });
    });

    it("registers completion provider", async () => {
      render(
        <SearchInputQuery
          schemas={mockSchemas}
          onSearchResult={mockOnSearchResult}
          editorTheme={mockEditorTheme}
        />
      );

      await waitFor(() => {
        expect(
          mockMonaco.languages.registerCompletionItemProvider
        ).toHaveBeenCalledWith("searchQuery", expect.any(Object));
      });
    });

    it("defines editor theme", async () => {
      render(
        <SearchInputQuery
          schemas={mockSchemas}
          onSearchResult={mockOnSearchResult}
          editorTheme={mockEditorTheme}
        />
      );

      await waitFor(() => {
        expect(mockMonaco.editor.defineTheme).toHaveBeenCalledWith(
          "searchQueryTheme",
          mockEditorTheme
        );
      });
    });
  });
});
