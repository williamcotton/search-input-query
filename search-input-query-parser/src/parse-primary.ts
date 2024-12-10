import { ParseResult, FirstPassExpression, parseExpression } from "./first-pass-parser";
import { parseInValues } from "./parse-in-values";
import { TokenStream, currentToken, TokenType, advanceStream } from "./lexer";
import { SearchQueryErrorCode } from "./validator";

export const expectToken = (
  stream: TokenStream,
  type: TokenType,
  message?: string
): TokenStream => {
  const token = currentToken(stream);
  if (token.type !== type) {
    throw {
      message: message ? message : `Expected ${type}`,
      code: SearchQueryErrorCode.EXPECTED_TOKEN,
      value: type,
      position: token.position,
      length: token.length,
    };
  }
  return advanceStream(stream);
};

// Helper to check if a string value represents a field:value pattern
export const isFieldValuePattern = (value: string): boolean => {
  return value.includes(":");
};

// Helper to extract field and value from a field:value pattern
export const extractFieldValue = (value: string): [string, string] => {
  const [field, ...valueParts] = value.split(":");
  return [field, valueParts.join(":")];
};

export const parsePrimary = (
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
              length: token.length + inValuesResult.stream.position - nextStream.position,
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
        code: SearchQueryErrorCode.RESERVED_WORD,
        value: token.value,
        position: token.position,
        length: token.length,
      };

    case TokenType.RPAREN:
      throw {
        message: 'Unexpected ")"',
        code: SearchQueryErrorCode.UNEXPECTED_RIGHT_PAREN,
        position: token.position,
        length: token.length,
      };

    default:
      throw {
        message: "Unexpected token",
        code: SearchQueryErrorCode.UNEXPECTED_TOKEN,
        position: token.position,
        length: token.length,
      };
  }
};
