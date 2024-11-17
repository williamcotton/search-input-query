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
  { name: 'date', type: 'date' }
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
