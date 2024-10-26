```
<query>       ::= <items>

<items>       ::= <item> { <item> }

<item>        ::= <term>
                | <field>

<term>        ::= <QUOTED_STRING>
                | <WORD>

<field>       ::= <WORD> ":" <value>

<value>       ::= <QUOTED_STRING>
                | <WORD>

<QUOTED_STRING> ::= '"' { <CHARACTER> | <ESCAPED_CHAR> } '"'

<ESCAPED_CHAR>  ::= '\' ( '"' | '\' )

<CHARACTER>      ::= any character except '"' or '\'

<WORD>        ::= { <WORD_CHAR> }+

<WORD_CHAR>   ::= any character except whitespace, '"', ':', or '\'
```