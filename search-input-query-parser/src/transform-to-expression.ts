import { FirstPassExpression } from "./first-pass-parser";
import { parseRangeExpression } from "./parse-range-expression";
import { FieldSchema, Expression } from "./parser";

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
  }
};
