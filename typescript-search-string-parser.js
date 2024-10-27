#!/usr/bin/env ts-node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseSearchQuery = void 0;
// Parser state constructor
var makeState = function (input, position) {
    if (position === void 0) { position = 0; }
    return ({
        input: input,
        position: position,
    });
};
// Core parsing primitives
var atEnd = function (state) {
    return state.position >= state.input.length;
};
var currentChar = function (state) {
    return atEnd(state) ? null : state.input[state.position];
};
var advance = function (state) {
    return makeState(state.input, state.position + 1);
};
var skipWhile = function (predicate) {
    return function (state) {
        var current = state;
        while (!atEnd(current) && predicate(currentChar(current))) {
            current = advance(current);
        }
        return current;
    };
};
var skipWhitespace = skipWhile(function (char) { return /\s/.test(char); });
// Parsing combinators
var takeWhile = function (predicate) {
    return function (state) {
        var result = "";
        var current = state;
        while (!atEnd(current) && predicate(currentChar(current))) {
            result += currentChar(current);
            current = advance(current);
        }
        return {
            state: current,
            value: result,
        };
    };
};
// Specific parsers
var parseQuotedString = function (state) {
    state = skipWhitespace(state);
    if (atEnd(state) || currentChar(state) !== '"') {
        throw new Error("Expected opening quote");
    }
    var current = advance(state); // Skip opening quote
    var result = "";
    while (!atEnd(current) && currentChar(current) !== '"') {
        if (currentChar(current) === "\\") {
            current = advance(current);
            if (atEnd(current)) {
                throw new Error("Unexpected end of input after escape character");
            }
            result += currentChar(current);
        }
        else {
            result += currentChar(current);
        }
        current = advance(current);
    }
    if (atEnd(current)) {
        throw new Error("Expected closing quote");
    }
    return {
        state: advance(current), // Skip closing quote
        value: result,
    };
};
var parseWord = function (state) {
    state = skipWhitespace(state);
    var result = takeWhile(function (char) { return /[^\s:]/.test(char); })(state);
    if (result.value.length === 0) {
        throw new Error("Expected a word");
    }
    return result;
};
var parseTerm = function (state) {
    state = skipWhitespace(state);
    if (atEnd(state)) {
        throw new Error("Unexpected end of input");
    }
    if (currentChar(state) === '"') {
        return parseQuotedString(state);
    }
    else {
        return parseWord(state);
    }
};
var parseKeyValuePair = function (state) {
    state = skipWhitespace(state);
    var _a = parseWord(state), afterKey = _a.state, key = _a.value;
    if (atEnd(afterKey) || currentChar(afterKey) !== ":") {
        throw new Error("Expected colon after key");
    }
    var afterColon = advance(afterKey); // Skip colon
    var _b = parseTerm(afterColon), afterValue = _b.state, value = _b.value;
    return {
        state: afterValue,
        value: { key: key.toLowerCase(), value: value },
    };
};
var parseToken = function (state) {
    var savedState = state;
    // Try to parse as a key-value pair
    try {
        var result = parseKeyValuePair(state);
        return {
            state: result.state,
            value: result.value,
        };
    }
    catch (e) {
        // Reset state if parsing as key-value pair fails
        state = savedState;
    }
    // Try to parse as a search term
    try {
        var result = parseTerm(state);
        return {
            state: result.state,
            value: result.value,
        };
    }
    catch (e) {
        throw new Error("Failed to parse token");
    }
};
// Main parser
var parseSearchQuery = function (input) {
    try {
        var state = makeState(input);
        var searchTerms = [];
        var fields = {};
        state = skipWhitespace(state);
        while (!atEnd(state)) {
            // Try to parse a token (either field-value pair or search term)
            try {
                var result = parseToken(state);
                if (typeof result.value === "object" && "key" in result.value) {
                    // It's a KeyValuePair
                    fields[result.value.key] = result.value.value;
                }
                else {
                    // It's a search term
                    searchTerms.push(result.value);
                }
                state = skipWhitespace(result.state);
            }
            catch (e) {
                // If we can't parse a token, break
                break;
            }
        }
        return {
            searchTerms: searchTerms,
            fields: fields,
        };
    }
    catch (error) {
        if (error instanceof Error) {
            throw new Error("Parse error: ".concat(error.message));
        }
        throw error;
    }
};
exports.parseSearchQuery = parseSearchQuery;
// Example usage with test queries
var test_queries = [
    '"red shoes" category:clothing size:10 color:red brand:nike',
    "red shoes category:clothing size:10 color:red brand:nike",
    "comfortable red shoes category:clothing size:10",
    'category:clothing "red winter shoes" warm cozy',
    '"quoted term" another term yet:another',
];
for (var _i = 0, test_queries_1 = test_queries; _i < test_queries_1.length; _i++) {
    var query = test_queries_1[_i];
    console.log("\nParsing query:", query);
    try {
        var result = parseSearchQuery(query);
        console.log("Search terms:", result.searchTerms);
        console.log("Fields:");
        for (var _a = 0, _b = Object.entries(result.fields); _a < _b.length; _a++) {
            var _c = _b[_a], key = _c[0], value = _c[1];
            console.log("  ".concat(key, ": ").concat(value));
        }
    }
    catch (error) {
        if (error instanceof Error) {
            console.error("Error parsing query:", error.message);
        }
    }
}
