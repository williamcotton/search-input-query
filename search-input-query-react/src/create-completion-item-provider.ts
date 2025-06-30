import type { editor, languages, Position, IRange } from "monaco-editor";

import { FieldSchema as BaseFieldSchema } from "search-input-query-parser";

import { Monaco } from "./SearchInputQuery";

// Extended FieldSchema interface to support value autocompletion
interface FieldSchema extends BaseFieldSchema {
  values?: string[]; // Optional array of predefined values for autocompletion
}

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
    triggerCharacters: [":", " ", ",", "("],
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

      const textUntilPosition = model.getValueInRange({
        startLineNumber: 1,
        startColumn: 1,
        endLineNumber: position.lineNumber,
        endColumn: position.column,
      });

      // Get the current line's text
      const currentLineText = model.getLineContent(position.lineNumber);

      // Check if we're in an orderby context
      const orderbyMatch = textUntilPosition.match(/\borderby\s*:\s*([^:]*?)$/i);
      const isInOrderByContext = !!orderbyMatch;

      const lastWord = currentLineText.split(/[\s]+/).pop();
      const isAfterColon = lastWord?.includes(":");

      // Check if there's already a colon after the current word
      const hasColonAfter = currentLineText
        .substring(position.column - 1)
        .trimStart()
        .startsWith(":");

      const words = textUntilPosition.split(/[\s:,]+/);
      const currentWord = words[words.length - 1].toLowerCase();
      const previousWord = words[words.length - 2]?.toLowerCase();

      // Check if we're inside an IN expression and extract the current value properly
      const inExpressionMatch = textUntilPosition.match(/(\w+)\s*:\s*IN\s*\(([^)]*)$/i);
      let currentWordInIN = "";
      if (inExpressionMatch) {
        const insideParens = inExpressionMatch[2]; // Everything inside parentheses
        const values = insideParens.split(',');
        currentWordInIN = values[values.length - 1].trim().toLowerCase(); // Get the last value being typed
      }

      let suggestions: CompletionItem[] = [];

      // Special handling for orderby context
      if (isInOrderByContext) {
        const orderbyContent = orderbyMatch[1];
        
        // Check if we're after a field name and should suggest asc/desc
        const lastToken = orderbyContent.trim().split(/[\s,]+/).pop();
        const isAfterFieldInOrderBy = lastToken && 
          schemas.some(schema => schema.name.toLowerCase() === lastToken.toLowerCase()) &&
          !/(asc|desc)$/i.test(orderbyContent);

        if (isAfterFieldInOrderBy) {
          // Suggest asc/desc after field names
          suggestions = ["asc", "desc"]
            .filter((dir) => dir.toLowerCase().includes(currentWord))
            .map((dir) => ({
              label: dir,
              kind: monaco.languages.CompletionItemKind.Keyword,
              insertText: dir,
              documentation: {
                value: `Sort direction: ${dir}ending order`,
              },
              range,
            }));
        } else {
          // Suggest field names in orderby context
          const fieldSuggestions: CompletionItem[] = schemas
            .filter((schema) => schema.name.toLowerCase().includes(currentWord))
            .map((schema) => ({
              label: schema.name,
              kind: monaco.languages.CompletionItemKind.Field,
              insertText: schema.name,
              detail: `Column (${schema.type})`,
              documentation: {
                value: `Sort by ${schema.name}\nType: ${schema.type}`,
              },
              range,
            }));

          suggestions = fieldSuggestions;
        }
        
        return { suggestions };
      }

      // Regular field suggestions when not after a colon
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

        // Add orderby as a special operator
        const orderByOperator: CompletionItem[] = currentWord === "" || "orderby".includes(currentWord)
          ? [
              {
                label: "orderby",
                kind: monaco.languages.CompletionItemKind.Keyword,
                insertText: "orderby:",
                detail: "Sort results",
                documentation: {
                  value: "Sort results by one or more columns\nUsage: orderby:column1 asc, column2 desc",
                },
                range,
              },
            ]
          : [];

        suggestions = [...fieldSuggestions, ...operators, ...orderByOperator];
      }
      // Check if we're inside an IN expression (inside parentheses)
      else if (inExpressionMatch) {
        const fieldName = inExpressionMatch[1];
        const schema = schemas.find(
          (s) => s.name.toLowerCase() === fieldName.toLowerCase()
        );
        
        if (schema && schema.values && schema.values.length > 0) {
          // Suggest predefined values for IN expression, using the properly extracted word
          const valueSuggestions: CompletionItem[] = schema.values
            .filter((value) => value.toLowerCase().includes(currentWordInIN))
            .map((value) => ({
              label: value,
              kind: monaco.languages.CompletionItemKind.Value,
              insertText: value,
              detail: `${schema.name} option`,
              documentation: {
                value: `Add ${value} to IN expression for ${schema.name}`,
              },
              range,
            }));

          suggestions = valueSuggestions;
        }
      }
      // Suggest values after a colon based on field type
      else if (previousWord && previousWord !== "orderby") {
        // TODO: fix issue with completion items not disappearing after typing
        const schema = schemas.find(
          (s) => s.name.toLowerCase() === previousWord.toLowerCase()
        );
        if (schema) {
          // Check if schema has predefined values
          if (schema.values && schema.values.length > 0) {
            // Suggest predefined values with filtering based on current input
            const valueSuggestions: CompletionItem[] = schema.values
              .filter((value) => value.toLowerCase().includes(currentWord))
              .map((value) => ({
                label: value,
                kind: monaco.languages.CompletionItemKind.Value,
                insertText: value,
                detail: `${schema.name} option`,
                documentation: {
                  value: `Predefined value for ${schema.name}: ${value}`,
                },
                range,
              }));

            // Also add IN operator for multi-value selection
            const inOperator: CompletionItem[] = 
              (currentWord === "" || "IN".toLowerCase().includes(currentWord)) ? [
                {
                  label: "IN",
                  kind: monaco.languages.CompletionItemKind.Operator,
                  insertText: "IN",
                  documentation: {
                    value: "IN operator for multiple values (e.g., IN(value1,value2))",
                  },
                  range,
                }
              ] : [];

            suggestions = [...valueSuggestions, ...inOperator];
          } else {
            // Fallback to original type-based suggestions
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
      }

      return {
        suggestions,
      };
    },
  };
}
