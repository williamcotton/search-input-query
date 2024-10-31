#!/usr/bin/env ts-node

// Token types and data structures
enum TokenType {
  WORD = "WORD",
  QUOTED_STRING = "QUOTED_STRING",
  COLON = "COLON",
  LPAREN = "LPAREN",
  RPAREN = "RPAREN",
  AND = "AND",
  OR = "OR",
  EOF = "EOF",
}

interface Token {
  type: TokenType;
  value: string;
  position: number;
  length: number;
}

interface TokenStream {
  readonly tokens: Token[];
  readonly position: number;
}

// AST types
type SearchTerm = {
  readonly type: "TERM";
  readonly value: string;
};

type FieldValue = {
  readonly type: "FIELD";
  readonly key: string;
  readonly value: string;
};

type AndExpression = {
  readonly type: "AND";
  readonly left: Expression;
  readonly right: Expression;
};

type OrExpression = {
  readonly type: "OR";
  readonly left: Expression;
  readonly right: Expression;
};

type Expression = SearchTerm | FieldValue | AndExpression | OrExpression;

type SearchQuery = {
  readonly expression: Expression | null;
};

// Tokenizer functions
const createStream = (tokens: Token[]): TokenStream => ({
  tokens,
  position: 0,
});

const currentToken = (stream: TokenStream): Token =>
  stream.position < stream.tokens.length
    ? stream.tokens[stream.position]
    : { type: TokenType.EOF, value: "", position: stream.position, length: 0 };

const advanceStream = (stream: TokenStream): TokenStream => ({
  ...stream,
  position: stream.position + 1,
});

