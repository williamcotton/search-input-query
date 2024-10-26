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


interface SearchQuery {
  readonly searchTerms: string[];
}

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

// Parsing combinators
const takeWhile =
  (predicate: (char: string) => boolean): Parser<string> =>
  (state: ParserState): ParseResult<string> => {
    let result = "";
    let current = state;

    while (!atEnd(current) && predicate(currentChar(current)!)) {
      result += currentChar(current);
      current = advance(current);
    }

    return {
      state: current,
      value: result,
    };
  };

// Specific parsers
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

  if (atEnd(current)) {
    throw new Error("Expected closing quote");
  }

  return {
    state: advance(current), // Skip closing quote
    value: result,
  };
};

const parseWord: Parser<string> = (state: ParserState): ParseResult<string> => {
  state = skipWhitespace(state);
  const result = takeWhile((char) => /[^\s]/.test(char))(state);

  if (result.value.length === 0) {
    throw new Error("Expected a word");
  }

  return result;
};

const parseTerm: Parser<string> = (state: ParserState): ParseResult<string> => {
  state = skipWhitespace(state);

  if (atEnd(state)) {
    throw new Error("Unexpected end of input");
  }

  if (currentChar(state) === '"') {
    return parseQuotedString(state);
  } else {
    return parseWord(state);
  }
};

// Main parser
const parseSearchQuery = (input: string): SearchQuery => {
  try {
    let state = makeState(input);
    const searchTerms: string[] = [];

    state = skipWhitespace(state);

    while (!atEnd(state)) {
      // Try to parse a token (either field-value pair or search term)
      try {
        const result = parseTerm(state);

        searchTerms.push(result.value as string);

        state = skipWhitespace(result.state);
      } catch (e) {
        // If we can't parse a token, break
        break;
      }
    }

    return {
      searchTerms
    };
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Parse error: ${error.message}`);
    }
    throw error;
  }
};

// Example usage with test queries
const test_queries = [
  '"red shoes"',
  "red shoes",
  "comfortable red shoes",
  '"red winter shoes" warm cozy',
  '"quoted term" another term "yet another"',
];

for (const query of test_queries) {
  console.log("\nParsing query:", query);
  try {
    const result = parseSearchQuery(query);
    console.log("Search terms:", result.searchTerms);
  } catch (error) {
    if (error instanceof Error) {
      console.error("Error parsing query:", error.message);
    }
  }
}

// Export for use as a module
export {
  parseSearchQuery,
  type SearchQuery,
  type ParserState,
  type ParseResult,
  type Parser,
};
