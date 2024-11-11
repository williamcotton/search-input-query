import { TokenType, TokenStream, currentToken, advanceStream } from "./lexer";
import { parsePrimary } from "./parse-primary";

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
export interface ParseResult<T> {
  readonly result: T;
  readonly stream: TokenStream;
}

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
