# Search Query Grammar

## Syntax Rules

```bnf
<query> ::= <expression> | ε

<expression> ::= <and-expression>

<and-expression> ::= <or-expression>
                  | <and-expression> "AND" <or-expression>
                  | <and-expression> <or-expression>  /* implicit AND */

<or-expression> ::= <not-expression>
                 | <or-expression> "OR" <not-expression>

<not-expression> ::= <primary>
                  | "NOT" <primary>
                  | "-" <primary>

<primary> ::= <term>
           | "(" <expression> ")"

<term> ::= <field-value>
         | <string-literal>

<field-value> ::= <field> ":" <value>
                | <field> ":" <range-expression>

<field> ::= <identifier>

<value> ::= <string-literal>
          | <quoted-string>

<range-expression> ::= <range-operator> <numeric-value>
                    | <numeric-value> ".." <numeric-value>
                    | <numeric-value> ".."
                    | ".." <numeric-value>
                    | <range-operator> <date-value>
                    | <date-value> ".." <date-value>
                    | <date-value> ".."
                    | ".." <date-value>

<range-operator> ::= ">" | ">=" | "<" | "<="

<numeric-value> ::= ["-"] <digits> ["." <digits>]

<date-value> ::= <year> "-" <month> "-" <day>

<year> ::= <digit> <digit> <digit> <digit>
<month> ::= <digit> <digit>
<day> ::= <digit> <digit>

<string-literal> ::= <chars-without-special>

<quoted-string> ::= '"' <chars-with-escaped> '"'

<identifier> ::= <letter> (<letter> | <digit> | "_" | "-")*

<chars-without-special> ::= <char-no-special>+

<chars-with-escaped> ::= (<char-escaped> | <char-no-quote>)*

<char-no-special> ::= /* any character except whitespace, quotes, parentheses, and colon */

<char-no-quote> ::= /* any character except quote */

<char-escaped> ::= "\" <any-char>

<letter> ::= [a-zA-Z]

<digit> ::= [0-9]
<digits> ::= <digit>+
```

## Field Types

Fields can be defined with the following types:
- `string`: Text values with case-insensitive matching
- `number`: Numeric values supporting integers and decimals
- `date`: Date values in YYYY-MM-DD format
- `boolean`: Boolean values (true/false)

## Lexical Rules

1. Whitespace between tokens is ignored except when it creates an implicit AND
2. Reserved words (case-insensitive):
   - "AND"
   - "OR"
   - "NOT"
3. Special characters:
   - Parentheses: ( )
   - Quote: "
   - Colon: :
   - Minus: - (for negation)
   - Backslash: \ (for escaping in quoted strings)
   - Double dots: .. (for range expressions)

## Examples

Valid expressions:
```
boots                           /* simple term */
"red shoes"                     /* quoted string */
color:red                       /* field:value */
color:"dark blue"              /* field:quoted-value */
boots AND leather              /* explicit AND */
boots leather                  /* implicit AND */
boots OR sneakers             /* OR operation */
-leather                      /* negation with minus */
NOT leather                   /* negation with NOT */
(boots OR sneakers) AND red   /* grouped expression */

/* Range queries */
price:>100                    /* greater than */
price:>=100                   /* greater than or equal */
price:<50                     /* less than */
price:<=50                    /* less than or equal */
price:10..20                  /* between range (inclusive) */
price:10..                    /* greater than or equal */
price:..20                    /* less than or equal */
amount:50.99..100.50         /* decimal range */
amount:-10..10               /* range with negative numbers */

/* Date ranges */
date:2024-01-01              /* exact date match */
date:>2024-01-01             /* after date */
date:2024-01-01..2024-12-31  /* date range */
date:2024-01-01..            /* after date (inclusive) */
date:..2024-12-31            /* before date (inclusive) */

/* Complex queries */
category:"winter boots" AND (color:black OR color:brown)
price:>100 AND amount:<50
(status:active OR status:pending) AND date:>=2024-01-01
```

Invalid expressions:
```
AND boots                     /* operator at start */
boots AND                     /* operator at end */
boots AND AND leather        /* consecutive operators */
:value                       /* missing field name */
field:                       /* missing value */
@field:value                /* invalid character in field */
price:>=>100                /* invalid range operator */
price:...                   /* invalid range format */
date:not-a-date            /* invalid date format */
price:abc..def             /* invalid numeric range */
```