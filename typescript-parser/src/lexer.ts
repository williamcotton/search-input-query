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

const isSpecialChar = (char: string): boolean => /[\s"():()]/.test(char);
const isEscapeChar = (char: string): boolean => char === "\\";
const isQuoteChar = (char: string): boolean => char === '"';
const isWhitespace = (char: string): boolean => /\s/.test(char);

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
  if (fieldPart === "AND" || fieldPart === "OR" || fieldPart === "NOT") {
    return [
      {
        type:
          fieldPart === "AND"
            ? TokenType.AND
            : fieldPart === "OR"
            ? TokenType.OR
            : TokenType.NOT,
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
