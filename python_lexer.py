#!/usr/bin/env python
from ply import lex

# Define the list of token names
tokens = (
    'TERM',
)

# Regular expression rule for TERM
def t_TERM(t):
    r'[^\s]+'  # Match any non-whitespace characters
    return t

# Ignore whitespace
t_ignore = ' \t\n'

# Error handling
def t_error(t):
    print(f"Illegal character '{t.value[0]}'")
    t.lexer.skip(1)

# Build the lexer
lexer = lex.lex()

def tokenize(text):
    """
    Tokenize input text and print each token.
    
    Args:
        text: String to tokenize
    """
    print(f"\nTokenizing: {text!r}")
    
    # Give the lexer our input text
    lexer.input(text)
    
    # Print token information
    while True:
        tok = lexer.token()
        if not tok:
            break
        # Print detailed token information
        print(f"Token(type={tok.type!r}, value={tok.value!r}, lineno={tok.lineno}, lexpos={tok.lexpos})")

def main():
    # Test various inputs
    test_inputs = [
        "red shoes",
        "   spaced   out   terms   ",
        "single",
        "line1\nline2\n  line3",
        "mixed.punctuation!and@symbols#here",
        "",  # Empty string
        "   ",  # Just whitespace
    ]
    
    for text in test_inputs:
        tokenize(text)

if __name__ == '__main__':
    main()