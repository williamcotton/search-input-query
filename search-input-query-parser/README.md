# Search Input Query

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
