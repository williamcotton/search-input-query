import { FieldSchema, RangeExpression, FieldValue, RangeOperator } from "./parser";

const isRangeOperator = (str: string): str is RangeOperator => {
  return [">=", ">", "<=", "<"].includes(str);
};

export const parseRangeExpression = (
  fieldName: string,
  value: string,
  schema: FieldSchema | undefined,
  position: number,
  colonIndex: number
): RangeExpression | FieldValue => {
  // Handle ..20 (less than or equal)
  if (value.startsWith("..")) {
    const numValue = value.slice(2);
    return {
      type: "RANGE",
      field: {
        type: "FIELD",
        value: fieldName,
        position,
        length: colonIndex,
      },
      operator: "<=",
      value: {
        type: "VALUE",
        value: numValue,
        position: position + colonIndex + 3, // after colon and ..
        length: numValue.length,
      },
      position,
      length: colonIndex + 1 + value.length,
    };
  }

  // Handle 10.. (greater than or equal)
  if (value.endsWith("..")) {
    const numValue = value.slice(0, -2);
    return {
      type: "RANGE",
      field: {
        type: "FIELD",
        value: fieldName,
        position,
        length: colonIndex,
      },
      operator: ">=",
      value: {
        type: "VALUE",
        value: numValue,
        position: position + colonIndex + 1,
        length: numValue.length,
      },
      position,
      length: colonIndex + 1 + value.length,
    };
  }

  // Handle date ranges with YYYY-MM-DD format
  if (schema?.type === "date") {
    const betweenMatch = value.match(
      /^(\d{4}-\d{2}-\d{2})\.\.(\d{4}-\d{2}-\d{2})$/
    );
    if (betweenMatch) {
      const [_, start, end] = betweenMatch;
      return {
        type: "RANGE",
        field: {
          type: "FIELD",
          value: fieldName,
          position,
          length: colonIndex,
        },
        operator: "BETWEEN",
        value: {
          type: "VALUE",
          value: start,
          position: position + colonIndex + 1,
          length: start.length,
        },
        value2: {
          type: "VALUE",
          value: end,
          position: position + colonIndex + start.length + 3,
          length: end.length,
        },
        position,
        length: colonIndex + 1 + value.length,
      };
    }

    // Handle general date ranges with mixed formats (YYYY, YYYY-MM, YYYY-MM-DD)
    const generalRangeMatch = value.match(/^(.+)\.\.(.+)$/);
    if (generalRangeMatch) {
      const [_, startValue, endValue] = generalRangeMatch;
      
      // Helper function to expand incomplete dates
      const expandDateValue = (dateStr: string, isEndOfRange: boolean): string => {
        // Full date format YYYY-MM-DD
        if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
          return dateStr;
        }
        
        // Year-month format YYYY-MM
        if (/^\d{4}-\d{2}$/.test(dateStr)) {
          if (isEndOfRange) {
            // For end of range, use last day of month
            const [year, month] = dateStr.split('-');
            const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate();
            return `${dateStr}-${lastDay.toString().padStart(2, '0')}`;
          } else {
            // For start of range, use first day of month
            return `${dateStr}-01`;
          }
        }
        
        // Year-only format YYYY
        if (/^\d{4}$/.test(dateStr)) {
          if (isEndOfRange) {
            // For end of range, use last day of year
            return `${dateStr}-12-31`;
          } else {
            // For start of range, use first day of year
            return `${dateStr}-01-01`;
          }
        }
        
        // If format is not recognized, return as-is
        return dateStr;
      };
      
      const expandedStart = expandDateValue(startValue, false);
      const expandedEnd = expandDateValue(endValue, true);
      
      return {
        type: "RANGE",
        field: {
          type: "FIELD",
          value: fieldName,
          position,
          length: colonIndex,
        },
        operator: "BETWEEN",
        value: {
          type: "VALUE",
          value: expandedStart,
          position: position + colonIndex + 1,
          length: startValue.length,
        },
        value2: {
          type: "VALUE",
          value: expandedEnd,
          position: position + colonIndex + startValue.length + 3,
          length: endValue.length,
        },
        position,
        length: colonIndex + 1 + value.length,
      };
    }
  }

  // Handle 10..20 (between), handling floats and negative numbers
  const betweenMatch = value.match(/^(-?\d*\.?\d+)\.\.(-?\d*\.?\d+)$/);
  if (betweenMatch) {
    const [_, start, end] = betweenMatch;
    return {
      type: "RANGE",
      field: {
        type: "FIELD",
        value: fieldName,
        position,
        length: colonIndex,
      },
      operator: "BETWEEN",
      value: {
        type: "VALUE",
        value: start,
        position: position + colonIndex + 1,
        length: start.length,
      },
      value2: {
        type: "VALUE",
        value: end,
        position: position + colonIndex + start.length + 3,
        length: end.length,
      },
      position,
      length: colonIndex + 1 + value.length,
    };
  }

  // Handle >100, >=100, <100, <=100
  if (value.length > 1 && isRangeOperator(value.slice(0, 2))) {
    const operator = value.slice(0, 2) as RangeOperator;
    const numValue = value.slice(2);
    return {
      type: "RANGE",
      field: {
        type: "FIELD",
        value: fieldName,
        position,
        length: colonIndex,
      },
      operator,
      value: {
        type: "VALUE",
        value: numValue,
        position: position + colonIndex + 3,
        length: numValue.length,
      },
      position,
      length: colonIndex + 1 + value.length,
    };
  }

  if (value.length > 0 && isRangeOperator(value.slice(0, 1))) {
    const operator = value.slice(0, 1) as RangeOperator;
    const numValue = value.slice(1);
    return {
      type: "RANGE",
      field: {
        type: "FIELD",
        value: fieldName,
        position,
        length: colonIndex,
      },
      operator,
      value: {
        type: "VALUE",
        value: numValue,
        position: position + colonIndex + 2,
        length: numValue.length,
      },
      position,
      length: colonIndex + 1 + value.length,
    };
  }

  // If no range pattern is matched, return a regular field value
  return {
    type: "FIELD_VALUE",
    field: {
      type: "FIELD",
      value: fieldName,
      position,
      length: colonIndex,
    },
    value: {
      type: "VALUE",
      value,
      position: position + colonIndex + 1,
      length: value.length,
    },
  };
};
