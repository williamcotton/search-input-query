#!/usr/bin/env python

from ply import lex, yacc

# Lexer
tokens = (
    'TERM',
)

t_TERM = r'[^\s]+'

# Ignore whitespace
t_ignore = ' \t\n'

def t_error(t):
    print(f"Illegal character '{t.value[0]}'")
    t.lexer.skip(1)

# Parser
def p_search_query(p):
    '''
    search_query : search_terms
    '''
    p[0] = p[1]

def p_search_terms(p):
    '''
      search_terms : search_terms TERM
                   | TERM
    '''
    if len(p) == 2:
      p[0] = [p[1]]
    else:
      p[0] = p[1] + [p[2]]

def p_error(p):
    if p:
        print(f"Syntax error at '{p.value}'")
    else:
        print("Syntax error at EOF")

# Build the lexer and parser
lexer = lex.lex()
parser = yacc.yacc()

if __name__ == "__main__":
    # Example usage
    test_input = "   one    two    three    "
    result = parser.parse(test_input)
    print(f"Result: {result}")