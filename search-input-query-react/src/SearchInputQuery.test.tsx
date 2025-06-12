import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
// import userEvent from "@testing-library/user-event";
import SearchInputQuery from "./SearchInputQuery";
import { FieldSchema } from "search-input-query-parser";
import type { EditorTheme } from "./SearchInputQuery";
import { parseSearchInputQuery } from "search-input-query-parser";

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
  createDecorationsCollection: (decorations: MockDecoration[]) => void;
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
    addKeybindingRule: jest.fn(),
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
  KeyMod: {
    CtrlCmd: 2048,
    Shift: 1024,
    Alt: 512,
    WinCtrl: 256
  },
  KeyCode: {
    Enter: 13,
    KeyF: 33
  },
  Range: jest.fn().mockImplementation((startLine, startCol, endLine, endCol) => {
    return { startLine, startCol, endLine, endCol };
  }),
};

// Track editor action registrations
const mockAddAction = jest.fn();

// Track decorations
const mockDeltaDecorations = jest.fn().mockReturnValue(["decoration-id-1"]);
const mockGetAllDecorations = jest.fn().mockReturnValue([]);
const mockCreateDecorationsCollection = jest.fn();

// Mock Monaco Editor
jest.mock("@monaco-editor/react", () => {
  return function MockEditor({ onChange, onMount, defaultValue }: MockEditorProps & { defaultValue?: string }) {
    React.useEffect(() => {
      if (onMount) {
        // Create a variable to store current value
        let currentValue = defaultValue || "";
        
        const mockEditor: MockEditorInstance = {
          getValue: () => currentValue,
          setValue: (value) => {
            currentValue = value;
            // Important: Trigger onChange when setValue is called
            if (onChange) {
              onChange(value);
            }
          },
          focus: jest.fn(),
          addAction: mockAddAction,
          getModel: () => ({
            getAllDecorations: mockGetAllDecorations,
            deltaDecorations: mockDeltaDecorations,
          }),
          createDecorationsCollection: mockCreateDecorationsCollection,
        };
        
        onMount(mockEditor, mockMonaco);
        
        // Trigger initial search with default value
        if (defaultValue && onChange) {
          onChange(defaultValue);
        }
      }
    }, [onMount, onChange, defaultValue]);

    return (
      <div data-testid="mock-editor">
        <input
          type="text"
          defaultValue={defaultValue}
          onChange={(e) => onChange?.(e.target.value)}
          data-testid="editor-input"
        />
      </div>
    );
  };
});

