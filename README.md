![Test Suite](https://github.com/williamcotton/search-input-query/workflows/Test%20Suite/badge.svg)

# Search Input Query

A powerful search query language parser with SQL output support, inspired by [Elasticsearch](https://www.elastic.co/guide/en/elasticsearch/reference/8.15/query-dsl-query-string-query.html) and [Tantivy](https://docs.rs/tantivy/latest/tantivy/query/struct.QueryParser.html) query syntax.

## Key Features

- Multi-pass recursive descent parser
- Comprehensive type checking and validation
- Rich error reporting with position information
- SQL output with support for multiple search strategies
- React component with Monaco editor integration
- Complete test coverage

## Demo

![sqi-demo](https://github.com/user-attachments/assets/1463555b-91a3-4f7b-9e0e-4172dd78afdd)

### Running Demo

```bash
cd search-input-query-demo
npm install
npm run dev
```

## Parser

### Installation

```typescript
npm install search-input-query-parser
```

### Basic Usage

```typescript
import {
  parseSearchInputQuery,
  type FieldSchema
} from 'search-input-query-parser';

// Define your field schemas
const schemas: FieldSchema[] = [
  { name: 'title', type: 'string' },
  { name: 'price', type: 'number' },
  { name: 'date', type: 'date' },
  { name: 'in_stock', type: 'boolean' }
];

// Parse a search query
const query = 'title:"winter boots" AND price:>100';
const result = parseSearchInputQuery(query, schemas);

if (result.type === 'SEARCH_QUERY') {
  // Handle successful parse where the expression is in AST format
  console.log(result.expression);
} else {
  // Handle validation errors
  console.log(result.errors);
}
```

## React Component

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

### Features

- Monaco editor integration with syntax highlighting
- Real-time validation and error highlighting
- Auto-completion for fields and operators
- Support for all query syntax features
- Customizable editor theme
- Error decorations with hover messages
- Auto-closing quotes and brackets

The React component provides a rich editing experience with immediate feedback on query validity. It handles all parsing and validation internally, providing clean results through the `onSearchResult` callback.

## SQL Conversion

The parser can convert search queries into SQL WHERE clauses using three different search strategies:

1. ILIKE - Case-insensitive pattern matching
2. tsvector - PostgreSQL full-text search
3. ParadeDB - BM25-based full-text search

### Basic Usage

```typescript
import {
  searchStringToIlikeSql,
  searchStringToTsVectorSql,
  searchStringToParadeDBSql,
  type FieldSchema
} from 'search-input-query-parser';

// Define searchable columns and schemas
const searchableColumns = ['title', 'description'];
const schemas: FieldSchema[] = [
  { name: 'title', type: 'string' },
  { name: 'price', type: 'number' },
  { name: 'date', type: 'date' },
  { name: 'in_stock', type: 'boolean' }
];

// Convert a search query to SQL
const query = 'winter boots AND price:>100';

// Using ILIKE (case-insensitive pattern matching)
const ilikeResult = searchStringToIlikeSql(query, searchableColumns, schemas);
// Result:
// {
//   text: "((lower(title) LIKE lower($1) OR lower(description) LIKE lower($1)) AND price > $2)",
//   values: ["%winter boots%", 100]
// }

// Using tsvector (PostgreSQL full-text search)
const tsvectorResult = searchStringToTsVectorSql(query, searchableColumns, schemas);
// Result:
// {
//   text: "((to_tsvector('english', title) || to_tsvector('english', description)) @@ plainto_tsquery('english', $1) AND price > $2)",
//   values: ["winter boots", 100]
// }

// Using ParadeDB (BM25 search)
const paradedbResult = searchStringToParadeDBSql(query, searchableColumns, schemas);
// Result:
// {
//   text: "((title @@@ $1 OR description @@@ $1) AND price @@@ '>' || $2)",
//   values: ['"winter boots"', 100]
// }
```

### Search Types Comparison

| Feature | ILIKE | tsvector | ParadeDB |
|---------|-------|----------|----------|
| Case Sensitivity | Case-insensitive | Case-insensitive | Case-sensitive |
| Pattern Matching | Simple wildcards | Language-aware tokens | BM25 ranking |
| Performance | Slower on large datasets | Fast with proper indexes | Fast with proper indexes |
| Setup Required | None | PostgreSQL extension | ParadeDB extension |
| Best For | Simple searches, small datasets | Advanced text search | Relevance-based search |

### Configuration Options

```typescript
// Common options for all search types
interface SearchQueryOptions {
  language?: string;  // Language for text analysis (default: 'english')
}

// Example with options
const result = searchStringToTsVectorSql(
  query,
  searchableColumns,
  schemas,
  {
    language: 'spanish'
  }
);
```

### Using with Raw SQL

The converters return objects with `text` (the WHERE clause) and `values` (the parameter values):

```typescript
import { searchStringToIlikeSql } from 'search-input-query-parser';

const base = 'SELECT * FROM products';
const { text, values } = searchStringToIlikeSql(query, searchableColumns, schemas);
const fullQuery = `${base} WHERE ${text}`;

// Using with node-postgres
const result = await client.query(fullQuery, values);

// Using with Prisma
const result = await prisma.$queryRaw`${Prisma.raw(base)} WHERE ${Prisma.raw(text)}`;
```

## Language Features

| Category | Expression Pattern | Example | Description |
|----------|-------------------|---------|-------------|
| **Basic Terms** |
| Single Term | `term` | `boots` | Matches documents containing the term |
| Quoted Term | `"term with spaces"` | `"winter boots"` | Matches exact phrase |
| Wildcard | `term*` | `boot*` | Matches terms starting with the prefix |
| **Field Values** |
| Basic Field | `field:value` | `color:red` | Matches specific field value |
| Quoted Field | `field:"value with spaces"` | `category:"winter boots"` | Matches exact phrase in field |
| Field Wildcard | `field:value*` | `title:winter*` | Matches field values starting with prefix |
| **Numeric Ranges** |
| Greater Than | `field:>number` | `price:>100` | Values greater than |
| Greater Equal | `field:>=number` | `price:>=100` | Values greater than or equal |
| Less Than | `field:<number` | `price:<50` | Values less than |
| Less Equal | `field:<=number` | `price:<=50` | Values less than or equal |
| Between Range | `field:min..max` | `price:10..20` | Values in inclusive range |
| Open Range Up | `field:number..` | `price:10..` | Values greater than or equal |
| Open Range Down | `field:..number` | `price:..20` | Values less than or equal |
| **Date Ranges** |
| Date Equals | `field:YYYY-MM-DD` | `date:2024-01-01` | Exact date match |
| Date Range | `field:YYYY-MM-DD..YYYY-MM-DD` | `date:2024-01-01..2024-12-31` | Dates in inclusive range |
| Date Compare | `field:>YYYY-MM-DD` | `date:>2024-01-01` | Dates after specified date |
| **Logical Operators** |
| AND | `expr1 AND expr2` | `boots AND leather` | Both expressions must match |
| OR | `expr1 OR expr2` | `boots OR sandals` | Either expression must match |
| NOT | `NOT expr` | `NOT leather` | Negates the expression |
| Implicit AND | `expr1 expr2` | `boots leather` | Space between terms implies AND |
| **Grouping** |
| Parentheses | `(expr1 OR expr2) AND expr3` | `(boots OR sandals) AND leather` | Groups expressions for precedence |
| **IN Operator** |
| IN List | `field:IN(val1,val2)` | `status:IN(active,pending)` | Field matches any listed value |
| Quoted IN | `field:IN("val 1","val 2")` | `category:IN("winter boots","summer shoes")` | IN with quoted values |

Notes:
- All operators (AND, OR, NOT, IN) are case-insensitive
- Field names are case-insensitive
- Field names must start with a letter and can contain letters, numbers, underscores, and hyphens
- Quotes can be escaped within quoted strings using backslash (`\"`)
- Multiple expressions can be combined using logical operators and parentheses
- The parser follows standard operator precedence: NOT > AND > OR
- Whitespace is ignored around operators and parentheses
