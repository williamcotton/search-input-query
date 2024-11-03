// Token types and data structures
enum TokenType {
  STRING = "STRING",
  QUOTED_STRING = "QUOTED_STRING",
  LPAREN = "LPAREN", 
  RPAREN = "RPAREN",
  AND = "AND",
  OR = "OR",
  EOF = "EOF"
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
type StringLiteral = {
  readonly type: "STRING";
  readonly value: string;
} & PositionLength;

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

type Expression = StringLiteral | AndExpression | OrExpression;

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
const isSpecialChar = (char: string): boolean => /[\s"():()]/.test(char);

const tokenizeQuotedString = (
  input: string,
  position: number
): [Token, number] => {
  let value = "";
  let pos = position + 1; // Skip opening quote
  let currentLength = pos - position; // Track length including quotes and chars

  while (pos < input.length) {
    const char = input[pos];
    currentLength++;
    
    if (isQuoteChar(char) && !isEscapeChar(input[pos - 1])) {
      return [
        {
          type: TokenType.QUOTED_STRING,
          value,
          position,
          length: currentLength,
        },
        pos + 1,
      ];
    }

    if (isEscapeChar(char) && pos + 1 < input.length) {
      const nextChar = input[pos + 1];
      // Only treat escaped quotes specially
      if (isQuoteChar(nextChar)) {
        value += nextChar;
      } else {
        value += char + nextChar;
      }
      currentLength++; // Account for the escaped character
      pos += 2;
    } else {
      value += char;
      pos++;
    }
  }

  // If we get here, the string was not terminated
  throw {
    message: "Unterminated quoted string",
    position: position,
    length: currentLength
  };
};

const tokenizeString = (
  input: string,
  position: number
): [Token, number] => {
  let value = "";
  let pos = position;

  // First read the potential field name
  while (pos < input.length && !isWhitespace(input[pos]) && input[pos] !== ':' && !isSpecialChar(input[pos])) {
    value += input[pos];
    pos++;
  }

  // Handle field:value pattern
  if (pos < input.length && (input[pos] === ':' || (isWhitespace(input[pos]) && pos + 1 < input.length && input[pos + 1] === ':'))) {
    const fieldName = value;
    value = fieldName + ':';
    
    // Skip the colon and any whitespace
    while (pos < input.length && (isWhitespace(input[pos]) || input[pos] === ':')) {
      pos++;
    }

    // Handle quoted value
    if (pos < input.length && input[pos] === '"') {
      const [quotedToken, newPos] = tokenizeQuotedString(input, pos);
      return [{
        type: TokenType.STRING,
        value: fieldName + ':' + quotedToken.value,
        position,
        length: newPos - position
      }, newPos];
    }

    // Handle unquoted value
    while (pos < input.length && !isWhitespace(input[pos]) && !isSpecialChar(input[pos])) {
      value += input[pos];
      pos++;
    }
  }

  const type = value === "AND" || value === "OR" 
    ? value === "AND" ? TokenType.AND : TokenType.OR
    : TokenType.STRING;

  return [{
    type,
    value,
    position,
    length: pos - position
  }, pos];
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
        const [token, newPos] = tokenizeQuotedString(input, position);
        tokens.push(token);
        position = newPos;
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
        const [token, newPos] = tokenizeString(input, position);
        tokens.push(token);
        position = newPos;
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

const parsePrimary = (stream: TokenStream): ParseResult<Expression> => {
  const token = currentToken(stream);

  switch (token.type) {
    case TokenType.LPAREN: {
      const innerStream = advanceStream(stream);
      const exprResult = parseExpression(innerStream, 0);
      const finalStream = expectToken(exprResult.stream, TokenType.RPAREN);
      return { result: exprResult.result, stream: finalStream };
    }

    case TokenType.STRING:
    case TokenType.QUOTED_STRING:
      return {
        result: {
          type: "STRING",
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
      token.type === TokenType.STRING ||
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
    case "STRING":
      return expr.value.includes(" ") ? `"${expr.value}"` : expr.value;
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
  type StringLiteral,
  type AndExpression,
  type OrExpression,
};

// Test cases
const testQueries = [
  '"red shoes" OR ((blue OR purple) AND sneakers)',
  "comfortable AND (leather OR suede)",
  "(winter OR summer) AND boots",
  "boots summer",
  "color:red AND size:large",
  'category:"winter boots" AND (color:black OR color:brown)',
  "winter boots color:blue",
  "red boots black",
  "red (boots black)",
  "AND:value",
  "OR:test",
  'brand:"Nike\\Air"',
  'brand:"Nike"Air"',
  'brand:"Nike\\"Air"',
  "field: value",
  "field :value",
  "field : value",
  "a AND b OR c",
  "a OR b AND c",
  "a OR b OR c AND d",
  "",
  "()",
  "field:",
  ":value",
  "(a OR b) c d",
  "a AND (b OR c) AND d",
  "((a AND b) OR c) AND d",
  'status:"pending review"',
  "category:pending review",
  "size:large color:red status:available",
  'category:"winter boots" AND (color:black OR color:brown) AND size:12',
  'AND OR AND',
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