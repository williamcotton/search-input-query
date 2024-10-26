#!/usr/bin/env python
from ply import lex, yacc
from typing import Dict, Optional, NamedTuple

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
def p_query(p):
    '''
    query : terms fields
         | terms
         | fields
    '''
    if len(p) == 3:
        p[0] = SearchQuery(search_term=p[1], fields=p[2])
    elif len(p) == 2 and isinstance(p[1], dict):
        p[0] = SearchQuery(search_term=None, fields=p[1])
    else:
        p[0] = SearchQuery(search_term=p[1], fields={})

def p_terms(p):
    '''
    terms : QUOTED_STRING
         | unquoted_terms
    '''
    p[0] = p[1]

def p_unquoted_terms(p):
    '''
    unquoted_terms : WORD
                  | unquoted_terms WHITESPACE WORD
    '''
    if len(p) == 2:
        p[0] = p[1]
    else:
        p[0] = p[1] + ' ' + p[3]

def p_fields(p):
    '''
    fields : field
          | fields WHITESPACE field
    '''
    if len(p) == 2:
        p[0] = p[1]
    else:
        p[1].update(p[3])
        p[0] = p[1]

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
parser = yacc.yacc(debug=False)

def split_query(query: str):
    """Split query into search terms and field terms."""
    tokens = []
    current_pos = 0
    in_quotes = False
    field_start = None
    
    while current_pos < len(query):
        if query[current_pos] == '"':
            in_quotes = not in_quotes
            if not in_quotes:  # End of quoted string
                tokens.append(query[field_start:current_pos + 1])
                field_start = None
            else:  # Start of quoted string
                field_start = current_pos
        elif in_quotes:
            pass  # Keep collecting quoted string
        elif query[current_pos].isspace():
            if field_start is not None:
                tokens.append(query[field_start:current_pos])
                field_start = None
        elif field_start is None:
            field_start = current_pos
        current_pos += 1
    
    if field_start is not None:
        tokens.append(query[field_start:])
    
    # Separate search terms and fields
    search_terms = []
    field_terms = []
    
    for token in tokens:
        if ':' in token and not token.startswith('"'):
            field_terms.append(token)
        else:
            search_terms.append(token)
    
    return ' '.join(search_terms), ' '.join(field_terms)

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
    search_part, fields_part = split_query(query)
    
    # Initialize results
    search_term = None
    fields = {}
    
    # Parse search term
    if search_part:
        if search_part.startswith('"') and search_part.endswith('"'):
            search_term = search_part[1:-1]
        else:
            search_term = search_part.strip()
    
    # Parse fields
    if fields_part:
        field_tokens = fields_part.split()
        i = 0
        while i < len(field_tokens):
            if ':' in field_tokens[i]:
                key, value = field_tokens[i].split(':', 1)
                fields[key.lower()] = value
            i += 1
    
    return SearchQuery(search_term=search_term, fields=fields)

def main():
    # Example usage with both quoted and unquoted terms
    test_queries = [
        '"red shoes" category:clothing size:10 color:red brand:nike',
        'red shoes category:clothing size:10 color:red brand:nike',
        'comfortable red shoes category:clothing size:10'
    ]
    
    for query in test_queries:
        print(f"\nParsing query: {query}")
        try:
            result = parse_search_query(query)
            print(f"Search term: {result.search_term}")
            print("Fields:")
            for key, value in result.fields.items():
                print(f"  {key}: {value}")
        except Exception as e:
            print(f"Error parsing query: {e}")

if __name__ == '__main__':
    main()