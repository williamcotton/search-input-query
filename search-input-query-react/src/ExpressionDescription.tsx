import React from "react";
import { Expression } from "../../search-input-query-parser/src/parser";

// Helper function to convert Expression to English description
const expressionToEnglish = (
  expr: Expression | null,
  depth: number = 0
): string => {
  if (!expr) {
    return "";
  }

  const indent = "  ".repeat(depth);

  switch (expr.type) {
    case "SEARCH_TERM":
      return `${indent}Search for "${expr.value}"`;

    case "FIELD_VALUE":
      return `${indent}${expr.field.value} contains "${expr.value.value}"`;

    case "RANGE": {
      const fieldName = expr.field.value;

      if (expr.operator === "BETWEEN") {
        return `${indent}${fieldName} is between ${expr.value.value} and ${expr.value2?.value}`;
      }

      const operatorText = {
        ">": "greater than",
        ">=": "greater than or equal to",
        "<": "less than",
        "<=": "less than or equal to",
      }[expr.operator];

      return `${indent}${fieldName} is ${operatorText} ${expr.value.value}`;
    }

    case "NOT":
      return `${indent}NOT:\n${expressionToEnglish(
        expr.expression,
        depth + 1
      )}`;

    case "AND":
      return `${indent}ALL of:\n${expressionToEnglish(
        expr.left,
        depth + 1
      )}\n${expressionToEnglish(expr.right, depth + 1)}`;

    case "OR":
      return `${indent}ANY of:\n${expressionToEnglish(
        expr.left,
        depth + 1
      )}\n${expressionToEnglish(expr.right, depth + 1)}`;

    default:
      return "";
  }
};

interface ExpressionDescriptionProps {
  expression: Expression | null;
}

export const ExpressionDescription: React.FC<ExpressionDescriptionProps> = ({
  expression,
}) => {
  const description = expressionToEnglish(expression);

  if (!description) {
    return null;
  }

  return (
    <div className="bg-gray-50 p-4 rounded-lg">
      <h3 className="text-lg font-semibold mb-2">Query Description:</h3>
      <pre className="font-mono text-sm whitespace-pre-wrap">{description}</pre>
    </div>
  );
};
