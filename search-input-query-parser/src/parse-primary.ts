import { ParseResult, FirstPassExpression, parseExpression } from "./first-pass-parser";
import { parseInValues } from "./parse-in-values";
import { Token, TokenStream, currentToken, TokenType, advanceStream } from "./lexer";
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
      code: SearchQueryErrorCode.SYNTAX_TOKEN_MISSING,
      value: type,
      position: token.position,
      length: token.length,
    };
  }
  return advanceStream(stream);
};

// Helper to check if a string value represents a field:value pattern
// Kept for backward compatibility (exported via index.ts)
export const isFieldValuePattern = (value: string): boolean => {
  return value.includes(":");
};

// Helper to extract field and value from a field:value pattern
// Kept for backward compatibility (exported via index.ts)
export const extractFieldValue = (value: string): [string, string] => {
  const [field, ...valueParts] = value.split(":");
  return [field, valueParts.join(":")];
};

// Check if two tokens are directly adjacent (no whitespace gap)
const isAdjacentTo = (a: Token, b: Token): boolean =>
  a.position + a.length === b.position;

// Parse a field:value expression starting from the field token.
// The stream is positioned at the field token, with the COLON as the next token.
const parseFieldValue = (
  stream: TokenStream,
  fieldToken: Token
): ParseResult<FirstPassExpression> => {
  const colonStream = advanceStream(stream);         // past field → at COLON
  const colonToken = currentToken(colonStream);       // the COLON token
  const afterColonStream = advanceStream(colonStream); // past COLON
  const afterColonToken = currentToken(afterColonStream);

  const fieldName = fieldToken.value;
  const emptyFieldLength = colonToken.position + colonToken.length - fieldToken.position;

  // Empty value: nothing adjacent after colon, or EOF
  if (afterColonToken.type === TokenType.EOF || !isAdjacentTo(colonToken, afterColonToken)) {
    return {
      result: {
        type: "STRING",
        value: fieldName + ":",
        quoted: false,
        position: fieldToken.position,
        length: emptyFieldLength,
      },
      stream: afterColonStream,
    };
  }

  // Double colon: field:: → treat as empty value, second colon parsed separately
  if (afterColonToken.type === TokenType.COLON) {
    return {
      result: {
        type: "STRING",
        value: fieldName + ":",
        quoted: false,
        position: fieldToken.position,
        length: emptyFieldLength,
      },
      stream: afterColonStream,
    };
  }

  // field:IN(...) pattern
  if (afterColonToken.type === TokenType.IN) {
    const inValuePosition = afterColonToken.position + afterColonToken.length;
    const afterInStream = advanceStream(afterColonStream);
    const inValuesResult = parseInValues(afterInStream, inValuePosition);

    // Calculate length from field start to end of last consumed token
    const lastIdx = inValuesResult.stream.position - 1;
    const lastTok = lastIdx >= 0 && lastIdx < stream.tokens.length
      ? stream.tokens[lastIdx]
      : afterColonToken;
    const totalLength = lastTok.position + lastTok.length - fieldToken.position;

    return {
      result: {
        type: "IN",
        field: fieldName,
        values: inValuesResult.result,
        position: fieldToken.position,
        length: totalLength,
      },
      stream: inValuesResult.stream,
    };
  }

  // field:"quoted value" pattern
  if (afterColonToken.type === TokenType.QUOTED_STRING) {
    const quotedValue = afterColonToken.value;
    const combinedValue = fieldName + ":" + quotedValue;
    const totalLength = afterColonToken.position + afterColonToken.length - fieldToken.position;
    const resultStream = advanceStream(afterColonStream);

    if (combinedValue.endsWith("*")) {
      return {
        result: {
          type: "WILDCARD",
          prefix: combinedValue.slice(0, -1),
          quoted: true,
          position: fieldToken.position,
          length: totalLength,
        },
        stream: resultStream,
      };
    }

    return {
      result: {
        type: "STRING",
        value: combinedValue,
        quoted: true,
        position: fieldToken.position,
        length: totalLength,
      },
      stream: resultStream,
    };
  }

  // Greedy adjacent value reading for unquoted values.
  // Consumes all adjacent tokens that can be part of a value:
  // STRING, NUMBER, COLON (for URLs), and keywords used as values.
  let value = "";
  let currentStream = afterColonStream;
  let lastTok: Token = colonToken;

  while (true) {
    const tok = currentToken(currentStream);
    if (tok.type === TokenType.EOF) break;
    if (!isAdjacentTo(lastTok, tok)) break;

    if (
      tok.type === TokenType.STRING ||
      tok.type === TokenType.NUMBER ||
      tok.type === TokenType.COLON ||
      tok.type === TokenType.AND ||
      tok.type === TokenType.OR ||
      tok.type === TokenType.NOT ||
      tok.type === TokenType.IN
    ) {
      value += tok.value;
      lastTok = tok;
      currentStream = advanceStream(currentStream);
      continue;
    }

    break;
  }

  // No value tokens found (e.g., colon followed by LPAREN without IN)
  if (value === "") {
    return {
      result: {
        type: "STRING",
        value: fieldName + ":",
        quoted: false,
        position: fieldToken.position,
        length: emptyFieldLength,
      },
      stream: afterColonStream,
    };
  }

  const combinedValue = fieldName + ":" + value;
  const totalLength = lastTok.position + lastTok.length - fieldToken.position;

  if (value.endsWith("*")) {
    return {
      result: {
        type: "WILDCARD",
        prefix: fieldName + ":" + value.slice(0, -1),
        quoted: false,
        position: fieldToken.position,
        length: totalLength,
      },
      stream: currentStream,
    };
  }

  return {
    result: {
      type: "STRING",
      value: combinedValue,
      quoted: false,
      position: fieldToken.position,
      length: totalLength,
    },
    stream: currentStream,
  };
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
    case TokenType.NUMBER: {
      // Peek ahead for adjacent COLON to detect field:value pattern
      const nextIdx = stream.position + 1;
      if (nextIdx < stream.tokens.length) {
        const nextTok = stream.tokens[nextIdx];
        if (nextTok.type === TokenType.COLON && isAdjacentTo(token, nextTok)) {
          return parseFieldValue(stream, token);
        }
      }

      // Regular term (no field:value)
      const { value } = token;

      if (value.endsWith("*")) {
        return {
          result: {
            type: "WILDCARD",
            prefix: value.slice(0, -1),
            quoted: false,
            position: token.position,
            length: token.length,
          },
          stream: advanceStream(stream),
        };
      }

      return {
        result: {
          type: "STRING",
          value,
          quoted: false,
          position: token.position,
          length: token.length,
        },
        stream: advanceStream(stream),
      };
    }

    case TokenType.QUOTED_STRING: {
      const { value } = token;

      if (value.endsWith("*")) {
        return {
          result: {
            type: "WILDCARD",
            prefix: value.slice(0, -1),
            quoted: true,
            position: token.position,
            length: token.length,
          },
          stream: advanceStream(stream),
        };
      }

      return {
        result: {
          type: "STRING",
          value,
          quoted: true,
          position: token.position,
          length: token.length,
        },
        stream: advanceStream(stream),
      };
    }

    case TokenType.COLON: {
      // Standalone colon: read adjacent tokens to form ":value" or just ":"
      let value = ":";
      let currentStream = advanceStream(stream);
      let lastTok: Token = token;

      // Check for adjacent quoted string: :"quoted value"
      const nextTok = currentToken(currentStream);
      if (nextTok.type === TokenType.QUOTED_STRING && isAdjacentTo(token, nextTok)) {
        const combinedValue = ":" + nextTok.value;
        const totalLength = nextTok.position + nextTok.length - token.position;
        return {
          result: {
            type: "STRING",
            value: combinedValue,
            quoted: true,
            position: token.position,
            length: totalLength,
          },
          stream: advanceStream(currentStream),
        };
      }

      while (true) {
        const tok = currentToken(currentStream);
        if (tok.type === TokenType.EOF) break;
        if (!isAdjacentTo(lastTok, tok)) break;
        if (
          tok.type === TokenType.STRING ||
          tok.type === TokenType.NUMBER ||
          tok.type === TokenType.COLON
        ) {
          value += tok.value;
          lastTok = tok;
          currentStream = advanceStream(currentStream);
          continue;
        }
        break;
      }

      const totalLength = lastTok.position + lastTok.length - token.position;

      return {
        result: {
          type: "STRING",
          value,
          quoted: false,
          position: token.position,
          length: totalLength,
        },
        stream: currentStream,
      };
    }

    case TokenType.AND:
    case TokenType.OR:
      throw {
        message: `${token.value} is a reserved word`,
        code: SearchQueryErrorCode.SYNTAX_KEYWORD_RESERVED,
        value: token.value,
        position: token.position,
        length: token.length,
      };

    case TokenType.RPAREN:
      throw {
        message: 'Unexpected ")"',
        code: SearchQueryErrorCode.SYNTAX_PARENTHESIS_UNEXPECTED,
        position: token.position,
        length: token.length,
      };

    default:
      throw {
        message: "Unexpected token",
        code: SearchQueryErrorCode.SYNTAX_TOKEN_UNEXPECTED,
        position: token.position,
        length: token.length,
      };
  }
};
