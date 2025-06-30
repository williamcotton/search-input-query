import type { Monaco } from "./SearchInputQuery";
import { editor } from "monaco-editor";

export function registerSearchQueryLanguage(
  monaco: Monaco,
  themeData: editor.IStandaloneThemeData
) {
  // Register a new language
  monaco.languages.register({ id: "searchQuery" });

  // Register a tokens provider for the language
  monaco.languages.setMonarchTokensProvider("searchQuery", {
    ignoreCase: true,

    // Set defaultToken to invalid to see what you do not tokenize yet
    defaultToken: "text",

    // Keywords and operators
    keywords: ["AND", "OR", "NOT", "IN", "orderby", "asc", "desc"],
    operators: [":", ">=", "<=", ">", "<", "..", ","],

    // The main tokenizer for our languages
    tokenizer: {
      root: [
        // Special handling for orderby expressions
        [/\borderby\s*:/, { token: "keyword", next: "@orderby" }],

        // Logical operators (must come before field detection)
        [/\b(AND|OR|NOT|IN)\b/, "keyword"],
        [/(?<=:)\s*IN*/, "value"],

        // Invalid field patterns (must come before valid field patterns)
        [/[^a-zA-Z0-9_-]+(?=:)/, "field"], // Invalid field characters
        [/[a-zA-Z0-9_-]*\*+[a-zA-Z0-9_-]*(?=:)/, "field"], // Fields with wildcards

        // Field:value pairs
        [/[a-zA-Z][a-zA-Z0-9_-]*(?=\s*:)/, "field"], // Field before colon
        [/:/, "operator"],
        [/(?<=:)\s*"/, { token: "string.quote", next: "@string" }], // Quoted string after colon
        [/(?<=:)\s*-?\d+(\.\d+)?/, "number"], // Numbers after colon
        [/(?<=:)\s*\d{4}-\d{2}-\d{2}/, "date"], // Dates after colon
        [/(?<=:)\s*[a-zA-Z][a-zA-Z0-9_-]*/, "value"], // Plain values after colon
        // Plain values after colon

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

        // Comma for IN operator lists
        [/,/, "delimiter"],
      ],

      // State for handling orderby expressions
      orderby: [
        // Sort directions
        [/\b(asc|desc)\b/, "keyword"],
        
        // Field names in orderby
        [/[a-zA-Z][a-zA-Z0-9_-]*/, "field"],
        
        // Comma separators between columns
        [/,/, "operator"],
        
        // Whitespace
        [/\s+/, "white"],
        
        // Exit orderby state on AND/OR (return to root)
        [/\b(AND|OR)\b/, { token: "keyword", next: "@pop" }],
        
        // End of line or other tokens should go back to root
        [/(?=\S)/, { token: "", next: "@pop" }],
      ],

      string: [
        [/[^\\"]+/, "string"],
        [/\\./, "string.escape"],
        [/"/, { token: "string.quote", next: "@pop" }],
      ],
    },
  });

  // Define a new theme that contains rules that match this language
  monaco.editor.defineTheme("searchQueryTheme", themeData);
}
