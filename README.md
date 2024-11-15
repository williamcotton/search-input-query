# Search Input Query

A DSL reminiscent of other fulltext string-based query languages such as [Elasticsearch](https://www.elastic.co/guide/en/elasticsearch/reference/8.15/query-dsl-query-string-query.html) and [Tantivy](https://docs.rs/tantivy/latest/tantivy/query/struct.QueryParser.html)

Features a multi-pass recursive descent parser with support for multiple errors and type checking.

Converts the resulting AST to a number of formats including basic SQL LIKE queries, PostgresQL fulltext and ParadeBD bm25 search.

## Demo

![sqi-demo](https://github.com/user-attachments/assets/1463555b-91a3-4f7b-9e0e-4172dd78afdd)

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

## Features

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
