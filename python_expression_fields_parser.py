#!/usr/bin/env python
from ply import lex, yacc
from typing import Dict, List, NamedTuple, Optional, Union
from dataclasses import dataclass

# AST type definitions
@dataclass
class Term:
    value: str

@dataclass
class And:
    left: 'Expression'
    right: 'Expression'

@dataclass
class Or:
    left: 'Expression'
    right: 'Expression'

@dataclass
class Field:
    key: str
    value: str

# Expression can be any of our AST node types
Expression = Union[Term, And, Or, Field]

class SearchQuery(NamedTuple):
    expression: Optional[Expression]

# Lexer rules
tokens = (
    'QUOTED_STRING',
    'UNQUOTED_STRING',
    'LPAREN',
    'RPAREN',
    'AND',
    'OR',
    'COLON',
)

# Simple tokens
t_LPAREN = r'\('
t_RPAREN = r'\)'
t_COLON = r':'

t_ignore = ' \t\n\r'  # whitespace

def t_QUOTED_STRING(t):
    r'"([^"\\]|\\.)*"'
    t.value = t.value[1:-1].replace(r'\"', '"').replace(r'\\', '\\')
    return t

def t_AND(t):
    r'AND(?=[\s()])'
    return t

def t_OR(t):
    r'OR(?=[\s()])'
    return t

def t_UNQUOTED_STRING(t):
    r'[^\s"():]+' 
    if t.value in ('AND', 'OR'):
        t.type = t.value
    return t

def t_error(t):
    print(f"Illegal character '{t.value[0]}'")
    # t.lexer.skip(1)

# Parser rules
precedence = (
    ('right', 'OR'),
    ('right', 'AND'),
)

def p_search_query(p):
    '''
    search_query : expression
                 | empty
    '''
    p[0] = SearchQuery(expression=p[1])

def p_empty(p):
    '''
    empty :
    '''
    p[0] = None

def p_expression(p):
    '''
    expression : primary
               | expression AND expression
               | expression OR expression
    '''
    if len(p) == 2:
        p[0] = p[1]
    elif p[2] == 'AND':
        p[0] = And(left=p[1], right=p[3])
    else:  # OR
        p[0] = Or(left=p[1], right=p[3])

def p_primary(p):
    '''
    primary : term
            | field_value
            | LPAREN expression RPAREN
            | primary primary
    '''
    if len(p) == 2:
        p[0] = p[1]
    elif len(p) == 3:
        # Implicit AND between adjacent terms
        p[0] = And(left=p[1], right=p[2])
    else:
        p[0] = p[2]  # For parenthesized expressions

def p_term(p):
    '''
    term : QUOTED_STRING
         | UNQUOTED_STRING
    '''
    p[0] = Term(value=p[1])

def p_field_value(p):
    '''
    field_value : field_name COLON field_content
    '''
    p[0] = Field(key=p[1].lower(), value=p[3])

def p_field_name(p):
    '''
    field_name : UNQUOTED_STRING
    '''
    p[0] = p[1]

def p_field_content(p):
    '''
    field_content : QUOTED_STRING
                  | UNQUOTED_STRING
    '''
    p[0] = p[1]

def p_error(p):
    if p:
        print(f"Syntax error at '{p.value}'")
    else:
        print("Syntax error at EOF")

def stringify(expr: Expression) -> str:
    """Convert expression back to string form."""
    if isinstance(expr, Term):
        return f'"{expr.value}"' if ' ' in expr.value else expr.value
    elif isinstance(expr, And):
        return f"({stringify(expr.left)} AND {stringify(expr.right)})"
    elif isinstance(expr, Or):
        return f"({stringify(expr.left)} OR {stringify(expr.right)})"
    elif isinstance(expr, Field):
        value = f'"{expr.value}"' if ' ' in expr.value else expr.value
        return f"{expr.key}:{value}"
    else:
        raise ValueError(f"Unknown expression type: {type(expr)}")

def parse_search_query(query: str) -> SearchQuery:
    """
    Parse a search query string into a SearchQuery object.
    
    Args:
        query: The search query string to parse
    Returns:
        SearchQuery object containing the parsed expression
    Raises:
        Exception: If parsing fails
    """
    lexer = lex.lex()
    parser = yacc.yacc()
    return parser.parse(query, lexer=lexer)

def main():
    # Test queries
    test_queries = [
        '"red shoes" OR ((blue OR purple) AND sneakers)',
        'comfortable AND (leather OR suede)',
        '(winter OR summer) AND boots',
        'boots summer',
        'color:red AND size:large',
        'category:"winter boots" AND (color:black OR color:brown)',
        'winter boots color:blue',
        'red boots black',
        'red (boots black)',
        'AND:value',
        'OR:test',
        'brand:"Nike\\Air"',
        'brand:"Nike\"Air"',
        'brand:"Nike\\"Air"',
        'field: value',
        'field :value',
        'field : value',
        'a AND b OR c',
        'a OR b AND c',
        'a OR b OR c AND d',
        '',
        '()',
        'field:',
        ':value',
        '(a OR b) c d',
        'a AND (b OR c) AND d',
        '((a AND b) OR c) AND d',
        'status:"pending review"',
        'category:pending review',
        'size:large color:red status:available',
        'category:"winter boots" AND (color:black OR color:brown) AND size:12'
    ]
        
    for query in test_queries:
        print(f"\nParsing query: {query}")
        try:
            result = parse_search_query(query)
            print(result)
            if result.expression:
                print(f"Parsed expression: {stringify(result.expression)}")
        except Exception as e:
            print(f"Error parsing query: {str(e)}")

if __name__ == '__main__':
    main()