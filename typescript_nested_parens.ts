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

// Type definitions for AST nodes
type Atom = string;
type List = Expression[];
type Expression = Atom | List;

// Parser combinators for specific syntax elements
const atom: Parser<Atom> = (state: ParserState): ParseResult<Atom> => {
  state = skipWhitespace(state);
  const result = takeWhile((char) => /[^\s()]/.test(char))(state);

  if (result.value.length === 0) {
    throw new Error(`Expected atom at position ${state.position}`);
  }

  return result;
};

const list: Parser<List> = (state: ParserState): ParseResult<List> => {
  state = skipWhitespace(state);

  // Check opening parenthesis
  if (currentChar(state) !== "(") {
    throw new Error(`Expected '(' at position ${state.position}`);
  }
  state = advance(state);

  // Parse expressions until closing parenthesis
  const expressions: Expression[] = [];
  state = skipWhitespace(state);

  while (!atEnd(state) && currentChar(state) !== ")") {
    const result = expression(state);
    expressions.push(result.value);
    state = result.state;
    state = skipWhitespace(state);
  }

  // Check closing parenthesis
  if (currentChar(state) !== ")") {
    throw new Error(`Expected ')' at position ${state.position}`);
  }
  state = advance(state);

  return {
    state,
    value: expressions,
  };
};

const expression: Parser<Expression> = (
  state: ParserState
): ParseResult<Expression> => {
  state = skipWhitespace(state);

  if (atEnd(state)) {
    throw new Error(`Unexpected end of input at position ${state.position}`);
  }

  // Check if we're starting a list or an atom
  if (currentChar(state) === "(") {
    return list(state);
  } else {
    return atom(state);
  }
};

// Main parse function
const parse = (input: string): Expression => {
  try {
    const initialState = makeState(input);
    const result = expression(initialState);

    // Check if we've consumed all input
    const finalState = skipWhitespace(result.state);
    if (!atEnd(finalState)) {
      throw new Error(`Unexpected input at position ${finalState.position}`);
    }

    return result.value;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Parse error: ${error.message}`);
    }
    throw error;
  }
};

// Helper function to stringify the parsed result
const stringify = (expr: Expression): string => {
  if (Array.isArray(expr)) {
    return `(${expr.map(stringify).join(" ")})`;
  }
  return expr;
};

// Test function
const testParse = (input: string) => {
  console.log("\nParsing:", input);
  try {
    const result = parse(input);
    console.log("\nFinal Result:", result);
    console.log("Pretty printed:", stringify(result));
  } catch (error) {
    if (error instanceof Error) {
      console.log("Error:", error.message);
    }
  }
};

// Test cases showing paren matching
const testCases = [
  "((one) two three)",
  "((a b) (c d) e)",
  "(a)",
  "((a (b c)) d)",
  "(((deeply) nested) parens)"
];

// Run tests
testCases.forEach(testParse);