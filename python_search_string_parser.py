#!/usr/bin/env python

from ply import lex, yacc
from typing import Dict, Optional, NamedTuple
import sys

class SearchQuery(NamedTuple):
    search_term: Optional[str]
    fields: Dict[str, str]

# Lexer
tokens = (
    'QUOTED_STRING',
    'WORD',
    'COLON',
    'WHITESPACE'
)

def t_QUOTED_STRING(t):
    r'"([^"\\]|\\.)*"'
    # Remove quotes and handle escaped characters
    t.value = t.value[1:-1].replace('\\"', '"')
    return t

def t_WORD(t):
    r'[a-zA-Z0-9_-]+'
    return t

t_COLON = r':'
t_WHITESPACE = r'\s+'

def t_error(t):
    print(f"Illegal character '{t.value[0]}'")
    t.lexer.skip(1)

# Parser
def p_search_query(p):
    '''
    search_query : search_term field_list
                | field_list
    '''
    if len(p) == 3:
        p[0] = SearchQuery(search_term=p[1], fields=p[2])
    else:
        p[0] = SearchQuery(search_term=None, fields=p[1])

def p_search_term(p):
    '''
    search_term : QUOTED_STRING WHITESPACE
                | QUOTED_STRING
    '''
    p[0] = p[1]

def p_field_list(p):
    '''
    field_list : field_list WHITESPACE field
               | field
               |
    '''
    if len(p) == 4:
        p[1].update(p[3])
        p[0] = p[1]
    elif len(p) == 2:
        p[0] = p[1]
    else:
        p[0] = {}

def p_field(p):
    '''
    field : WORD COLON WORD
    '''
    p[0] = {p[1].lower(): p[3]}

def p_error(p):
    if p:
        print(f"Syntax error at '{p.value}'")
    else:
        print("Syntax error at EOF")

# Build lexer and parser
lexer = lex.lex()
parser = yacc.yacc()

def parse_search_query(query: str) -> SearchQuery:
    """
    Parse a search query string into a SearchQuery object.
    
    Args:
        query: The search query string to parse
        
    Returns:
        SearchQuery object containing the search term and fields
        
    Raises:
        Exception: If parsing fails
    """
    result = parser.parse(query, lexer=lexer)
    return result

def main():
    # Example usage
    test_query = '"red shoes" category:clothing size:10 color:red brand:nike'
    try:
        result = parse_search_query(test_query)
        print(f"Search term: {result.search_term}")
        print("Fields:")
        for key, value in result.fields.items():
            print(f"  {key}: {value}")
    except Exception as e:
        print(f"Error parsing query: {e}")

if __name__ == '__main__':
    main()