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

type PositionLength = {
  position: number;
  length: number;
};

// AST types
type SearchTerm = {
  readonly type: "TERM";
  readonly value: string;
} & PositionLength;

type FieldValue = {
  readonly type: "FIELD";
  readonly key: string;
  readonly value: string;
  readonly keyPosition: number;
  readonly keyLength: number;
  readonly valuePosition: number;
  readonly valueLength: number;
};

type AndExpression = {
  readonly type: "AND";
  readonly left: Expression;
  readonly right: Expression;
} & PositionLength;

type OrExpression = {
  readonly type: "OR";
  readonly left: Expression;
  readonly right: Expression;
} & PositionLength;

type Expression = SearchTerm | FieldValue | AndExpression | OrExpression;

type SearchQuery = {
  readonly type: "SEARCH_QUERY";
  readonly expression: Expression | null;
};

type SearchQueryError = {
  readonly type: "SEARCH_QUERY_ERROR";
  readonly expression: null;
  readonly error?: string;
  readonly position?: number;
  readonly length?: number;
};

// Tokenizer functions
const createStream = (tokens: Token[]): TokenStream => ({
  tokens,
  position: 0,
});

const peakToken = (stream: TokenStream): Token =>
  stream.position + 1 < stream.tokens.length
    ? stream.tokens[stream.position + 1]
    : {
        type: TokenType.EOF,
        value: "",
        position: stream.position + 1,
        length: 0,
      };

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

  throw { message: "Unterminated quoted string", position, length };
};

const tokenizeWord = (
  input: string,
  position: number,
  isFieldValue: boolean = false
): [Token, number] => {
  let value = "";
  let pos = position;

  while (pos < input.length && !isSpecialChar(input[pos])) {
    value += input[pos];
    pos++;
  }

  // Only treat AND/OR as operators when not in a field value context
  const type =
    !isFieldValue && (value === "AND" || value === "OR")
      ? value === "AND"
        ? TokenType.AND
        : TokenType.OR
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
  let expectingFieldValue = false;

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
        expectingFieldValue = false;
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
        expectingFieldValue = true;
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
        expectingFieldValue = false;
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
        expectingFieldValue = false;
        break;
      }

      default: {
        const [wordToken, wordPos] = tokenizeWord(
          input,
          position,
          expectingFieldValue
        );
        tokens.push(wordToken);
        position = wordPos;
        expectingFieldValue = false;
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

const expectToken = (stream: TokenStream, type: TokenType): TokenStream => {
  const token = currentToken(stream);
  if (token.type !== type) {
    throw {
      message: `Expected ${type}`,
      position: token.position,
      length: token.length,
    };
  }
  return advanceStream(stream);
};

const parseFieldValue = (stream: TokenStream): ParseResult<Expression> => {
  const keyToken = currentToken(stream);
  if (keyToken.type !== TokenType.WORD) {
    throw {
      message: "Expected field name",
      position: keyToken.position,
      length: keyToken.length,
    };
  }

  let newStream = advanceStream(stream);
  const colonToken = currentToken(newStream);
  if (colonToken.type !== TokenType.COLON) {
    throw {
      message: "Expected colon",
      position: colonToken.position,
      length: colonToken.length,
    };
  }

  newStream = advanceStream(newStream);
  const valueToken = currentToken(newStream);
  if (
    valueToken.type !== TokenType.WORD &&
    valueToken.type !== TokenType.QUOTED_STRING
  ) {
    throw {
      message: "Expected field value",
      position: valueToken.position,
      length: valueToken.length,
    };
  }

  return {
    result: {
      type: "FIELD",
      key: keyToken.value.toLowerCase(),
      value: valueToken.value,
      keyPosition: keyToken.position,
      keyLength: keyToken.length,
      valuePosition: valueToken.position,
      valueLength: valueToken.length,
    },
    stream: advanceStream(newStream),
  };
};

const parsePrimary = (stream: TokenStream): ParseResult<Expression> => {
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
      } catch (e: any) {
        if (
          peakToken(stream).type === TokenType.COLON &&
          e.message === "Expected field value"
        ) {
          throw {
            message: e.message,
            position: token.position,
            length: token.length,
          };
        }
        return {
          result: {
            type: "TERM",
            value: token.value,
            position: token.position,
            length: token.length,
          },
          stream: advanceStream(stream),
        };
      }
    }

    case TokenType.QUOTED_STRING:
      return {
        result: {
          type: "TERM",
          value: token.value,
          position: token.position,
          length: token.length,
        },
        stream: advanceStream(stream),
      };

    case TokenType.AND:
    case TokenType.OR:
      throw {
        message: `${token.value} is a reserved word`,
        position: token.position,
        length: token.length,
      };

    case TokenType.RPAREN:
      throw {
        message: 'Unexpected ")"',
        position: token.position,
        length: token.length,
      };

    default:
      throw {
        message: "Unexpected token",
        position: token.position,
        length: token.length,
      };
  }
};

const getOperatorPrecedence = (type: TokenType): number =>
  type === TokenType.AND ? 2 : type === TokenType.OR ? 1 : 0;

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
      const right = parseExpression(nextStream, precedence + 1);

      result = {
        result: {
          type: operator,
          left: result.result,
          right: right.result,
          position: token.position,
          length: token.length,
        },
        stream: right.stream,
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

      const right = parseExpression(result.stream, precedence + 1);
      result = {
        result: {
          type: TokenType.AND,
          left: result.result,
          right: right.result,
          position: token.position,
          length: token.length,
        },
        stream: right.stream,
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
      return expr.value.includes(" ") ? `"${expr.value}"` : expr.value;
    case "FIELD":
      return `${expr.key}:${expr.value}`;
    case "AND":
      return `(${stringify(expr.left)} AND ${stringify(expr.right)})`;
    case "OR":
      return `(${stringify(expr.left)} OR ${stringify(expr.right)})`;
  }
};

// Main parse function
const parseSearchQuery = (input: string): SearchQuery | SearchQueryError => {
  try {
    const tokens = tokenize(input);
    const stream = createStream(tokens);

    if (currentToken(stream).type === TokenType.EOF) {
      return { type: "SEARCH_QUERY", expression: null };
    }

    const result = parseExpression(stream);

    // Check for any remaining tokens after parsing is complete
    const finalToken = currentToken(result.stream);
    if (finalToken.type !== TokenType.EOF) {
      throw {
        message: 'Unexpected ")"',
        position: finalToken.position,
        length: finalToken.length,
      };
    }

    return { type: "SEARCH_QUERY", expression: result.result };
  } catch (error: any) {
    return {
      type: "SEARCH_QUERY_ERROR",
      expression: null,
      error: error.message,
      position: error.position,
      length: error.length,
    };
  }
};

export {
  parseSearchQuery,
  stringify,
  type SearchQuery,
  type SearchQueryError,
  type Expression,
  type SearchTerm,
  type FieldValue,
  type AndExpression,
  type OrExpression,
};
