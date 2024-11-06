#!/usr/bin/env python
from ply import lex, yacc
from typing import Dict, List, NamedTuple

class SearchQuery(NamedTuple):
    search_terms: List[str]

# Lexer
tokens = (
    'TERM',
)

def t_TERM(t):
    r'[^\s]+'
    return t

t_ignore = ' \t'

def t_newline(t):
    r'\n+'
    pass  # Ignore newlines (if any)

def t_error(t):
    print(f"Illegal character '{t.value[0]}'")
    t.lexer.skip(1)

# Parser
def p_query(p):
    '''
    string : terms
    '''
    p[0] = SearchQuery(search_terms=p[1])

def p_terms(p):
    '''
    terms : TERM
          | terms TERM
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

# Build lexer and parser
lexer = lex.lex()
parser = yacc.yacc(debug=False)

def parse_string(query: str) -> SearchQuery:
    """
    Parse a search query string into a SearchQuery object.

    Args:
        query: The search query string to parse

    Returns:
        SearchQuery object containing search terms 

    Raises:
        Exception: If parsing fails
    """
    result = parser.parse(query)
    return result

def main():
    # Example usage with both quoted and unquoted terms
    test_queries = [
        'red shoes',
        'comfortable red shoes'
    ]

    for query in test_queries:
        print(f"\nParsing query: {query}")
        try:
            result = parse_string(query)
            print(f"Search terms: {result.search_terms}")
        except Exception as e:
            print(f"Error parsing query: {e}")

if __name__ == '__main__':
    main()
