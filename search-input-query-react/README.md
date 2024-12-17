## React Component

### Features

- Monaco editor integration with syntax highlighting
- Real-time validation and error highlighting
- Auto-completion for fields and operators
- Support for all query syntax features
- Customizable editor theme
- Error decorations with hover messages
- Auto-closing quotes and brackets

The React component provides a rich editing experience with immediate feedback on query validity. It handles all parsing and validation internally, providing clean results through the `onSearchResult` callback.

### Installation

```bash
npm install search-input-query-react
```

### Basic Usage

```typescript
import { SearchInputQuery, EditorTheme } from 'search-input-query-react';
import type { Expression, FieldSchema, ValidationError } from 'search-input-query-parser';

// Define your schemas
const schemas: FieldSchema[] = [
  { name: 'title', type: 'string' },
  { name: 'price', type: 'number' },
  { name: 'date', type: 'date' },
  { name: 'in_stock', type: 'boolean' }
];

// Define your editor theme (optional, defaults provided)
const editorTheme: EditorTheme = {
  base: 'vs',
  inherit: true,
  rules: [
    { token: 'keyword', foreground: '#794938', fontStyle: 'bold' },
    { token: 'field', foreground: '#234A97', fontStyle: 'bold' },
    { token: 'value', foreground: '#0B6125' }
    // Add more token rules as needed
  ],
  colors: {
    'editor.foreground': '#24292F',
    'editor.background': '#FFFFFF',
    // Add more color settings as needed
  }
};

function SearchComponent() {
  const handleSearchResult = (result: {
    expression: Expression | null;
    parsedResult: string;
    errors: ValidationError[];
  }) => {
    if (result.errors.length === 0) {
      // Handle successful parse
      console.log('Parsed expression:', result.expression);
      console.log('Stringified result:', result.parsedResult);
    } else {
      // Handle validation errors
      console.log('Parse errors:', result.errors);
    }
  };

  return (
    <SearchInputQuery 
      schemas={schemas}
      onSearchResult={handleSearchResult}
      editorTheme={editorTheme}
    />
  );
}
```

### Component Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `schemas` | `FieldSchema[]` | Yes | Array of field definitions for validation and auto-completion |
| `onSearchResult` | `(result: SearchResult) => void` | Yes | Callback fired on query changes with parse results |
| `editorTheme` | `EditorTheme` | No | Monaco editor theme configuration |
