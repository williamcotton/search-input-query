#!/usr/bin/env node

class Parser {
  constructor(input) {
    this.input = input;
    this.position = 0;
  }

  // Main function to start parsing
  parse() {
    const searchTerms = this.parseSearchTerms();
    const fields = this.parseFields();
    return { searchTerms, fields };
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

  // Parse multiple search terms (both quoted and unquoted)
  parseSearchTerms() {
    const terms = [];
    this.skipWhitespace();

    while (!this.atEnd()) {
      // Try to parse quoted term
      if (this.input[this.position] === '"') {
        try {
          terms.push(this.parseQuotedTerm());
          this.skipWhitespace();
          continue;
        } catch (e) {
          // If quoted parsing fails, try unquoted
        }
      }

      // Try to parse unquoted term
      try {
        // Peek ahead to see if this is actually a field
        const savedPosition = this.position;
        const word = this.parseWord();
        this.skipWhitespace();

        if (!this.atEnd() && this.input[this.position] === ":") {
          // This is a field, rewind and break
          this.position = savedPosition;
          break;
        }

        terms.push(word);
      } catch (e) {
        break;
      }
    }

    return terms;
  }

  // Parse a quoted search term
  parseQuotedTerm() {
    if (this.atEnd() || this.input[this.position] !== '"') {
      throw new Error("Expected opening quote for search term");
    }
    this.position++; // Skip opening quote

    let start = this.position;
    while (!this.atEnd() && this.input[this.position] !== '"') {
      if (this.input[this.position] === "\\") {
        this.position++;
        if (this.atEnd()) {
          throw new Error("Unexpected end of input after escape character");
        }
      }
      this.position++;
    }

    if (this.atEnd() || this.input[this.position] !== '"') {
      throw new Error("Expected closing quote for search term");
    }

    let term = this.input.slice(start, this.position);
    this.position++; // Skip closing quote
    return term;
  }

  // Parse a single unquoted word
  parseWord() {
    this.skipWhitespace();
    let start = this.position;
    while (!this.atEnd() && /[a-zA-Z0-9_-]/.test(this.input[this.position])) {
      this.position++;
    }
    if (start === this.position) {
      throw new Error("Expected a word");
    }
    return this.input.slice(start, this.position);
  }

  // Parse all key-value pairs into fields object
  parseFields() {
    const fields = {};
    this.skipWhitespace();

    while (!this.atEnd()) {
      try {
        const key = this.parseWord().toLowerCase();
        this.expect(":");
        const value = this.parseWord();
        fields[key] = value;
        this.skipWhitespace();
      } catch (e) {
        break;
      }
    }

    return fields;
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
  '"red shoes" category:clothing size:10 color:red brand:nike',
  "red shoes category:clothing size:10 color:red brand:nike",
  "comfortable red shoes category:clothing size:10",
  'category:clothing "red winter shoes" warm cozy',
  '"quoted term" another term yet:another',
];

// Run tests
for (const query of test_queries) {
  console.log("\nParsing query:", query);
  try {
    const parser = new Parser(query);
    const result = parser.parse();
    console.log("Search terms:", result.searchTerms);
    console.log("Fields:");
    for (const [key, value] of Object.entries(result.fields)) {
      console.log(`  ${key}: ${value}`);
    }
  } catch (error) {
    console.error("Error parsing query:", error.message);
  }
}

// Export the Parser class if using as a module
if (typeof module !== "undefined" && module.exports) {
  module.exports = Parser;
}
