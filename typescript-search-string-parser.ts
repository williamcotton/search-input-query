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

interface KeyValuePair {
  readonly key: string;
  readonly value: string;
}

interface SearchQuery {
  readonly searchTerms: string[];
  readonly fields: { [key: string]: string };
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
  const result = takeWhile((char) => /[^\s:]/.test(char))(state);

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

const parseKeyValuePair: Parser<KeyValuePair> = (
  state: ParserState
): ParseResult<KeyValuePair> => {
  state = skipWhitespace(state);

  const { state: afterKey, value: key } = parseWord(state);

  if (atEnd(afterKey) || currentChar(afterKey) !== ":") {
    throw new Error("Expected colon after key");
  }

  const afterColon = advance(afterKey); // Skip colon

  const { state: afterValue, value } = parseTerm(afterColon);

  return {
    state: afterValue,
    value: { key: key.toLowerCase(), value },
  };
};

const parseToken = (state: ParserState): ParseResult<KeyValuePair | string> => {
  let savedState = state;

  // Try to parse as a key-value pair
  try {
    const result = parseKeyValuePair(state);
    return {
      state: result.state,
      value: result.value,
    };
  } catch (e) {
    // Reset state if parsing as key-value pair fails
    state = savedState;
  }

  // Try to parse as a search term
  try {
    const result = parseTerm(state);
    return {
      state: result.state,
      value: result.value,
    };
  } catch (e) {
    throw new Error("Failed to parse token");
  }
};

// Main parser
const parseSearchQuery = (input: string): SearchQuery => {
  try {
    let state = makeState(input);
    const searchTerms: string[] = [];
    const fields: { [key: string]: string } = {};

    state = skipWhitespace(state);

    while (!atEnd(state)) {
      // Try to parse a token (either field-value pair or search term)
      try {
        const result = parseToken(state);

        if (typeof result.value === "object" && "key" in result.value) {
          // It's a KeyValuePair
          fields[result.value.key] = result.value.value;
        } else {
          // It's a search term
          searchTerms.push(result.value as string);
        }

        state = skipWhitespace(result.state);
      } catch (e) {
        // If we can't parse a token, break
        break;
      }
    }

    return {
      searchTerms,
      fields,
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
  '"red shoes" category:clothing size:10 color:red brand:nike',
  "red shoes category:clothing size:10 color:red brand:nike",
  "comfortable red shoes category:clothing size:10",
  'category:clothing "red winter shoes" warm cozy',
  '"quoted term" another term yet:another',
];

for (const query of test_queries) {
  console.log("\nParsing query:", query);
  try {
    const result = parseSearchQuery(query);
    console.log("Search terms:", result.searchTerms);
    console.log("Fields:");
    for (const [key, value] of Object.entries(result.fields)) {
      console.log(`  ${key}: ${value}`);
    }
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
  type KeyValuePair,
  type ParserState,
  type ParseResult,
  type Parser,
};
