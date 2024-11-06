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
      { token: "keyword", foreground: "0000FF", fontStyle: "bold" }, // Blue, bold
      { token: "field", foreground: "CF222E", fontStyle: "bold" }, // Red, bold for fields
      { token: "value", foreground: "116329" }, // Dark green for values
      { token: "operator", foreground: "953800" }, // Orange brown
      { token: "string", foreground: "0550AE" }, // Blue
      { token: "string.invalid", foreground: "FF0000", fontStyle: "bold" }, // Red, bold
      { token: "string.escape", foreground: "0550AE", fontStyle: "bold" }, // Blue, bold
      { token: "string.quote", foreground: "0550AE" }, // Blue
      { token: "number", foreground: "0550AE" }, // Blue
      { token: "date", foreground: "0550AE" }, // Blue
      { token: "identifier", foreground: "24292F" }, // Dark gray
      { token: "@brackets", foreground: "953800" }, // Orange brown
      { token: "text", foreground: "24292F" }, // Dark gray for default text
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
