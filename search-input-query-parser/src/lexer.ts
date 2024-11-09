// Token types and data structures
export enum TokenType {
  STRING = "STRING",
  QUOTED_STRING = "QUOTED_STRING",
  LPAREN = "LPAREN",
  RPAREN = "RPAREN",
  AND = "AND",
  OR = "OR",
  NOT = "NOT",
  EOF = "EOF",
  IN = "IN",
  COMMA = "COMMA",
  NUMBER = "NUMBER",
}

export interface Token {
  type: TokenType;
  value: string;
  position: number;
  length: number;
}

export interface TokenStream {
  readonly tokens: Token[];
  readonly position: number;
}

// Tokenizer functions
export const createStream = (tokens: Token[]): TokenStream => ({
  tokens,
  position: 0,
});

export const currentToken = (stream: TokenStream): Token =>
  stream.position < stream.tokens.length
    ? stream.tokens[stream.position]
    : { type: TokenType.EOF, value: "", position: stream.position, length: 0 };

export const advanceStream = (stream: TokenStream): TokenStream => ({
  ...stream,
  position: stream.position + 1,
});

const isSpecialChar = (char: string): boolean => /[\s"():(),]/.test(char);
const isEscapeChar = (char: string): boolean => char === "\\";
const isQuoteChar = (char: string): boolean => char === '"';
const isWhitespace = (char: string): boolean => /\s/.test(char);
const isWildcard = (char: string): boolean => char === "*";

const readUntil = (
  input: string,
  start: number,
  predicate: (char: string) => boolean
): string => {
  let result = "";
  let pos = start;
  let foundWildcard = false;

  while (pos < input.length) {
    const char = input[pos];
    // Once we find a wildcard, include everything up to the next whitespace or special char
    if (isWildcard(char)) {
      foundWildcard = true;
    }
    if (isWhitespace(char) || (!foundWildcard && !predicate(char))) {
      break;
    }
    result += char;
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

const tokenizeQuotedString = (
  input: string,
  position: number
): [Token, number] => {
  let value = '"'; // Start with opening quote
  let pos = position + 1; // Skip opening quote in input processing
  let length = 2; // Start with 2 for the quotes

  while (pos < input.length) {
    const char = input[pos];

    if (isQuoteChar(char)) {
      // Add closing quote
      value += '"';

      // Move past closing quote
      pos++;

      // Read any wildcards after the closing quote
      let wildcards = "";
      while (pos < input.length && isWildcard(input[pos])) {
        wildcards += "*";
        pos++;
        length++;
      }

      if (wildcards) {
        value += wildcards;
      }

      return [
        {
          type: TokenType.QUOTED_STRING,
          value,
          position,
          length,
        },
        pos,
      ];
    }

    if (isEscapeChar(char) && pos + 1 < input.length) {
      value += input[pos] + input[pos + 1]; // Include escape char and escaped char
      length += 2;
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

  if (/^-?\d+(\.\d+)?/.test(input.slice(pos))) {
    const match = input.slice(pos).match(/^-?\d+(\.\d+)?/);
    if (match) {
      const numValue = match[0];
      return [
        {
          type: TokenType.NUMBER,
          value: numValue,
          position: pos,
          length: numValue.length,
        },
        pos + numValue.length,
      ];
    }
  }

  // Read until we hit a special character, whitespace, or colon
  const fieldPart = readUntil(
    input,
    pos,
    (char) => !isWhitespace(char) && char !== ":" && !isSpecialChar(char)
  );
  pos += fieldPart.length;

  // Check if this is a field:value pattern
  if (pos < input.length && input[pos] === ":") {
    // Skip colon
    pos++;

    // Handle quoted values
    if (pos < input.length && input[pos] === '"') {
      const [quotedToken, newPos] = tokenizeQuotedString(input, pos);
      return [
        {
          type: TokenType.QUOTED_STRING,
          value: `${fieldPart}:${quotedToken.value}`,
          position: position,
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

    // Check for wildcard after the value
    if (pos < input.length && isWildcard(input[pos])) {
      return [
        {
          type: TokenType.STRING,
          value: `${fieldPart}:${valuePart}*`,
          position,
          length: pos + 1 - position,
        },
        pos + 1,
      ];
    }

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

  // Handle logical operators (case-insensitive)
  const upperFieldPart = fieldPart.toUpperCase();
  if (
    upperFieldPart === "AND" ||
    upperFieldPart === "OR" ||
    upperFieldPart === "NOT"
  ) {
    return [
      {
        type:
          upperFieldPart === "AND"
            ? TokenType.AND
            : upperFieldPart === "OR"
            ? TokenType.OR
            : TokenType.NOT,
        value: upperFieldPart,
        position,
        length: fieldPart.length,
      },
      pos,
    ];
  }

  // Handle IN operator (case-insensitive)
  if (upperFieldPart === "IN") {
    return [
      {
        type: TokenType.IN,
        value: "IN",
        position,
        length: fieldPart.length,
      },
      pos,
    ];
  }

  // Read any wildcards after the string
  let wildcards = "";
  while (pos < input.length && isWildcard(input[pos])) {
    wildcards += "*";
    pos++;
  }
  if (wildcards) {
    return [
      {
        type: TokenType.STRING,
        value: fieldPart + wildcards,
        position,
        length: pos - position,
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

export const tokenize = (input: string): Token[] => {
  const tokens: Token[] = [];
  let position = 0;

  while (position < input.length) {
    const char = input[position];

    if (isWhitespace(char)) {
      position++;
      continue;
    }

    switch (char) {
      case "-": {
        // Check if this is the start of a term/expression
        if (position === 0 || isWhitespace(input[position - 1])) {
          tokens.push({
            type: TokenType.NOT,
            value: "NOT",
            position,
            length: 1,
          });
          position++;
        } else {
          // If minus is not at start of term, treat it as part of the term
          const [token, newPos] = tokenizeString(input, position);
          tokens.push(token);
          position = newPos;
        }
        break;
      }

      case '"': {
        // Before tokenizing a quoted string, check if it's adjacent to a previous quoted string
        if (tokens.length > 0) {
          const prevToken = tokens[tokens.length - 1];
          const prevEnd = prevToken.position + prevToken.length;
          // If there's no whitespace between this quote and the previous token's end
          if (
            position === prevEnd &&
            prevToken.type !== TokenType.COMMA &&
            (prevToken.type === TokenType.QUOTED_STRING ||
              prevToken.type === TokenType.STRING)
          ) {
            throw {
              message:
                "Invalid syntax: Missing operator or whitespace between terms",
              position: position,
              length: 1,
            };
          }
        }

        const [token, newPos] = tokenizeQuotedString(input, position);
        // After tokenizing, check if the next character is not a whitespace or special character
        if (
          newPos < input.length &&
          !isWhitespace(input[newPos]) &&
          !isSpecialChar(input[newPos])
        ) {
          throw {
            message:
              "Invalid syntax: Missing operator or whitespace between terms",
            position: newPos,
            length: 1,
          };
        }
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

      case ",": {
        tokens.push({
          type: TokenType.COMMA,
          value: ",",
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
