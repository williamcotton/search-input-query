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

// First Pass AST types (from tokenizer/parser)
type PositionLength = {
  position: number;
  length: number;
};

type StringLiteral = {
  readonly type: "STRING";
  readonly value: string;
} & PositionLength;

type AndExpression = {
  readonly type: "AND";
  readonly left: FirstPassExpression;
  readonly right: FirstPassExpression;
} & PositionLength;

type OrExpression = {
  readonly type: "OR";
  readonly left: FirstPassExpression;
  readonly right: FirstPassExpression;
} & PositionLength;

type FirstPassExpression = StringLiteral | AndExpression | OrExpression;

// Second Pass AST types (semantic analysis)
type SearchTerm = {
  readonly type: "SEARCH_TERM";
  readonly value: string;
} & PositionLength;

type FieldValue = {
  readonly type: "FIELD_VALUE";
  readonly field: string;
  readonly value: string;
  readonly fieldPosition: number;
  readonly fieldLength: number;
  readonly valuePosition: number;
  readonly valueLength: number;
} 

type And = {
  readonly type: "AND";
  readonly left: Expression;
  readonly right: Expression;
} & PositionLength;

type Or = {
  readonly type: "OR";
  readonly left: Expression;
  readonly right: Expression;
} & PositionLength;

type Expression = SearchTerm | FieldValue | And | Or;

type SearchQuery = {
  readonly type: "SEARCH_QUERY";
  readonly expression: Expression | null;
};

type SearchQueryError = {
  readonly type: "SEARCH_QUERY_ERROR";
  readonly expression: null;
  readonly errors?: ValidationError[];
};

