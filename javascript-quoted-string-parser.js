#!/usr/bin/env node

class Parser {
  constructor(input) {
    this.input = input;
    this.position = 0;
  }

  // Main function to start parsing
  parse() {
    const searchTerms = [];
    this.skipWhitespace();

    while (!this.atEnd()) {
      const savedPosition = this.position;

      // Try to parse a search term
      try {
        const term = this.parseTerm();
        searchTerms.push(term);
        this.skipWhitespace();
      } catch (e) {
        // If we can't parse a term, we can't proceed further
        break;
      }
    }

    return { searchTerms };
  }

  // Helper to check if we've reached the end of the input
  atEnd() {
    return this.position >= this.input.length;
  }

  // Helper to consume whitespace
  skipWhitespace() {
    while (!this.atEnd() && /\s/.test(this.input[this.position])) {
      this.position++;
    }
  }

  // Parse a search term (quoted or unquoted)
  parseTerm() {
    this.skipWhitespace();

    if (this.atEnd()) {
      throw new Error("Unexpected end of input");
    }

    if (this.input[this.position] === '"') {
      return this.parseQuotedTerm();
    } else {
      return this.parseWord();
    }
  }

  // Parse a quoted term
  parseQuotedTerm() {
    if (this.atEnd() || this.input[this.position] !== '"') {
      throw new Error("Expected opening quote for search term");
    }
    this.position++; // Skip opening quote

    let term = "";
    while (!this.atEnd()) {
      if (this.input[this.position] === "\\") {
        this.position++;
        if (this.atEnd()) {
          throw new Error("Unexpected end of input after escape character");
        }
        term += this.input[this.position];
      } else if (this.input[this.position] === '"') {
        break;
      } else {
        term += this.input[this.position];
      }
      this.position++;
    }

    if (this.atEnd() || this.input[this.position] !== '"') {
      throw new Error("Expected closing quote for search term");
    }

    this.position++; // Skip closing quote
    return term;
  }

  // Parse a word (unquoted term)
  parseWord() {
    this.skipWhitespace();
    let start = this.position;
    while (
      !this.atEnd() &&
      !/\s/.test(this.input[this.position])
    ) {
      this.position++;
    }
    if (start === this.position) {
      throw new Error("Expected a word");
    }
    return this.input.slice(start, this.position);
  }

  // Expect a specific character and move position forward
  expect(char) {
    this.skipWhitespace();
    if (this.atEnd() || this.input[this.position] !== char) {
      throw new Error(
        `Expected '${char}' but found '${
          this.atEnd() ? "end of input" : this.input[this.position]
        }'`
      );
    }
    this.position++;
  }
}

// Test queries
const test_queries = [
  '"red shoes"',
  "red shoes",
  "comfortable red shoes",
  '"red winter shoes" warm cozy',
  '"quoted term" another term "yet another"',
];

// Run tests
for (const query of test_queries) {
  console.log("\nParsing query:", query);
  try {
    const parser = new Parser(query);
    const result = parser.parse();
    console.log("Search terms:", result.searchTerms);
  } catch (error) {
    console.error("Error parsing query:", error.message);
  }
}

// Export the Parser class if using as a module
if (typeof module !== "undefined" && module.exports) {
  module.exports = Parser;
}
