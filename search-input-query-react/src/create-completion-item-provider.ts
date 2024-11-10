import type { editor, languages, Position, IRange } from "monaco-editor";

import { FieldSchema } from "../../search-input-query-parser/src/parser";

import { Monaco } from "./SearchInputQuery";

interface CompletionItem extends languages.CompletionItem {
  insertText: string;
  documentation?: {
    value: string;
  };
}

export function createCompletionItemProvider(
  monaco: Monaco,
  schemas: FieldSchema[]
): languages.CompletionItemProvider {
  return {
    triggerCharacters: [":", " "],
    provideCompletionItems: (
      model: editor.ITextModel,
      position: Position
    ): languages.ProviderResult<languages.CompletionList> => {
      const wordUntilPosition = model.getWordUntilPosition(position);
      const range: IRange = {
        startLineNumber: position.lineNumber,
        startColumn: wordUntilPosition.startColumn,
        endLineNumber: position.lineNumber,
        endColumn: wordUntilPosition.endColumn,
      };

      console.log("wordUntilPosition", wordUntilPosition);

      const textUntilPosition = model.getValueInRange({
        startLineNumber: 1,
        startColumn: 1,
        endLineNumber: position.lineNumber,
        endColumn: position.column,
      });

      // Get the current line's text
      const currentLineText = model.getLineContent(position.lineNumber);

      const lastWord = currentLineText.split(/[\s]+/).pop();
      const isAfterColon = lastWord?.includes(":");

      // Check if there's already a colon after the current word
      const hasColonAfter = currentLineText
        .substring(position.column - 1)
        .trimStart()
        .startsWith(":");

      const words = textUntilPosition.split(/[\s:]+/);
      const currentWord = words[words.length - 1].toLowerCase();
      const previousWord = words[words.length - 2]?.toLowerCase();
      
      let suggestions: CompletionItem[] = [];

      // Suggest fields when not after a colon
      if (!isAfterColon) {
        // Filter schemas based on current input
        const fieldSuggestions: CompletionItem[] = schemas
          .filter((schema) => schema.name.toLowerCase().includes(currentWord))
          .map((schema) => ({
            label: schema.name,
            kind: monaco.languages.CompletionItemKind.Field,
            insertText: schema.name + (hasColonAfter ? "" : ":"),
            detail: `Field (${schema.type})`,
            documentation: {
              value: `Search by ${schema.name}\nType: ${schema.type}`,
            },
            range,
          }));

        // Add logical operators
        const operators: CompletionItem[] = ["AND", "OR", "NOT"]
          .filter((op) => op.toLowerCase().includes(currentWord))
          .map((op) => ({
            label: op,
            kind: monaco.languages.CompletionItemKind.Operator,
            insertText: op,
            documentation: {
              value: `Logical operator: ${op}`,
            },
            range,
          }));

        suggestions = [...fieldSuggestions, ...operators];
      }
      // Suggest values after a colon based on field type
      else if (previousWord) {
        const schema = schemas.find(
          (s) => s.name.toLowerCase() === previousWord.toLowerCase()
        );
        if (schema) {
          switch (schema.type) {
            case "boolean":
              suggestions = ["true", "false"].map((value) => ({
                label: value,
                kind: monaco.languages.CompletionItemKind.Value,
                insertText: value,
                range,
              }));
              break;

            case "string":
              suggestions = [
                {
                  label: "IN",
                  kind: monaco.languages.CompletionItemKind.Operator,
                  insertText: "IN",
                  documentation: {
                    value: "IN operator for multiple values (e.g., IN(value1,value2))",
                  },
                  range,
                },
              ];
              break;

            case "number":
              suggestions = [
                {
                  label: ">",
                  kind: monaco.languages.CompletionItemKind.Operator,
                  insertText: ">",
                  range,
                },
                {
                  label: ">=",
                  kind: monaco.languages.CompletionItemKind.Operator,
                  insertText: ">=",
                  range,
                },
                {
                  label: "<",
                  kind: monaco.languages.CompletionItemKind.Operator,
                  insertText: "<",
                  range,
                },
                {
                  label: "<=",
                  kind: monaco.languages.CompletionItemKind.Operator,
                  insertText: "<=",
                  range,
                },
                {
                  label: "..",
                  kind: monaco.languages.CompletionItemKind.Operator,
                  insertText: "..",
                  documentation: {
                    value: "Range operator (e.g. 10..20)",
                  },
                  range,
                },
                {
                  label: "IN",
                  kind: monaco.languages.CompletionItemKind.Operator,
                  insertText: "IN",
                  documentation: {
                    value: "IN operator for multiple values (e.g., IN(value1,value2))",
                  },
                  range,
                }
              ];
              break;

            case "date":
              suggestions = [
                {
                  label: "YYYY-MM-DD",
                  kind: monaco.languages.CompletionItemKind.Value,
                  insertText: new Date().toISOString().split("T")[0],
                  documentation: {
                    value: "Date in YYYY-MM-DD format",
                  },
                  range,
                },
              ];
              break;
          }
        }
      }

      return {
        suggestions,
      };
    },
  };
}