const isEscapeChar = (char: string): boolean => char === "\\";
const isQuoteChar = (char: string): boolean => char === '"';
const isWhitespace = (char: string): boolean => /\s/.test(char);
const isSpecialChar = (char: string): boolean => /[\s:"()]/.test(char);

const tokenizeQuotedString = (
  input: string,
  position: number
): [Token, number] => {
  let value = "";
  let pos = position + 1; // Skip opening quote
  let length = 2; // Start with 2 for the quotes

  while (pos < input.length) {
    const char = input[pos];
    if (isQuoteChar(char)) {
      return [
        {
          type: TokenType.QUOTED_STRING,
          value,
          position,
          length: length, // Include both quotes in length
        },
        pos + 1,
      ];
    }
    if (isEscapeChar(char) && pos + 1 < input.length) {
      value += input[pos + 1];
      length += 2; // Count both escape char and escaped char
      pos += 2;
    } else {
      value += char;
      length++;
      pos++;
    }
  }

  throw new Error("Unterminated quoted string");
};

const tokenizeWord = (input: string, position: number): [Token, number] => {
  let value = "";
  let pos = position;

  while (pos < input.length && !isSpecialChar(input[pos])) {
    value += input[pos];
    pos++;
  }

  const type =
    value === "AND"
      ? TokenType.AND
      : value === "OR"
      ? TokenType.OR
      : TokenType.WORD;

  return [
    {
      type,
      value,
      position,
      length: value.length,
    },
    pos,
  ];
};

const tokenize = (input: string): Token[] => {
  const tokens: Token[] = [];
  let position = 0;

  while (position < input.length) {
    const char = input[position];

    if (isWhitespace(char)) {
      position++;
      continue;
    }

    switch (char) {
      case '"': {
        const [quotedToken, newPos] = tokenizeQuotedString(input, position);
        tokens.push(quotedToken);
        position = newPos;
        break;
      }

      case ":": {
        tokens.push({
          type: TokenType.COLON,
          value: ":",
          position,
          length: 1,
        });
        position++;
        break;
      }

      case "(": {
        tokens.push({
          type: TokenType.LPAREN,
          value: "(",
          position,
          length: 1,
        });
        position++;
        break;
      }

      case ")": {
        tokens.push({
          type: TokenType.RPAREN,
          value: ")",
          position,
          length: 1,
        });
        position++;
        break;
      }

      default: {
        const [wordToken, wordPos] = tokenizeWord(input, position);
        tokens.push(wordToken);
        position = wordPos;
      }
    }
  }

  return tokens;
};

// Parser functions
interface ParseResult<T> {
  readonly result: T;
  readonly stream: TokenStream;
}

const expectToken = (
  stream: TokenStream,
  type: TokenType
): TokenStream => {
  const token = currentToken(stream);
  if (token.type !== type) {
    throw new Error(`Expected ${type} but got ${token.type}`);
  }
  return advanceStream(stream);
};

const parseFieldValue = (
  stream: TokenStream
): ParseResult<Expression> => {
  const keyToken = currentToken(stream);
  if (keyToken.type !== TokenType.WORD) {
    throw new Error('Expected field name');
  }

  let newStream = advanceStream(stream);
  const colonToken = currentToken(newStream);
  if (colonToken.type !== TokenType.COLON) {
    throw new Error('Expected colon after field name');
  }

  newStream = advanceStream(newStream);
  const valueToken = currentToken(newStream);
  if (valueToken.type !== TokenType.WORD && valueToken.type !== TokenType.QUOTED_STRING) {
    throw new Error('Expected field value');
  }

  return {
    result: {
      type: 'FIELD',
      key: keyToken.value.toLowerCase(),
      value: valueToken.value
    },
    stream: advanceStream(newStream)
  };
};

const parsePrimary = (
  stream: TokenStream
): ParseResult<Expression> => {
  const token = currentToken(stream);

  switch (token.type) {
    case TokenType.LPAREN: {
      const innerStream = advanceStream(stream);
      const exprResult = parseExpression(innerStream, 0);
      const finalStream = expectToken(exprResult.stream, TokenType.RPAREN);
      return { result: exprResult.result, stream: finalStream };
    }

    case TokenType.WORD: {
      try {
        return parseFieldValue(stream);
      } catch {
        // If it's not a valid field:value, treat it as a term
        return {
          result: { type: 'TERM', value: token.value },
          stream: advanceStream(stream)
        };
      }
    }

    case TokenType.QUOTED_STRING:
      return {
        result: { type: 'TERM', value: token.value },
        stream: advanceStream(stream)
      };

    default:
      throw new Error(`Unexpected token: ${token.type}`);
  }
};

const getOperatorPrecedence = (type: TokenType): number =>
  type === TokenType.AND ? 2
  : type === TokenType.OR ? 1
  : 0;

const parseExpression = (
  stream: TokenStream,
  minPrecedence: number = 0
): ParseResult<Expression> => {
  let result = parsePrimary(stream);

  while (true) {
    const token = currentToken(result.stream);
    if (token.type === TokenType.EOF) break;

    // Handle explicit operators (AND/OR)
    if (token.type === TokenType.AND || token.type === TokenType.OR) {
      const precedence = getOperatorPrecedence(token.type);
      if (precedence < minPrecedence) break;

      const operator = token.type;
      const nextStream = advanceStream(result.stream);
      const right = parseExpression(nextStream, precedence);

      result = {
        result: {
          type: operator,
          left: result.result,
          right: right.result
        },
        stream: right.stream
      };
      continue;
    }

    // Handle implicit AND (adjacent terms)
    if (
      token.type === TokenType.WORD ||
      token.type === TokenType.QUOTED_STRING ||
      token.type === TokenType.LPAREN
    ) {
      const precedence = getOperatorPrecedence(TokenType.AND);
      if (precedence < minPrecedence) break;

      const right = parseExpression(result.stream, precedence);
      result = {
        result: {
          type: TokenType.AND,
          left: result.result,
          right: right.result
        },
        stream: right.stream
      };
      continue;
    }

    break;
  }

  return result;
};

// Helper function to stringify expressions
const stringify = (expr: Expression): string => {
  switch (expr.type) {
    case "TERM":
      return expr.value.includes(' ') ? `"${expr.value}"` : expr.value;
    case "FIELD":
      return `${expr.key}:${expr.value}`;
    case "AND":
      return `(${stringify(expr.left)} AND ${stringify(expr.right)})`;
    case "OR":
      return `(${stringify(expr.left)} OR ${stringify(expr.right)})`;
  }
};

// Main parse function
const parseSearchQuery = (input: string): SearchQuery => {
  try {
    const tokens = tokenize(input);
    const stream = createStream(tokens);
    
    if (currentToken(stream).type === TokenType.EOF) {
      return { expression: null };
    }

    const result = parseExpression(stream);
    return { expression: result.result };
  } catch (error) {
    console.error('Parse error:', error);
    return { expression: null };
  }
};

// Test the parser with various queries
const testQueries = [
  '"red shoes" OR ((blue OR purple) AND sneakers)',
  'comfortable AND (leather OR suede)',
  'category:"winter boots" AND (color:black OR color:brown)',
  'boots summer',
  'color:red AND size:large',
  'winter boots color:blue',
  'brand:"Nike\\Air"',
  'field: value',
  'a AND b OR c',
  'category:"winter boots" AND (color:black OR color:brown) AND size:12',
  'red boots color:blue date:2024-01-01',
  'winter boots ((user_id:123 OR admin_id:456) AND status:active)'
];

for (const query of testQueries) {
  console.log('\nParsing query:', query);
  try {
    const result = parseSearchQuery(query);
    if (result.expression) {
      console.log('Parsed expression:', stringify(result.expression));
    } else {
      console.log('No expression');
    }
  } catch (error) {
    if (error instanceof Error) {
      console.error('Error parsing query:', error.message);
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
  type OrExpression
};