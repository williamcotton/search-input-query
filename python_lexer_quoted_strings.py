#!/usr/bin/env python
from ply import lex

# Define the list of token names
tokens = (
    'QUOTED_STRING',
    'TERM',
)

# Regular expression rule for quoted strings
def t_QUOTED_STRING(t):
    r'"([^"\\]|\\.)*"'  # Match quoted strings with escaped characters
    # Remove quotes and handle escaped characters
    t.value = t.value[1:-1].replace(r'\"', '"').replace(r'\\', '\\')
    return t

# Regular expression rule for TERM - note we exclude quotes now
def t_TERM(t):
    r'[^\s"]+' # Match any non-whitespace, non-quote characters
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
    # Test various inputs demonstrating quoted and unquoted terms
    test_inputs = [
        'red shoes',  # Basic unquoted terms
        '"red shoes"',  # Simple quoted string
        'find "red shoes" here',  # Mix of quoted and unquoted
        '"escaped \\"quotes\\" here"',  # Escaped quotes
        '"multi-word string" followed by terms',  # Mixed
        'term "quoted" term',  # Term-quote-term
        'missing"quote',  # No space before quote
        '"unterminated quote',  # Error case
        'multiple "quoted" "strings" here',  # Multiple quotes
        '"" empty',  # Empty quotes
        '"spaces  inside  quotes"',  # Space preservation in quotes
        'term1"adjacent"term2',  # No spaces around quotes
        '"special chars !@#$%^&*()"',  # Special characters in quotes
        '"\\"starts with quote"',  # Escaped quote at start
        '"ends with quote\\""',  # Escaped quote at end
    ]
    
    for text in test_inputs:
        try:
            tokenize(text)
        except Exception as e:
            print(f"Error processing input: {str(e)}")

if __name__ == '__main__':
    main()