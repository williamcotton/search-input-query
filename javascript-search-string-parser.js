#!/usr/bin/env node

class Parser {
  constructor(input) {
    this.input = input;
    this.position = 0;
  }

  // Main function to start parsing
  parse() {
    const searchTerm = this.parseSearchTerm();
    const keyValuePairs = this.parseKeyValuePairs();
    return { searchTerm, keyValuePairs };
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

  // Parse the search term which is inside double quotes
  parseSearchTerm() {
    this.skipWhitespace();
    if (this.atEnd() || this.input[this.position] !== '"') {
      throw new Error("Expected opening quote for search term");
    }
    this.position++; // Skip opening quote

    let start = this.position;
    while (!this.atEnd() && this.input[this.position] !== '"') {
      this.position++;
    }

    if (this.atEnd() || this.input[this.position] !== '"') {
      throw new Error("Expected closing quote for search term");
    }

    let searchTerm = this.input.slice(start, this.position);
    this.position++; // Skip closing quote
    return searchTerm;
  }

  // Parse the key-value pairs
  parseKeyValuePairs() {
    let pairs = [];
    this.skipWhitespace();

    while (!this.atEnd()) {
      const key = this.parseKey();
      this.expect(":");
      const value = this.parseValue();
      pairs.push({ key, value });
      this.skipWhitespace();
    }

    return pairs;
  }

  // Parse the key (alphanumeric characters)
  parseKey() {
    this.skipWhitespace();
    let start = this.position;

    while (!this.atEnd() && /\w/.test(this.input[this.position])) {
      this.position++;
    }

    if (start === this.position) {
      throw new Error("Expected a key");
    }

    return this.input.slice(start, this.position);
  }

  // Parse the value (alphanumeric characters)
  parseValue() {
    this.skipWhitespace();
    let start = this.position;

    while (!this.atEnd() && /\w/.test(this.input[this.position])) {
      this.position++;
    }

    if (start === this.position) {
      throw new Error("Expected a value");
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

// Example usage
const input = '"red shoes" category:clothing size:10 color:red brand:nike';
const parser = new Parser(input);

try {
  const result = parser.parse();
  console.log("Search term:", result.searchTerm);
  console.log("Key-Value pairs:", result.keyValuePairs);
} catch (error) {
  console.error("Parsing error:", error.message);
}

// Export the Parser class if using as a module
if (typeof module !== "undefined" && module.exports) {
  module.exports = Parser;
}
