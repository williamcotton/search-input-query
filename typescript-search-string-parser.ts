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
  readonly searchTerm: string;
  readonly keyValuePairs: readonly KeyValuePair[];
}

type Parser<T> = (state: ParserState) => ParseResult<T>;

// Parser state constructor
const makeState = (input: string, position: number = 0): ParserState => ({
  input,
  position
});

// Core parsing primitives
const atEnd = (state: ParserState): boolean =>
  state.position >= state.input.length;

const currentChar = (state: ParserState): string | null =>
  atEnd(state) ? null : state.input[state.position];

const advance = (state: ParserState): ParserState =>
  makeState(state.input, state.position + 1);

const skipWhile = (predicate: (char: string) => boolean) =>
  (state: ParserState): ParserState => {
    let current = state;
    while (!atEnd(current) && predicate(currentChar(current)!)) {
      current = advance(current);
    }
    return current;
  };

const skipWhitespace = skipWhile(char => /\s/.test(char));

// Parsing combinators
const expectChar = (char: string, errorMessage?: string): Parser<void> =>
  (state: ParserState): ParseResult<void> => {
    const newState = skipWhitespace(state);
    if (atEnd(newState) || currentChar(newState) !== char) {
      throw new Error(
        errorMessage || `Expected '${char}' but found '${
          atEnd(newState) ? "end of input" : currentChar(newState)
        }'`
      );
    }
    return {
      state: advance(newState),
      value: undefined
    };
  };

const takeWhile = (predicate: (char: string) => boolean): Parser<string> =>
  (state: ParserState): ParseResult<string> => {
    let result = "";
    let current = state;
    
    while (!atEnd(current) && predicate(currentChar(current)!)) {
      result += currentChar(current);
      current = advance(current);
    }
    
    return {
      state: current,
      value: result
    };
  };

// Specific parsers
const parseQuotedString: Parser<string> = (state: ParserState): ParseResult<string> => {
  state = skipWhitespace(state);
  const afterQuote = expectChar('"', "Expected opening quote for search term")(state).state;
  
  let result = "";
  let current = afterQuote;
  
  while (!atEnd(current) && currentChar(current) !== '"') {
    result += currentChar(current);
    current = advance(current);
  }
  
  if (atEnd(current)) {
    throw new Error("Expected closing quote for search term");
  }
  
  return {
    state: advance(current), // Skip closing quote
    value: result
  };
};

const parseWord: Parser<string> = (state: ParserState): ParseResult<string> => {
  state = skipWhitespace(state);
  const result = takeWhile(char => /\w/.test(char))(state);
  
  if (result.value.length === 0) {
    throw new Error("Expected a word");
  }
  
  return result;
};

const parseKeyValuePair: Parser<KeyValuePair> = (state: ParserState): ParseResult<KeyValuePair> => {
  const { state: afterKey, value: key } = parseWord(state);
  const afterColon = expectChar(':', "Expected colon after key")(afterKey).state;
  const { state: afterValue, value } = parseWord(afterColon);
  
  return {
    state: afterValue,
    value: { key, value }
  };
};

const parseKeyValuePairs: Parser<KeyValuePair[]> = (state: ParserState): ParseResult<KeyValuePair[]> => {
  const pairs: KeyValuePair[] = [];
  let current = state;
  
  while (!atEnd(current)) {
    try {
      const result = parseKeyValuePair(current);
      pairs.push(result.value);
      current = skipWhitespace(result.state);
    } catch (e) {
      break;
    }
  }
  
  return {
    state: current,
    value: pairs
  };
};

// Main parser
const parseSearchQuery = (input: string): SearchQuery => {
  try {
    let state = makeState(input);
    const { state: afterSearchTerm, value: searchTerm } = parseQuotedString(state);
    const { value: keyValuePairs } = parseKeyValuePairs(afterSearchTerm);
    
    return {
      searchTerm,
      keyValuePairs
    };
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Parse error: ${error.message}`);
    }
    throw new Error('Unknown parsing error occurred');
  }
};

// Example usage
const input = '"red shoes" category:clothing size:10 color:red brand:nike';

try {
  const result = parseSearchQuery(input);
  console.log("Search term:", result.searchTerm);
  console.log("Key-Value pairs:", result.keyValuePairs);
} catch (error) {
  if (error instanceof Error) {
    console.error("Parsing error:", error.message);
  }
}

// Export for use as a module
export { 
  parseSearchQuery,
  type SearchQuery,
  type KeyValuePair,
  type ParserState,
  type ParseResult,
  type Parser
};