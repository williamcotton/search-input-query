#!/usr/bin/env python
from ply import lex, yacc
from typing import Union, List, Any

# Define the types for our AST
Expression = Union[str, List[Any]]  # Can be either an atom (str) or a list of expressions

# Lexer rules
tokens = (
    'ATOM',
    'LPAREN',
    'RPAREN',
)

t_LPAREN = r'\('
t_RPAREN = r'\)'

# Atom is anything that's not whitespace or parentheses
def t_ATOM(t):
    r'[^\s())]+'
    return t

# Ignore whitespace
t_ignore = ' \t\n'

# Error handling
def t_error(t):
    print(f"Illegal character '{t.value[0]}'")
    t.lexer.skip(1)

# Parser rules
def p_expression(p):
    '''
    expression : atom
               | list
    '''
    p[0] = p[1]

def p_atom(p):
    '''
    atom : ATOM
    '''
    p[0] = p[1]

def p_list(p):
    '''
    list : LPAREN expressions RPAREN
    '''
    p[0] = p[2]

def p_expressions(p):
    '''
    expressions : expression expressions
                | empty
    '''
    if len(p) == 3:
        if p[2] is None:  # If expressions is empty
            p[0] = [p[1]]
        else:
            p[0] = [p[1]] + p[2]
    else:
        p[0] = []

def p_empty(p):
    '''
    empty :
    '''
    p[0] = None

def p_error(p):
    if p:
        print(f"Syntax error at '{p.value}'")
    else:
        print("Syntax error at EOF")

# Build the lexer and parser
lexer = lex.lex()
parser = yacc.yacc()

def parse(input_str: str) -> Expression:
    """
    Parse a string containing nested parentheses expressions.
    
    Args:
        input_str: The input string to parse
        
    Returns:
        The parsed expression (either an atom or a list of expressions)
        
    Raises:
        Exception: If parsing fails
    """
    return parser.parse(input_str)

def stringify(expr: Expression) -> str:
    """
    Convert a parsed expression back to a string representation.
    
    Args:
        expr: The expression to stringify
        
    Returns:
        String representation of the expression
    """
    if isinstance(expr, list):
        return f"({' '.join(stringify(e) for e in expr)})"
    return str(expr)

def main():
    # Example usage with test cases
    test_cases = [
        "((one) two three)",
        "((a b) (c d) e)",
        "(a)",
        "((a (b c)) d)",
        "(((deeply) nested) parens)",
    ]

    for test_input in test_cases:
        print(f"\nInput: {test_input}")
        try:
            result = parse(test_input)
            print(f"Parsed: {result}")
            print(f"Stringified: {stringify(result)}")
        except Exception as e:
            print(f"Error parsing: {str(e)}")

if __name__ == '__main__':
    main()