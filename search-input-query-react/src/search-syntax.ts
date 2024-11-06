import type { Monaco } from "./SearchInputQuery";

export function registerSearchQueryLanguage(monaco: Monaco) {
  // Register a new language
  monaco.languages.register({ id: "searchQuery" });

  // Register a tokens provider for the language
  monaco.languages.setMonarchTokensProvider("searchQuery", {
    ignoreCase: true,

    // Set defaultToken to invalid to see what you do not tokenize yet
    defaultToken: "text",

    // The main tokenizer for our languages
    tokenizer: {
      root: [
        // Logical operators (must come before field detection)
        [/\b(AND|OR|NOT)\b/, "keyword"],

        // Field:value pairs
        [/[a-zA-Z][a-zA-Z0-9_-]*(?=\s*:)/, "field"], // Field before colon
        [/:/, "operator"],
        [/(?<=:)\s*"/, { token: "string.quote", next: "@string" }], // Quoted string after colon
        [/(?<=:)\s*-?\d+(\.\d+)?/, "number"], // Numbers after colon
        [/(?<=:)\s*\d{4}-\d{2}-\d{2}/, "date"], // Dates after colon
        [/(?<=:)\s*[a-zA-Z][a-zA-Z0-9_-]*/, "value"], // Plain values after colon

        // Range operators
        [/\.\./, "operator"],
        [/>=|<=|>|</, "operator"],

        // Quoted strings not part of field:value
        [/"([^"\\]|\\.)*$/, "string.invalid"], // Line does not end with quote
        [/"/, { token: "string.quote", next: "@string" }],

        // Parentheses
        [/[()]/, "@brackets"],

        // Numbers for range queries
        [/-?\d+(\.\d+)?/, "number"],

        // Dates (YYYY-MM-DD)
        [/\d{4}-\d{2}-\d{2}/, "date"],

        // Regular terms
        [/[a-zA-Z][a-zA-Z0-9_-]*/, "identifier"],

        // Whitespace
        [/\s+/, "white"],
      ],

      string: [
        [/[^\\"]+/, "string"],
        [/\\./, "string.escape"],
        [/"/, { token: "string.quote", next: "@pop" }],
      ],
    },
  });

  // Define a new theme that contains rules that match this language
  monaco.editor.defineTheme("searchQueryTheme", {
    base: "vs",
    inherit: true,
    rules: [
      { token: "keyword", foreground: "794938", fontStyle: "bold" }, // Dawn keyword color
      { token: "field", foreground: "BF4F24", fontStyle: "bold" }, // Dawn entity color
      { token: "value", foreground: "0B6125" }, // Dawn string color
      { token: "operator", foreground: "811F24" }, // Dawn constant color
      { token: "string", foreground: "0B6125" }, // Dawn string color
      { token: "string.invalid", foreground: "B52A1D", fontStyle: "bold italic underline" }, // Dawn invalid color
      { token: "string.escape", foreground: "CF5628", fontStyle: "bold" }, // Dawn string.regexp color
      { token: "string.quote", foreground: "0B6125" }, // Dawn string color
      { token: "number", foreground: "811F24" }, // Dawn constant color
      { token: "date", foreground: "811F24" }, // Dawn constant color
      { token: "identifier", foreground: "080808" }, // Dawn foreground color
      { token: "@brackets", foreground: "794938" }, // Dawn punctuation color
      { token: "text", foreground: "080808" }, // Dawn foreground color
    ],
    colors: {
      "editor.foreground": "#24292F",
      "editor.background": "#FFFFFF",
      "editorCursor.foreground": "#24292F",
      "editor.lineHighlightBackground": "#FFFFFF",
      "editorLineNumber.foreground": "#57606A",
      "editor.selectionBackground": "#0550AE15",
      "editor.inactiveSelectionBackground": "#0550AE08",
    },
  });
}
