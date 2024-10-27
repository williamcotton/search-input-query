#!/usr/bin/env python
from ply import lex, yacc
from typing import Dict, List, NamedTuple, Optional, Union
from dataclasses import dataclass

# AST type definitions
@dataclass
class Term:
    value: str

@dataclass
class Field:
    key: str
    value: str

@dataclass
class And:
    left: 'Expression'
    right: 'Expression'

@dataclass
class Or:
    left: 'Expression'
    right: 'Expression'

# Expression can be any of our AST node types
Expression = Union[Term, Field, And, Or]

class SearchQuery(NamedTuple):
    expression: Optional[Expression]
    fields: Dict[str, str]

# Lexer rules
tokens = (
    'QUOTED_STRING',
    'WORD',
    'COLON',
    'LPAREN',
    'RPAREN',
    'AND',
    'OR'
)

# Simple tokens
t_COLON = r':'
t_LPAREN = r'\('
t_RPAREN = r'\)'

# Ignore whitespace
t_ignore = ' \t\n'

# Complex tokens
def t_QUOTED_STRING(t):
    r'"([^"\\]|\\.)*"'
    # Remove quotes and handle escaped characters
    t_value = t.value[1:-1].replace(r'\"', '"').replace(r'\\', '\\')
    t.value = t_value
    return t

def t_AND(t):
    r'AND(?=[\s()])'  # Only match AND when followed by whitespace or parentheses
    return t

def t_OR(t):
    r'OR(?=[\s()])'  # Only match OR when followed by whitespace or parentheses
    return t

def t_WORD(t):
    r'[^\s"():]+' # Anything not whitespace, quotes, parens, or colon
    # Check if this might be an AND/OR operator
    if t.value == 'AND' or t.value == 'OR':
        t.type = t.value
    return t

def t_error(t):
    print(f"Illegal character '{t.value[0]}'")
    t.lexer.skip(1)

# Parser rules with precedence
precedence = (
    ('left', 'OR'),
    ('left', 'AND'),
)

def p_start(p):
    '''
    start : query
    '''
    p[0] = p[1]

def p_query(p):
    '''
    query : token_list
    '''
    tokens = p[1]
    fields = {}
    non_field_exprs = []

    # Separate fields from other expressions
    for token in tokens:
        if isinstance(token, Field):
            fields[token.key] = token.value
        else:
            non_field_exprs.append(token)

    # Combine non-field expressions with AND if there are multiple
    main_expr = None
    if non_field_exprs:
        main_expr = non_field_exprs[0]
        for expr in non_field_exprs[1:]:
            main_expr = And(main_expr, expr)

    p[0] = SearchQuery(expression=main_expr, fields=fields)

def p_token_list(p):
    '''
    token_list : token
               | token_list token
    '''
    if len(p) == 2:
        p[0] = [p[1]]
    else:
        p[0] = p[1] + [p[2]]

def p_token(p):
    '''
    token : expression
          | field_value
    '''
    p[0] = p[1]

def p_expression(p):
    '''
    expression : primary
               | expression AND expression
               | expression OR expression
    '''
    if len(p) == 2:
        p[0] = p[1]
    elif p[2] == 'AND':
        p[0] = And(p[1], p[3])
    else:  # OR
        p[0] = Or(p[1], p[3])

def p_primary(p):
    '''
    primary : QUOTED_STRING
           | WORD
           | LPAREN expression RPAREN
    '''
    if len(p) == 2:
        p[0] = Term(p[1])
    else:
        p[0] = p[2]

def p_field_value(p):
    '''
    field_value : WORD COLON value
    '''
    p[0] = Field(p[1].lower(), p[3])

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

# Helper function to stringify expressions
def stringify(expr: Expression) -> str:
    if isinstance(expr, Term):
        # Quote strings containing spaces
        return f'"{expr.value}"' if ' ' in expr.value else expr.value
    elif isinstance(expr, Field):
        return f"{expr.key}:{expr.value}"
    elif isinstance(expr, And):
        return f"({stringify(expr.left)} AND {stringify(expr.right)})"
    elif isinstance(expr, Or):
        return f"({stringify(expr.left)} OR {stringify(expr.right)})"
    else:
        raise ValueError(f"Unknown expression type: {type(expr)}")

def parse_search_query(query: str) -> SearchQuery:
    """
    Parse a search query string into a SearchQuery object.
    
    Args:
        query: The search query string to parse
        
    Returns:
        SearchQuery object containing the main expression and fields
        
    Raises:
        Exception: If parsing fails
    """
    lexer = lex.lex()
    parser = yacc.yacc()
    return parser.parse(query, lexer=lexer)

def main():
    # Test queries
    test_queries = [
        '("red shoes" OR ((blue OR purple) AND sneakers)) size:10 category:footwear',
        'comfortable AND (leather OR suede) brand:nike',
        '(winter OR summer) AND boots size:8',
        '(size:8 AND brand:nike)'
    ]

    for query in test_queries:
        print(f"\nParsing query: {query}")
        try:
            result = parse_search_query(query)
            if result.expression:
                print(f"Parsed expression: {stringify(result.expression)}")
            print("Fields:")
            for key, value in result.fields.items():
                print(f"  {key}: {value}")
        except Exception as e:
            print(f"Error parsing query: {str(e)}")

if __name__ == '__main__':
    main()