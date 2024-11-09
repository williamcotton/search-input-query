import { TokenType, TokenStream, currentToken, advanceStream } from "./lexer";

// First Pass AST types (from tokenizer/parser)
export type PositionLength = {
  position: number;
  length: number;
};

export type StringLiteral = {
  readonly type: "STRING";
  readonly value: string;
  readonly quoted: boolean;
} & PositionLength;

export type WildcardPattern = {
  readonly type: "WILDCARD";
  readonly prefix: string;
  readonly quoted: boolean;
} & PositionLength;

export type AndExpression = {
  readonly type: "AND";
  readonly left: FirstPassExpression;
  readonly right: FirstPassExpression;
} & PositionLength;

export type OrExpression = {
  readonly type: "OR";
  readonly left: FirstPassExpression;
  readonly right: FirstPassExpression;
} & PositionLength;

export type NotExpression = {
  readonly type: "NOT";
  readonly expression: FirstPassExpression;
} & PositionLength;

export type InExpression = {
  readonly type: "IN";
  readonly field: string;
  readonly values: string[];
} & PositionLength;

export type FirstPassExpression =
  | StringLiteral
  | WildcardPattern
  | AndExpression
  | OrExpression
  | NotExpression
  | InExpression;

// Parser functions
interface ParseResult<T> {
  readonly result: T;
  readonly stream: TokenStream;
}

const expectToken = (
  stream: TokenStream,
  type: TokenType,
  message?: string
): TokenStream => {
  const token = currentToken(stream);
  if (token.type !== type) {
    throw {
      message: message ? message : `Expected ${type}`,
      position: token.position,
      length: token.length,
    };
  }
  return advanceStream(stream);
};

// Helper to check if a string value represents a field:value pattern
const isFieldValuePattern = (value: string): boolean => {
  return value.includes(":");
};

// Helper to extract field and value from a field:value pattern
const extractFieldValue = (value: string): [string, string] => {
  const [field, ...valueParts] = value.split(":");
  return [field, valueParts.join(":")];
};

const parseInValues = (
  stream: TokenStream,
  inValuePosition: number
): ParseResult<string[]> => {
  const values: string[] = [];
  let currentStream = stream;

  // Expect opening parenthesis
  if (currentToken(currentStream).type !== TokenType.LPAREN) {
    throw {
      message: "Expected '(' after IN",
      position: inValuePosition, // Use the position passed from the caller
      length: 1,
    };
  }
  currentStream = advanceStream(currentStream);

  while (true) {
    const token = currentToken(currentStream);

    if (token.type === TokenType.RPAREN) {
      if (values.length === 0) {
        throw {
          message: "IN operator requires at least one value",
          position: token.position,
          length: 1,
        };
      }
      return {
        result: values,
        stream: advanceStream(currentStream),
      };
    }

    if (
      token.type === TokenType.EOF ||
      (token.type !== TokenType.STRING &&
        token.type !== TokenType.QUOTED_STRING &&
        token.type !== TokenType.NUMBER &&
        token.type !== TokenType.COMMA)
    ) {
      throw {
        message: "Expected ',' or ')' after IN value",
        position: token.position,
        length: 1,
      };
    }

    if (
      token.type === TokenType.STRING ||
      token.type === TokenType.QUOTED_STRING ||
      token.type === TokenType.NUMBER
    ) {
      values.push(token.value);
      currentStream = advanceStream(currentStream);

      const nextToken = currentToken(currentStream);
      if (nextToken.type === TokenType.COMMA) {
        currentStream = advanceStream(currentStream);
        continue;
      }
      if (nextToken.type === TokenType.RPAREN) {
        continue;
      }
      throw {
        message: "Expected ',' or ')' after IN value",
        position: nextToken.position,
        length: 1,
      };
    }

    currentStream = advanceStream(currentStream);
  }
};

