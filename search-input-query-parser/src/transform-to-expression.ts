import { FirstPassExpression } from "./first-pass-parser";
import { parseRangeExpression } from "./parse-range-expression";
import { FieldSchema, Expression, Value, OrderByExpression, SortColumn } from "./parser";

// Helper function to parse orderby expression
const parseOrderByExpression = (
  value: string,
  position: number,
  colonIndex: number
): OrderByExpression => {
  const columns: SortColumn[] = [];
  
  // Split by comma to get individual column specifications
  const columnSpecs = value.split(',').map(spec => spec.trim());
  
  for (const spec of columnSpecs) {
    if (!spec) continue;
    
    const parts = spec.split(/\s+/);
    const column = parts[0];
    const direction = parts[1]?.toLowerCase() === 'desc' ? 'desc' : 'asc';
    
    if (column) {
      columns.push({ column, direction });
    }
  }
  
  return {
    type: "ORDER_BY",
    columns,
    position,
    length: colonIndex + 1 + value.length,
  };
};

// Helper to transform FirstPassExpression into Expression
export const transformToExpression = (
  expr: FirstPassExpression,
  schemas: Map<string, FieldSchema>
): Expression => {
  switch (expr.type) {
    case "NOT":
      return {
        type: "NOT",
        expression: transformToExpression(expr.expression, schemas),
        position: expr.position,
        length: expr.length,
      };

    case "WILDCARD":
      // Check if this is part of a field:value pattern by looking at the prefix
      const colonIndex = expr.prefix.indexOf(":");
      if (colonIndex !== -1) {
        const field = expr.prefix.substring(0, colonIndex).trim();
        const prefix = expr.prefix.substring(colonIndex + 1).trim();

        return {
          type: "FIELD_VALUE",
          field: {
            type: "FIELD",
            value: field,
            position: expr.position - colonIndex - 1, // Adjust for the field part
            length: colonIndex,
          },
          value: {
            type: "VALUE",
            value: prefix + "*", // Preserve the wildcard in the value
            position: expr.position,
            length: prefix.length + 1,
          },
        };
      }

      // If not a field:value pattern, return as a wildcard search term
      return {
        type: "WILDCARD",
        prefix: expr.prefix,
        quoted: expr.quoted,
        position: expr.position,
        length: expr.length,
      };

    case "STRING": {
      // Check if the string is a field:value pattern
      const colonIndex = expr.value.indexOf(":");
      if (colonIndex !== -1) {
        const field = expr.value.substring(0, colonIndex).trim();
        let value = expr.value.substring(colonIndex + 1).trim();
        // Remove quotes if present
        value =
          value.startsWith('"') && value.endsWith('"')
            ? value.slice(1, -1)
            : value;

        // Handle special orderby field
        if (field.toLowerCase() === "orderby") {
          return parseOrderByExpression(value, expr.position, colonIndex);
        }

        const schema = schemas.get(field.toLowerCase());

        // Check for range patterns when we have a numeric or date field
        if (schema && (schema.type === "number" || schema.type === "date")) {
          return parseRangeExpression(
            field,
            value,
            schema,
            expr.position,
            colonIndex
          );
        }

        return {
          type: "FIELD_VALUE",
          field: {
            type: "FIELD",
            value: field,
            position: expr.position,
            length: colonIndex,
          },
          value: {
            type: "VALUE",
            value,
            position: expr.position + colonIndex + 1,
            length: value.length,
          },
        };
      }

      return {
        type: "SEARCH_TERM",
        value: expr.value,
        position: expr.position,
        length: expr.length,
      };
    }

    case "AND":
      return {
        type: "AND",
        left: transformToExpression(expr.left, schemas),
        right: transformToExpression(expr.right, schemas),
        position: expr.position,
        length: expr.length,
      };

    case "OR":
      return {
        type: "OR",
        left: transformToExpression(expr.left, schemas),
        right: transformToExpression(expr.right, schemas),
        position: expr.position,
        length: expr.length,
      };

    case "IN": {
      const schema = schemas.get(expr.field.toLowerCase());
      const transformedValues: Value[] = expr.values.map((value, index) => {
        let transformedValue = value;

        // Handle type conversion based on schema
        if (schema?.type === "number") {
          transformedValue = String(Number(value));
        }

        return {
          type: "VALUE",
          value: transformedValue,
          position:
            expr.position + expr.field.length + 3 + index * (value.length + 1), // +3 for ":IN"
          length: value.length,
        };
      });

      return {
        type: "IN",
        field: {
          type: "FIELD",
          value: expr.field,
          position: expr.position,
          length: expr.field.length,
        },
        values: transformedValues,
        position: expr.position,
        length: expr.length,
      };
    }
  }
};
