#!/usr/bin/env ts-node

// Type definitions
interface ParserState {
  readonly input: string;
  readonly position: number;
}

interface ParseResult<T> {
  readonly state: ParserState;
  readonly value: T;
}

// AST node types
type SearchTerm = {
  type: "TERM";
  value: string;
};

type FieldValue = {
  type: "FIELD";
  key: string;
  value: string;
};

type AndExpression = {
  type: "AND";
  left: Expression;
  right: Expression;
};

type OrExpression = {
  type: "OR";
  left: Expression;
  right: Expression;
};

type Expression = SearchTerm | FieldValue | AndExpression | OrExpression;

type SearchQuery = {
  expression: Expression | null;
};

type Parser<T> = (state: ParserState) => ParseResult<T>;

// Parser state constructor
const makeState = (input: string, position: number = 0): ParserState => ({
  input,
  position,
});

// Core parsing primitives
const atEnd = (state: ParserState): boolean =>
  state.position >= state.input.length;

const currentChar = (state: ParserState): string | null =>
  atEnd(state) ? null : state.input[state.position];

const advance = (state: ParserState): ParserState =>
  makeState(state.input, state.position + 1);

const skipWhile =
  (predicate: (char: string) => boolean) =>
  (state: ParserState): ParserState => {
    let current = state;
    while (!atEnd(current) && predicate(currentChar(current)!)) {
      current = advance(current);
    }
    return current;
  };

const skipWhitespace = skipWhile((char) => /\s/.test(char));

// Helper to peek at the next non-whitespace character
const peekChar = (state: ParserState): string | null => {
  const afterWhitespace = skipWhitespace(state);
  return currentChar(afterWhitespace);
};

// Helper to match exact strings
const matchString =
  (target: string): Parser<string> =>
  (state: ParserState): ParseResult<string> => {
    state = skipWhitespace(state);
    let current = state;

    for (let i = 0; i < target.length; i++) {
      if (atEnd(current) || currentChar(current) !== target[i]) {
        throw new Error(`Expected "${target}" at position ${state.position}`);
      }
      current = advance(current);
    }

    return {
      state: current,
      value: target,
    };
  };

// Parse a quoted string
const parseQuotedString: Parser<string> = (
  state: ParserState
): ParseResult<string> => {
  state = skipWhitespace(state);
  if (atEnd(state) || currentChar(state) !== '"') {
    throw new Error("Expected opening quote");
  }

  let current = advance(state); // Skip opening quote
  let result = "";

  while (!atEnd(current) && currentChar(current) !== '"') {
    if (currentChar(current) === "\\") {
      current = advance(current);
      if (atEnd(current)) {
        throw new Error("Unexpected end of input after escape character");
      }
      result += currentChar(current);
    } else {
      result += currentChar(current);
    }
    current = advance(current);
  }

  if (atEnd(current) || currentChar(current) !== '"') {
    throw new Error("Expected closing quote");
  }

  return {
    state: advance(current), // Skip closing quote
    value: result,
  };
};