const parsePrimary = (
  stream: TokenStream
): ParseResult<FirstPassExpression> => {
  const token = currentToken(stream);

  switch (token.type) {
    case TokenType.NOT: {
      const nextStream = advanceStream(stream);
      const nextToken = currentToken(nextStream);

      if (nextToken.type === TokenType.LPAREN) {
        const afterLParen = advanceStream(nextStream);
        const exprResult = parseExpression(afterLParen);
        const finalStream = expectToken(
          exprResult.stream,
          TokenType.RPAREN,
          "Expected ')'"
        );
        return {
          result: {
            type: "NOT",
            expression: exprResult.result,
            position: token.position,
            length: token.length,
          },
          stream: finalStream,
        };
      }

      const exprResult = parsePrimary(nextStream);
      return {
        result: {
          type: "NOT",
          expression: exprResult.result,
          position: token.position,
          length: token.length,
        },
        stream: exprResult.stream,
      };
    }

    case TokenType.LPAREN: {
      const innerStream = advanceStream(stream);
      const exprResult = parseExpression(innerStream);
      const finalStream = expectToken(
        exprResult.stream,
        TokenType.RPAREN,
        "Expected ')'"
      );
      return { result: exprResult.result, stream: finalStream };
    }

    case TokenType.STRING:
    case TokenType.QUOTED_STRING: {
      const { value } = token;
      const isQuoted = token.type === TokenType.QUOTED_STRING;

      // Check for field:IN pattern
      if (value.includes(":")) {
        const [field, remainder] = value.split(":");
        if (remainder.toUpperCase() === "IN") {
          const nextStream = advanceStream(stream);
          const colonIndex = value.indexOf(":");
          const inValuePosition = token.position + colonIndex + 2; // After field:IN
          const inValuesResult = parseInValues(nextStream, inValuePosition);

          return {
            result: {
              type: "IN",
              field,
              values: inValuesResult.result,
              position: token.position,
              length:
                token.length + inValuesResult.stream.position - nextStream.position,
            },
            stream: inValuesResult.stream,
          };
        }
      }

      // Handle field:value patterns
      if (isFieldValuePattern(value)) {
        const [field, rawValue] = extractFieldValue(value);

        // If it has a trailing wildcard
        if (rawValue.endsWith("*")) {
          return {
            result: {
              type: "WILDCARD",
              prefix: `${field}:${rawValue.slice(0, -1)}`,
              quoted: isQuoted,
              position: token.position,
              length: token.length,
            },
            stream: advanceStream(stream),
          };
        }
      }

      // Handle regular terms with wildcards
      if (value.endsWith("*")) {
        return {
          result: {
            type: "WILDCARD",
            prefix: value.slice(0, -1),
            quoted: isQuoted,
            position: token.position,
            length: token.length,
          },
          stream: advanceStream(stream),
        };
      }

      // Regular string without wildcards
      return {
        result: {
          type: "STRING",
          value,
          quoted: token.type === TokenType.QUOTED_STRING,
          position: token.position,
          length: token.length,
        },
        stream: advanceStream(stream),
      };
    }

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

export const parseExpression = (
  stream: TokenStream,
  minPrecedence: number = 0
): ParseResult<FirstPassExpression> => {
  const token = currentToken(stream);
  if (token.type === TokenType.STRING && token.value === "*") {
    return {
      result: {
        type: "WILDCARD",
        prefix: "",
        quoted: false,
        position: token.position,
        length: token.length,
      },
      stream: advanceStream(stream),
    };
  }

  let result = parsePrimary(stream);

  while (true) {
    const token = currentToken(result.stream);
    if (token.type === TokenType.EOF) break;

    if (token.type === TokenType.AND || token.type === TokenType.OR) {
      const precedence = getOperatorPrecedence(token.type);
      if (precedence < minPrecedence) break;

      const operator = token.type;
      const nextStream = advanceStream(result.stream);

      const nextToken = currentToken(nextStream);
      if (nextToken.type === TokenType.EOF) {
        throw {
          message: `Unexpected token: ${token.value}`,
          position: token.position,
          length: token.length,
        };
      }

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

    if (
      token.type === TokenType.STRING ||
      token.type === TokenType.QUOTED_STRING ||
      token.type === TokenType.LPAREN ||
      token.type === TokenType.NOT
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
