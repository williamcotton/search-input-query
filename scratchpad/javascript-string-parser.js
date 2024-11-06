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
    let start = this.position;
    while (!this.atEnd() && !/\s/.test(this.input[this.position])) {
      this.position++;
    }
    if (start === this.position) {
      throw new Error("Expected a word");
    }
    return this.input.slice(start, this.position);
  }
}

// Test queries
const test_queries = [
  "red shoes",
  "comfortable red shoes"
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
