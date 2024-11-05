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

<field> ::= <identifier>

<value> ::= <string-literal>
          | <quoted-string>

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
```

## Lexical Rules

1. Whitespace between tokens is ignored except when it creates an implicit AND
2. Reserved words (case-sensitive):
   - "AND"
   - "OR"
   - "NOT"
3. Special characters:
   - Parentheses: ( )
   - Quote: "
   - Colon: :
   - Minus: -
   - Backslash: \ (for escaping in quoted strings)

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
```

Invalid expressions:
```
AND boots                     /* operator at start */
boots AND                     /* operator at end */
boots AND AND leather        /* consecutive operators */
:value                       /* missing field name */
field:                       /* missing value */
@field:value                /* invalid character in field */
```