// Parse a word (unquoted term)
const parseUnquotedString: Parser<string> = (state: ParserState): ParseResult<string> => {
  state = skipWhitespace(state);
  let current = state;
  let result = "";

  while (!atEnd(current)) {
    const char = currentChar(current);
    // Stop at special characters
    if (
      /[\s():"]/.test(char!) ||
      (result.length > 0 && (char === "A" || char === "O"))
    ) {
      break;
    }
    result += char;
    current = advance(current);
  }

  if (result.length === 0) {
    throw new Error("Expected a word");
  }

  return {
    state: current,
    value: result,
  };
};

// Parse a field:value pair
const parseFieldValue: Parser<FieldValue> = (state: ParserState): ParseResult<FieldValue> => {
  state = skipWhitespace(state);
  
  const keyResult = parseUnquotedString(state);
  state = skipWhitespace(keyResult.state);
  
  if (atEnd(state) || currentChar(state) !== ':') {
    throw new Error("Expected ':' after field name");
  }
  
  state = advance(state); // Skip colon
  const termParser = currentChar(state) === '"' ? parseQuotedString : parseUnquotedString;
  const valueResult = termParser(state);
  
  return {
    state: valueResult.state,
    value: {
      type: 'FIELD',
      key: keyResult.value.toLowerCase(),
      value: valueResult.value
    }
  };
};


// Parse a single search term (quoted or unquoted)
const parseSearchTerm: Parser<Expression> = (
  state: ParserState
): ParseResult<Expression> => {
  state = skipWhitespace(state);

  try {
    const fieldValueResult = parseFieldValue(state);
    return {
      state: fieldValueResult.state,
      value: { type: "FIELD", key: fieldValueResult.value.key, value: fieldValueResult.value.value },
    };
  } catch (e) {
    // Ignore error and try parsing as a regular term
  }

  const termParser = currentChar(state) === '"' ? parseQuotedString : parseUnquotedString;
  const result = termParser(state);

  return {
    state: result.state,
    value: { type: "TERM", value: result.value },
  };
};

// Forward declaration for expression parser
let parseExpression: Parser<Expression>;

// Parse a parenthesized expression
const parseParenExpr: Parser<Expression> = (
  state: ParserState
): ParseResult<Expression> => {
  state = skipWhitespace(state);

  if (currentChar(state) !== "(") {
    throw new Error("Expected opening parenthesis");
  }

  state = advance(state); // Skip opening paren
  const result = parseExpression(state);
  state = skipWhitespace(result.state);

  if (atEnd(state) || currentChar(state) !== ")") {
    throw new Error("Expected closing parenthesis");
  }

  return {
    state: advance(state), // Skip closing paren
    value: result.value,
  };
};
const parsePrimary: Parser<Expression> = (
  state: ParserState
): ParseResult<Expression> => {
  state = skipWhitespace(state);

  // Try each parser in order
  const parsers = [parseParenExpr, parseSearchTerm];

  for (const parser of parsers) {
    try {
      return parser(state);
    } catch {
      continue;
    }
  }

  throw new Error("Expected a termor parenthesized expression");
};

// Implementation of expression parser
parseExpression = (state: ParserState): ParseResult<Expression> => {
  let result = parsePrimary(state);

  while (true) {
    state = skipWhitespace(result.state);
    if (atEnd(state)) break;

    // Look ahead for AND/OR
    let operator: "AND" | "OR" | null = null;
    try {
      const nextChars = state.input.slice(state.position, state.position + 3);
      if (nextChars === "AND") {
        operator = "AND";
      } else if (nextChars.startsWith("OR")) {
        operator = "OR";
      }

      if (!operator) break;

      // Advance past the operator
      state = makeState(
        state.input,
        state.position + (operator === "AND" ? 3 : 2)
      );

      // Parse the right side
      const rightResult = parsePrimary(state);

      // Create the new expression
      result = {
        state: rightResult.state,
        value: {
          type: operator,
          left: result.value,
          right: rightResult.value,
        },
      };
    } catch {
      break;
    }
  }

  return result;
};

// Main parse function
const parseSearchQuery = (input: string): SearchQuery => {
  try {
    let state = makeState(input);
    const expressions: Expression[] = [];

    while (!atEnd(state)) {
      state = skipWhitespace(state);
      if (atEnd(state)) break;

      try {
        const result = parseExpression(state);
        expressions.push(result.value);
        state = result.state;
      } catch (e) {
        break;
      }
    }

    let mainExpression: Expression | null = null;
    if (expressions.length > 0) {
      mainExpression = expressions.reduce((left, right) => ({
        type: "AND",
        left,
        right,
      }));
    }

    return {
      expression: mainExpression,
    };
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Parse error: ${error.message}`);
    }
    throw error;
  }
};

// Helper function to stringify the parsed result
const stringify = (expr: Expression): string => {
  switch (expr.type) {
    case "TERM":
      return expr.value.includes(" ") ? `"${expr.value}"` : expr.value;
    case "AND":
      return `(${stringify(expr.left)} AND ${stringify(expr.right)})`;
    case "OR":
      return `(${stringify(expr.left)} OR ${stringify(expr.right)})`;
    case "FIELD":
      return `${expr.key}:${expr.value}`;
  }
};

// Test cases
const testQueries = [
    "\"red shoes\" OR ((blue OR purple) AND sneakers)",
    "comfortable AND (leather OR suede)",
    "(winter OR summer) AND boots",
    "boots summer",
    "color:red AND size:large",
    "category:\"winter boots\" AND (color:black OR color:brown)",
    "winter boots color:blue",
];

for (const query of testQueries) {
  console.log("\nParsing query:", query);
  try {
    const result = parseSearchQuery(query);
    console.log(result);
    console.log("Parsed expression:", stringify(result.expression!));
  } catch (error) {
    if (error instanceof Error) {
      console.error("Error parsing query:", error.message);
    }
  }
}

export {
  parseSearchQuery,
  type SearchQuery,
  type Expression,
  type SearchTerm,
  type AndExpression,
  type OrExpression,
};
