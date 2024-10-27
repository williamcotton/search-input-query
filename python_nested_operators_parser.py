#!/usr/bin/env python
from ply import lex, yacc
from typing import Dict, List, NamedTuple

class SearchQuery(NamedTuple):
    search_terms: List[str]
    fields: Dict[str, str]

# Lexer
tokens = (
    'QUOTED_STRING',
    'WORD',
    'COLON',
    'OPEN_PARENS',
    'CLOSE_PARENS',
    'AND',
    'OR',
    'NOT'
)

def t_QUOTED_STRING(t):
    r'"([^"\\]|\\.)*"'
    # Remove quotes and handle escaped characters
    t.value = t.value[1:-1].replace(r'\"', '"').replace(r'\\', '\\')
    return t

def t_WORD(t):
    r'[^\s":]+'
    return t

t_COLON = r':'

t_OPEN_PARENS = r'('

t_CLOSE_PARENS = r')'

t_AND = r'AND'

t_OR = r'OR'

t_NOT = r'NOT'

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
    query : tokens
    '''
    search_terms = []
    fields = {}
    for token in p[1]:
        if isinstance(token, dict):
            fields.update(token)
        else:
            search_terms.append(token)
    p[0] = SearchQuery(search_terms=search_terms, fields=fields)

def p_tokens(p):
    '''
    tokens : token
           | tokens token
    '''
    if len(p) == 2:
        p[0] = [p[1]]
    else:
        p[0] = p[1] + [p[2]]

def p_token(p):
    '''
    token : term
          | field
    '''
    p[0] = p[1]

def p_term(p):
    '''
    term : QUOTED_STRING
         | WORD
    '''
    p[0] = p[1]

def p_field(p):
    '''
    field : WORD COLON value
    '''
    key = p[1].lower()
    value = p[3]
    p[0] = {key: value}

def p_value(p):
    '''
    value : QUOTED_STRING
          | WORD
    '''
    p[0] = p[1]

def p_error(p):
    if p:
        print(f"Syntax error at '{p.value}'")
    else:
        print("Syntax error at EOF")

# Build lexer and parser
lexer = lex.lex()
parser = yacc.yacc(debug=False)

def parse_search_query(query: str) -> SearchQuery:
    """
    Parse a search query string into a SearchQuery object.

    Args:
        query: The search query string to parse

    Returns:
        SearchQuery object containing search terms and fields

    Raises:
        Exception: If parsing fails
    """
    result = parser.parse(query)
    return result

def main():
    # Example usage with both quoted and unquoted terms
    test_queries = [
        '"red shoes" category:clothing size:10 color:red brand:nike',
        'red shoes category:clothing size:10 color:red brand:nike',
        'comfortable red shoes category:clothing size:10',
        'category:clothing "red winter shoes" warm cozy',
        '"quoted term" another term yet:another'
    ]

    for query in test_queries:
        print(f"\nParsing query: {query}")
        try:
            result = parse_search_query(query)
            print(f"Search terms: {result.search_terms}")
            print("Fields:")
            for key, value in result.fields.items():
                print(f"  {key}: {value}")
        except Exception as e:
            print(f"Error parsing query: {e}")

if __name__ == '__main__':
    main()
