import { ParseResult } from "./first-pass-parser";
import { TokenStream, currentToken, TokenType, advanceStream } from "./lexer";
import { SearchQueryErrorCode } from "./validator";

export const parseInValues = (
  stream: TokenStream,
  inValuePosition: number
): ParseResult<string[]> => {
  const values: string[] = [];
  let currentStream = stream;

  // Expect opening parenthesis
  if (currentToken(currentStream).type !== TokenType.LPAREN) {
    throw {
      message: "Expected '(' after IN",
      code: SearchQueryErrorCode.IN_LPAREN_MISSING,
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
          code: SearchQueryErrorCode.IN_LIST_EMPTY,
          position: token.position,
          length: 1,
        };
      }
      return {
        result: values,
        stream: advanceStream(currentStream),
      };
    }

    if (token.type === TokenType.EOF ||
      (token.type !== TokenType.STRING &&
        token.type !== TokenType.QUOTED_STRING &&
        token.type !== TokenType.NUMBER &&
        token.type !== TokenType.COMMA)) {
      throw {
        message: "Expected ',' or ')' after IN value",
        code: SearchQueryErrorCode.IN_SEPARATOR_MISSING,
        position: token.position,
        length: 1,
      };
    }

    if (token.type === TokenType.STRING ||
      token.type === TokenType.QUOTED_STRING ||
      token.type === TokenType.NUMBER) {
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
        code: SearchQueryErrorCode.IN_SEPARATOR_MISSING,
        position: nextToken.position,
        length: 1,
      };
    }

    currentStream = advanceStream(currentStream);
  }
};