type ValidationError = {
  message: string;
  position: number;
  length: number;
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

const readUntil = (
  input: string,
  start: number,
  predicate: (char: string) => boolean
): string => {
  let result = "";
  let pos = start;
  while (pos < input.length && predicate(input[pos])) {
    result += input[pos];
    pos++;
  }
  return result;
};

const skipWhile = (
  input: string,
  start: number,
  predicate: (char: string) => boolean
): number => {
  let pos = start;
  while (pos < input.length && predicate(input[pos])) {
    pos++;
  }
  return pos;
};


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

const tokenizeString = (input: string, position: number): [Token, number] => {
  let pos = position;

  // Read until we hit a special character, whitespace, or colon
  const fieldPart = readUntil(
    input,
    pos,
    (char) => !isWhitespace(char) && char !== ":" && !isSpecialChar(char)
  );
  pos += fieldPart.length;

  // Check if this is a field:value pattern
  if (
    pos < input.length &&
    (input[pos] === ":" || (isWhitespace(input[pos]) && input[pos + 1] === ":"))
  ) {
    // Skip colon and whitespace
    pos = skipWhile(input, pos, (char) => isWhitespace(char) || char === ":");

    // Handle quoted values
    if (pos < input.length && input[pos] === '"') {
      const [quotedToken, newPos] = tokenizeQuotedString(input, pos);
      return [
        {
          type: TokenType.STRING,
          value: `${fieldPart}:${quotedToken.value}`,
          position,
          length: newPos - position,
        },
        newPos,
      ];
    }

    // Handle unquoted values
    const valuePart = readUntil(
      input,
      pos,
      (char) => !isWhitespace(char) && !isSpecialChar(char)
    );
    pos += valuePart.length;

    return [
      {
        type: TokenType.STRING,
        value: `${fieldPart}:${valuePart}`,
        position,
        length: pos - position,
      },
      pos,
    ];
  }

  // Handle logical operators
  if (fieldPart === "AND" || fieldPart === "OR") {
    return [
      {
        type: fieldPart === "AND" ? TokenType.AND : TokenType.OR,
        value: fieldPart,
        position,
        length: fieldPart.length,
      },
      pos,
    ];
  }

  // Handle plain strings
  return [
    {
      type: TokenType.STRING,
      value: fieldPart,
      position,
      length: fieldPart.length,
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

// Modified parsePrimary to improve error handling
const parsePrimary = (stream: TokenStream): ParseResult<FirstPassExpression> => {
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
): ParseResult<FirstPassExpression> => {
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
    case "SEARCH_TERM":
      return expr.value.includes(" ") ? `"${expr.value}"` : expr.value;
    case "FIELD_VALUE":
      return `${expr.field}:${expr.value}`;
    case "AND":
      return `(${stringify(expr.left)} AND ${stringify(expr.right)})`;
    case "OR":
      return `(${stringify(expr.left)} OR ${stringify(expr.right)})`;
  }
};

const reservedWords = new Set(["AND", "OR"]);

// Validate individual strings (field:value pairs or plain terms)
const validateString = (expr: StringLiteral, errors: ValidationError[]) => {
  // Check for empty field values
  if (expr.value.endsWith(":")) {
    errors.push({
      message: "Expected field value",
      position: expr.position,
      length: expr.length,
    });
    return;
  }

  // Check for field values that start with colon
  if (expr.value.startsWith(":")) {
    errors.push({
      message: "Missing field name",
      position: expr.position,
      length: expr.length,
    });
    return;
  }

  // For field:value patterns, validate the field name
  if (expr.value.includes(":")) {
    const [fieldName] = expr.value.split(":");

    // Check for reserved words used as field names
    if (reservedWords.has(fieldName.toUpperCase())) {
      errors.push({
        message: `${fieldName} is a reserved word`,
        position: expr.position,
        length: fieldName.length,
      });
      return;
    }

    // Check for invalid characters in field names
    if (!/^[a-zA-Z0-9_-]+$/.test(fieldName)) {
      errors.push({
        message: "Invalid characters in field name",
        position: expr.position,
        length: fieldName.length,
      });
      return;
    }
  }

  // Handle standalone reserved words (not in field:value pattern)
  if (!expr.value.includes(":") && reservedWords.has(expr.value)) {
    errors.push({
      message: `${expr.value} is a reserved word`,
      position: expr.position,
      length: expr.length,
    });
  }
};

const walkExpression = (expr: FirstPassExpression, errors: ValidationError[]) => {
  switch (expr.type) {
    case "STRING":
      validateString(expr, errors);
      break;
    case "AND":
    case "OR":
      walkExpression(expr.left, errors);
      walkExpression(expr.right, errors);
      break;
  }
};

const validateSearchQuery = (expression: FirstPassExpression): ValidationError[] => {
  const errors: ValidationError[] = [];

  if (expression === null) {
    return errors;
  }

  walkExpression(expression, errors);

  return errors;
};

// Helper to transform FirstPassExpression into Expression
const transformToExpression = (expr: FirstPassExpression): Expression => {
  switch (expr.type) {
    case "STRING": {
      // Check if the string is a field:value pattern
      const colonIndex = expr.value.indexOf(':');
      if (colonIndex !== -1) {
        const field = expr.value.substring(0, colonIndex).trim();
        const value = expr.value.substring(colonIndex + 1).trim();
        // Remove quotes if present
        const cleanValue = value.startsWith('"') && value.endsWith('"') 
          ? value.slice(1, -1)
          : value;

        return {
          type: "FIELD_VALUE",
          field,
          value: cleanValue,
          fieldPosition: expr.position,
          fieldLength: colonIndex,
          valuePosition: expr.position + colonIndex + 1,
          valueLength: value.length
        };
      }
      
      return {
        type: "SEARCH_TERM",
        value: expr.value,
        position: expr.position,
        length: expr.length
      };
    }

    case "AND":
      return {
        type: "AND",
        left: transformToExpression(expr.left),
        right: transformToExpression(expr.right),
        position: expr.position,
        length: expr.length
      };

    case "OR":
      return {
        type: "OR",
        left: transformToExpression(expr.left),
        right: transformToExpression(expr.right),
        position: expr.position,
        length: expr.length
      };
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

    const errors = validateSearchQuery(result.result);

    if (errors.length > 0) {
      return {
        type: "SEARCH_QUERY_ERROR",
        expression: null,
        errors: errors,
      };
    }

    const expression = transformToExpression(result.result);

    return { type: "SEARCH_QUERY", expression };
  } catch (error: any) {
    return {
      type: "SEARCH_QUERY_ERROR",
      expression: null,
      errors: [error]
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
  type ValidationError,
};
