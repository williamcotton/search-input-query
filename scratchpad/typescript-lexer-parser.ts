#!/usr/bin/env ts-node

// Token types
enum TokenType {
  WORD = "WORD",
  QUOTED_STRING = "QUOTED_STRING",
  COLON = "COLON",
  LPAREN = "LPAREN",
  RPAREN = "RPAREN",
  AND = "AND",
  OR = "OR",
  EOF = "EOF",
}

// Token interface
interface Token {
  type: TokenType;
  value: string;
  position: number;
}

// AST node types
type SearchTerm = {
  type: "TERM";
  value: string;
};

type FieldValue = {
  type: "FIELD";
  key: string;
  value: string;
};

type AndExpression = {
  type: "AND";
  left: Expression;
  right: Expression;
};

type OrExpression = {
  type: "OR";
  left: Expression;
  right: Expression;
};

type Expression = SearchTerm | FieldValue | AndExpression | OrExpression;

type SearchQuery = {
  expression: Expression | null;
};

// Lexer class
class Lexer {
  private input: string;
  private position: number;
  private currentChar: string | null;

  constructor(input: string) {
    this.input = input;
    this.position = 0;
    this.currentChar = this.input[0] || null;
  }

  private advance(): void {
    this.position++;
    this.currentChar =
      this.position < this.input.length ? this.input[this.position] : null;
  }

  private peek(): string | null {
    const peekPos = this.position + 1;
    return peekPos < this.input.length ? this.input[peekPos] : null;
  }

  private skipWhitespace(): void {
    while (this.currentChar && /\s/.test(this.currentChar)) {
      this.advance();
    }
  }

  private readQuotedString(): Token {
    const startPos = this.position;
    this.advance(); // Skip opening quote
    let value = "";

    while (this.currentChar !== null) {
      if (this.currentChar === '"') {
        this.advance(); // Skip closing quote
        return { type: TokenType.QUOTED_STRING, value, position: startPos };
      } else if (this.currentChar === "\\") {
        this.advance();
        if (this.currentChar === null) {
          throw new Error("Unexpected end of input after escape character");
        }
        value += this.currentChar;
      } else {
        value += this.currentChar;
      }
      this.advance();
    }

    throw new Error("Unterminated quoted string");
  }

  private readWord(): Token {
    const startPos = this.position;
    let value = "";

    while (this.currentChar && !/[\s:"()]/.test(this.currentChar)) {
      value += this.currentChar;
      this.advance();
    }

    // Check if it's AND/OR
    if (value === "AND") {
      return { type: TokenType.AND, value, position: startPos };
    } else if (value === "OR") {
      return { type: TokenType.OR, value, position: startPos };
    }

    return { type: TokenType.WORD, value, position: startPos };
  }

  getNextToken(): Token {
    while (this.currentChar !== null) {
      // Skip whitespace
      if (/\s/.test(this.currentChar)) {
        this.skipWhitespace();
        continue;
      }

      // Store current position for token
      const currentPos = this.position;

      // Handle different characters
      switch (this.currentChar) {
        case '"':
          return this.readQuotedString();
        case ":":
          this.advance();
          return { type: TokenType.COLON, value: ":", position: currentPos };
        case "(":
          this.advance();
          return { type: TokenType.LPAREN, value: "(", position: currentPos };
        case ")":
          this.advance();
          return { type: TokenType.RPAREN, value: ")", position: currentPos };
        default:
          if (/[a-zA-Z0-9_]/.test(this.currentChar)) {
            return this.readWord();
          }
          throw new Error(`Unexpected character: ${this.currentChar}`);
      }
    }

    return { type: TokenType.EOF, value: "", position: this.position };
  }
}

// Parser class
class Parser {
  private lexer: Lexer;
  private currentToken: Token;

  constructor(input: string) {
    this.lexer = new Lexer(input);
    this.currentToken = this.lexer.getNextToken();
  }

  private eat(tokenType: TokenType): void {
    if (this.currentToken.type === tokenType) {
      this.currentToken = this.lexer.getNextToken();
    } else {
      throw new Error(
        `Expected ${tokenType} but got ${this.currentToken.type}`
      );
    }
  }

