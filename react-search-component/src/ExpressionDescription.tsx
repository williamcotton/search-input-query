import React from "react";
import { Expression } from "../../typescript-parser/src/parser";

// Helper function to convert Expression to English description
const expressionToEnglish = (expr: Expression | null): string => {
  if (!expr) {
    return "";
  }
  switch (expr.type) {
    case "SEARCH_TERM":
      return `Searching for "${expr.value}"`;

    case "FIELD_VALUE":
      return `Items where ${expr.field.value} is "${expr.value.value}"`;

    case "RANGE":
      if (expr.operator === "BETWEEN") {
        return `Items where ${expr.field.value} is between "${expr.value.value}" and "${expr.value2?.value}"`;
      } else {
        const operatorText = {
          ">": "greater than",
          ">=": "greater than or equal to",
          "<": "less than",
          "<=": "less than or equal to",
        }[expr.operator];

        return `Items where ${expr.field.value} is ${operatorText} "${expr.value.value}"`;
      }

    case "NOT":
      return `Not (${expressionToEnglish(expr.expression)})`;

    case "AND":
      return `${expressionToEnglish(expr.left)}\n— and —\n${expressionToEnglish(
        expr.right
      )}`;

    case "OR":
      return `${expressionToEnglish(expr.left)}\n— or —\n${expressionToEnglish(
        expr.right
      )}`;

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

  return (
    <div className="expression-description">
      {description.split("\n").map((line, index) => (
        <div key={index} className="description-line">
          {line}
        </div>
      ))}
    </div>
  );
};