// Mock search-input-query-parser module
jest.mock("search-input-query-parser", () => {
  return {
    parseSearchInputQuery: jest.fn().mockImplementation((query) => {
      // Mock error case for specific queries
      if (query.includes("error")) {
        return {
          type: "SEARCH_QUERY_ERROR",
          errors: [
            {
              message: "Mock parsing error",
              position: 0,
              length: 5,
              code: 0,
            },
          ],
        };
      }
      
      // Mock valid case
      return {
        type: "SEARCH_QUERY_SUCCESS",
        expression: { type: "value", value: query },
      };
    }),
    stringify: jest.fn().mockImplementation((expr) => {
      return `Stringified: ${JSON.stringify(expr)}`;
    }),
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
    mockAddAction.mockClear();
    mockDeltaDecorations.mockClear();
    mockGetAllDecorations.mockClear();
    mockCreateDecorationsCollection.mockClear();
    
    // Reset decoration mock behavior
    mockGetAllDecorations.mockReturnValue([]);
    
    // Clear Monaco mock calls
    Object.values(mockMonaco.languages).forEach((fn) => {
      if (jest.isMockFunction(fn)) {
        fn.mockClear();
      }
    });
    mockMonaco.editor.defineTheme.mockClear();
    mockMonaco.editor.addKeybindingRule.mockClear();
    
    // Clear parser mocks
    jest.clearAllMocks();
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

  describe("Input and Search Functionality", () => {
    it("handles input changes and triggers search", async () => {
      render(
        <SearchInputQuery
          schemas={mockSchemas}
          onSearchResult={mockOnSearchResult}
          editorTheme={mockEditorTheme}
        />
      );

      const editorInput = screen.getByTestId("editor-input");
      fireEvent.change(editorInput, { target: { value: "test query" } });

      await waitFor(() => {
        expect(mockOnSearchResult).toHaveBeenCalledWith(expect.objectContaining({
          expression: expect.any(Object),
          parsedResult: expect.stringContaining("Stringified:"),
          errors: [],
          query: "test query",
        }));
      });
    });

    it("handles empty queries", async () => {
      render(
        <SearchInputQuery
          schemas={mockSchemas}
          onSearchResult={mockOnSearchResult}
          editorTheme={mockEditorTheme}
        />
      );

      const editorInput = screen.getByTestId("editor-input");
      // First enter some text
      fireEvent.change(editorInput, { target: { value: "some query" } });
      // Then clear it
      fireEvent.change(editorInput, { target: { value: "" } });

      await waitFor(() => {
        expect(mockOnSearchResult).toHaveBeenLastCalledWith({
          expression: null,
          parsedResult: "",
          errors: [],
          query: "",
        });
      });
    });

    it("handles query parsing errors", async () => {
      render(
        <SearchInputQuery
          schemas={mockSchemas}
          onSearchResult={mockOnSearchResult}
          editorTheme={mockEditorTheme}
        />
      );

      const editorInput = screen.getByTestId("editor-input");
      fireEvent.change(editorInput, { target: { value: "error in query" } });

      await waitFor(() => {
        expect(mockOnSearchResult).toHaveBeenCalledWith(expect.objectContaining({
          expression: null,
          parsedResult: "",
          errors: expect.arrayContaining([
            expect.objectContaining({
              message: "Mock parsing error",
            }),
          ]),
          query: "error in query",
        }));
      });
    });
  });

  describe("Default Value Handling", () => {
    it("initializes with default value when provided", async () => {
      const defaultValue = "initial query";
      
      render(
        <SearchInputQuery
          schemas={mockSchemas}
          onSearchResult={mockOnSearchResult}
          editorTheme={mockEditorTheme}
          defaultValue={defaultValue}
        />
      );

      // Wait for editor to initialize and trigger search
      await waitFor(() => {
        expect(mockOnSearchResult).toHaveBeenCalledWith(expect.objectContaining({
          query: defaultValue,
        }));
      });
    });
  });

  describe("Error Handling", () => {
    it("properly creates error decorations for parsing errors", async () => {
      render(
        <SearchInputQuery
          schemas={mockSchemas}
          onSearchResult={mockOnSearchResult}
          editorTheme={mockEditorTheme}
        />
      );

      const editorInput = screen.getByTestId("editor-input");
      fireEvent.change(editorInput, { target: { value: "error in query" } });

      await waitFor(() => {
        expect(mockCreateDecorationsCollection).toHaveBeenCalledWith(
          expect.arrayContaining([
            expect.objectContaining({
              options: expect.objectContaining({
                inlineClassName: "search-input-error",
                hoverMessage: expect.objectContaining({
                  value: "Mock parsing error"
                }),
              })
            })
          ])
        );
      });
    });

    it("handles unexpected errors during parsing", async () => {
      // Setup a one-time error in parseSearchInputQuery
      (parseSearchInputQuery as jest.Mock).mockImplementationOnce(() => {
        throw new Error("Unexpected error during parsing");
      });

      render(
        <SearchInputQuery
          schemas={mockSchemas}
          onSearchResult={mockOnSearchResult}
          editorTheme={mockEditorTheme}
        />
      );

      const editorInput = screen.getByTestId("editor-input");
      fireEvent.change(editorInput, { target: { value: "query causing exception" } });

      await waitFor(() => {
        expect(mockOnSearchResult).toHaveBeenCalledWith(expect.objectContaining({
          expression: null,
          parsedResult: "",
          errors: expect.arrayContaining([
            expect.objectContaining({
              message: "Unexpected error during parsing"
            })
          ]),
          query: "query causing exception"
        }));
      });
    });

    it("clears existing error decorations before adding new ones", async () => {
      // Setup existing decorations
      mockGetAllDecorations.mockReturnValueOnce([
        { 
          id: "old-decoration-1", 
          options: { inlineClassName: "search-input-error" } 
        },
        { 
          id: "old-decoration-2", 
          options: { inlineClassName: "search-input-error" } 
        }
      ]);

      render(
        <SearchInputQuery
          schemas={mockSchemas}
          onSearchResult={mockOnSearchResult}
          editorTheme={mockEditorTheme}
        />
      );

      const editorInput = screen.getByTestId("editor-input");
      fireEvent.change(editorInput, { target: { value: "error in query" } });

      await waitFor(() => {
        // Should clear old decorations first
        expect(mockDeltaDecorations).toHaveBeenCalledWith(
          ["old-decoration-1", "old-decoration-2"],
          []
        );
        // Then add new decorations
        expect(mockCreateDecorationsCollection).toHaveBeenCalled();
      });
    });
  });

  describe("Editor Actions", () => {
    it("registers a search action with Enter key binding", async () => {
      render(
        <SearchInputQuery
          schemas={mockSchemas}
          onSearchResult={mockOnSearchResult}
          editorTheme={mockEditorTheme}
        />
      );

      await waitFor(() => {
        // Verify that addAction was called with a search action
        expect(mockAddAction).toHaveBeenCalledWith(
          expect.objectContaining({
            id: "submitSearch",
            label: "Submit Search",
            keybindings: [mockMonaco.KeyCode.Enter]
          })
        );
      });
    });

    it("disables the browser's default Ctrl+F behavior", async () => {
      render(
        <SearchInputQuery
          schemas={mockSchemas}
          onSearchResult={mockOnSearchResult}
          editorTheme={mockEditorTheme}
        />
      );

      await waitFor(() => {
        expect(mockMonaco.editor.addKeybindingRule).toHaveBeenCalledWith(
          expect.objectContaining({
            keybinding: mockMonaco.KeyMod.CtrlCmd | mockMonaco.KeyCode.KeyF,
            command: null
          })
        );
      });
    });
  });

  describe("Schema Integration", () => {
    it("passes schemas to parser", async () => {
      (parseSearchInputQuery as jest.Mock).mockClear();
      
      render(
        <SearchInputQuery
          schemas={mockSchemas}
          onSearchResult={mockOnSearchResult}
          editorTheme={mockEditorTheme}
        />
      );

      const editorInput = screen.getByTestId("editor-input");
      fireEvent.change(editorInput, { target: { value: "test query" } });

      await waitFor(() => {
        expect(parseSearchInputQuery).toHaveBeenCalledWith(
          "test query", 
          mockSchemas
        );
      });
    });
  });
});