  private parsePrimary(): Expression {
    if (this.currentToken.type === TokenType.LPAREN) {
      this.eat(TokenType.LPAREN);
      const expr = this.parseExpression();
      this.eat(TokenType.RPAREN);
      return expr;
    }

    // Try to parse field:value
    if (this.currentToken.type === TokenType.WORD) {
      const key = this.currentToken.value;
      const nextToken = this.lexer.getNextToken();

      if (nextToken.type === TokenType.COLON) {
        // This is a field:value pair
        this.currentToken = nextToken; // Move to colon
        this.eat(TokenType.COLON);

        // Parse value (can be quoted or unquoted)
        let value: string;
        if (this.currentToken.type === TokenType.QUOTED_STRING) {
          value = this.currentToken.value;
          this.eat(TokenType.QUOTED_STRING);
        } else if (this.currentToken.type === TokenType.WORD) {
          value = this.currentToken.value;
          this.eat(TokenType.WORD);
        } else {
          throw new Error(
            `Expected string value after colon, got ${this.currentToken.type}`
          );
        }

        return { type: "FIELD", key: key.toLowerCase(), value };
      } else {
        // This is just a term
        this.currentToken = nextToken;
        return { type: "TERM", value: key };
      }
    }

    if (this.currentToken.type === TokenType.QUOTED_STRING) {
      const value = this.currentToken.value;
      this.eat(TokenType.QUOTED_STRING);
      return { type: "TERM", value };
    }

    throw new Error(`Unexpected token: ${this.currentToken.type}`);
  }

  private parseExpression(minPrecedence: number = 0): Expression {
    let left = this.parsePrimary();

    while (true) {
      if (this.currentToken.type === TokenType.EOF) {
        break;
      }

      let operator = this.currentToken.type;
      if (operator !== TokenType.AND && operator !== TokenType.OR) {
        break;
      }

      const precedence = operator === TokenType.AND ? 2 : 1;
      if (precedence < minPrecedence) {
        break;
      }

      this.eat(operator);
      const right = this.parseExpression(precedence);

      left = {
        type: operator,
        left,
        right,
      };
    }

    return left;
  }

  parse(): SearchQuery {
    if (this.currentToken.type === TokenType.EOF) {
      return { expression: null };
    }

    try {
      const expression = this.parseExpression();
      return { expression };
    } catch (error) {
      console.error("Parse error:", error);
      return { expression: null };
    }
  }
}

// Helper function to stringify expressions
const stringify = (expr: Expression): string => {
  switch (expr.type) {
    case "TERM":
      return expr.value.includes(" ") ? `"${expr.value}"` : expr.value;
    case "FIELD":
      return `${expr.key}:${expr.value}`;
    case "AND":
      return `(${stringify(expr.left)} AND ${stringify(expr.right)})`;
    case "OR":
      return `(${stringify(expr.left)} OR ${stringify(expr.right)})`;
  }
};

// Main parse function
const parseSearchQuery = (input: string): SearchQuery => {
  const parser = new Parser(input);
  return parser.parse();
};

// Test the parser with various queries
const testQueries = [
  '"red shoes" OR ((blue OR purple) AND sneakers)',
  "comfortable AND (leather OR suede)",
  'category:"winter boots" AND (color:black OR color:brown)',
  "boots summer",
  "color:red AND size:large",
  "winter boots color:blue",
  'brand:"Nike\\Air"',
  "field: value",
  "a AND b OR c",
  'category:"winter boots" AND (color:black OR color:brown) AND size:12',
];

for (const query of testQueries) {
  console.log("\nParsing query:", query);
  try {
    const result = parseSearchQuery(query);
    if (result.expression) {
      console.log("Parsed expression:", stringify(result.expression));
    } else {
      console.log("No expression");
    }
  } catch (error) {
    if (error instanceof Error) {
      console.error("Error parsing query:", error.message);
    }
  }
}

export {
  parseSearchQuery,
  type SearchQuery,
  type Expression,
  type SearchTerm,
  type FieldValue,
  type AndExpression,
  type OrExpression,
};
