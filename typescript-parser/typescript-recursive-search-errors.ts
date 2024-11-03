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

type Expression = SearchTerm | AndExpression | OrExpression;

type SearchQuery = {
  expression: Expression | null;
  fields: { [key: string]: string };
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
    throw new Error(`Expected opening quote at position ${state.position}`);
  }

  let current = advance(state); // Skip opening quote
  let result = "";

  while (!atEnd(current) && currentChar(current) !== '"') {
    if (currentChar(current) === "\\") {
      current = advance(current);
      if (atEnd(current)) {
        throw new Error(
          `Unexpected end of input after escape character at position ${current.position}`
        );
      }
      result += currentChar(current);
    } else {
      result += currentChar(current);
    }
    current = advance(current);
  }

  if (atEnd(current) || currentChar(current) !== '"') {
    throw new Error(`Expected closing quote at position ${current.position}`);
  }

  return {
    state: advance(current), // Skip closing quote
    value: result,
  };
};

// Parse a word (unquoted term)
const parseWord: Parser<string> = (state: ParserState): ParseResult<string> => {
  state = skipWhitespace(state);
  let current = state;
  let result = "";

  while (!atEnd(current)) {
    const char = currentChar(current);
    // Stop at special characters
    if (/[\s():"]/.test(char!)) {
      break;
    }
    if (char === ":") {
      throw new Error(
        `Unexpected ':' in term at position ${current.position}. Field:value pairs are not allowed within expressions.`
      );
    }
    result += char;
    current = advance(current);
  }

  if (result.length === 0) {
    throw new Error(`Expected a term at position ${state.position}`);
  }

  return {
    state: current,
    value: result,
  };
};

// Parse a field:value pair
const parseFieldValue: Parser<FieldValue> = (
  state: ParserState
): ParseResult<FieldValue> => {
  state = skipWhitespace(state);

  const keyResult = parseWord(state);
  state = skipWhitespace(keyResult.state);

  if (atEnd(state) || currentChar(state) !== ":") {
    throw new Error(
      `Expected ':' after field name at position ${state.position}`
    );
  }

  state = advance(state); // Skip colon
  const valueResult = parseWord(state);

  return {
    state: valueResult.state,
    value: {
      type: "FIELD",
      key: keyResult.value.toLowerCase(),
      value: valueResult.value,
    },
  };
};

// Parse a single search term (quoted or unquoted)
const parseSearchTerm: Parser<SearchTerm> = (
  state: ParserState
): ParseResult<SearchTerm> => {
  state = skipWhitespace(state);

  const termParser = currentChar(state) === '"' ? parseQuotedString : parseWord;
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
    throw new Error(
      `Expected opening parenthesis at position ${state.position}`
    );
  }

  state = advance(state); // Skip opening paren
  const result = parseExpression(state);
  state = skipWhitespace(result.state);

  if (atEnd(state) || currentChar(state) !== ")") {
    throw new Error(
      `Expected closing parenthesis at position ${state.position}`
    );
  }

  return {
    state: advance(state), // Skip closing paren
    value: result.value,
  };
};

// Parse a primary expression (term or parenthesized expression)
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

  throw new Error(
    `Expected a term or parenthesized expression at position ${state.position}`
  );
};

// Implementation of expression parser
parseExpression = (state: ParserState): ParseResult<Expression> => {
  let result = parsePrimary(state);

  while (true) {
    state = skipWhitespace(result.state);
    if (atEnd(state)) break;

    // Look ahead for AND/OR
    let operator: "AND" | "OR" | null = null;
    const remainingInput = state.input.slice(state.position).toUpperCase();

    if (remainingInput.startsWith("AND")) {
      operator = "AND";
      state = makeState(state.input, state.position + 3);
    } else if (remainingInput.startsWith("OR")) {
      operator = "OR";
      state = makeState(state.input, state.position + 2);
    } else {
      break;
    }

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
  }

  return result;
};

// Main parse function
const parseSearchQuery = (input: string): SearchQuery => {
  try {
    let state = makeState(input);
    let expressionResult: ParseResult<Expression> | null = null;
    const fields: { [key: string]: string } = {};

    // Parse expressions and field:value pairs at the top level
    while (!atEnd(state)) {
      state = skipWhitespace(state);
      if (atEnd(state)) break;

      // Try to parse a field:value pair
      try {
        const fieldResult = parseFieldValue(state);
        fields[fieldResult.value.key] = fieldResult.value.value;
        state = fieldResult.state;
        continue;
      } catch (e) {
        // Not a field:value pair, try to parse an expression
      }

      // Parse the expression
      if (!expressionResult) {
        expressionResult = parseExpression(state);
        state = expressionResult.state;
      } else {
        // If there's already an expression, that's an error
        throw new Error(`Unexpected input at position ${state.position}`);
      }
    }

    return {
      expression: expressionResult ? expressionResult.value : null,
      fields,
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
  }
};

// Test cases
const testQueries = [
  '("red shoes" OR ((blue OR purple) AND sneakers)) size:10 category:footwear',
  "comfortable AND (leather OR suede) brand:nike",
  "(winter OR summer) AND boots size:8",
  "(size:8 AND brand:nike)",
];

for (const query of testQueries) {
  console.log("\nParsing query:", query);
  try {
    const result = parseSearchQuery(query);
    if (result.expression) {
      console.log("Parsed expression:", stringify(result.expression));
    } else {
      console.log("Parsed expression: None");
    }
    console.log("Fields:", result.fields);
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
  type FieldValue,
  type AndExpression,
  type OrExpression,
};
