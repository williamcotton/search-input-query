import { TokenType, TokenStream, currentToken, advanceStream } from "./lexer";

// First Pass AST types (from tokenizer/parser)
export type PositionLength = {
  position: number;
  length: number;
};

export type StringLiteral = {
  readonly type: "STRING";
  readonly value: string;
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

export type FirstPassExpression = StringLiteral | AndExpression | OrExpression | NotExpression;

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

const parsePrimary = (
  stream: TokenStream
): ParseResult<FirstPassExpression> => {
  const token = currentToken(stream);

  switch (token.type) {
    case TokenType.NOT: {
      const nextStream = advanceStream(stream);
      const nextToken = currentToken(nextStream);

      // If what follows NOT is a parenthesis, parse it accordingly
      if (nextToken.type === TokenType.LPAREN) {
        const afterLParen = advanceStream(nextStream);
        const exprResult = parseExpression(afterLParen);
        const finalStream = expectToken(exprResult.stream, TokenType.RPAREN);
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

      // Otherwise, parse just the next primary expression
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

    // Rest of the cases remain the same
    case TokenType.LPAREN: {
      const innerStream = advanceStream(stream);
      const exprResult = parseExpression(innerStream);
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

export const parseExpression = (
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

    // Handle implicit AND (adjacent terms, including NOT and parenthesized expressions)
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
