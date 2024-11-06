#!/usr/bin/env dotnet fsi
#r "nuget: FParsec"
open FParsec

// AST types
type Expression =
    | Term of string
    | And of Expression * Expression
    | Or of Expression * Expression

type SearchQuery = {
    Expression: Expression option
}

// Forward declare expression parser for recursive use
let expr, exprImpl = createParserForwardedToRef()

// Parse a quoted string - handles escaped quotes
let quotedString = 
    between 
        (pchar '"') 
        (pchar '"')
        (manyChars (noneOf "\"" <|> (pstring "\\\"" >>% '"')))

// Parse a word (unquoted string - stops at whitespace, quotes, parens, or standalone AND/OR)
let unquotedString = 
    many1Chars (noneOf " \"()")

// Parse a term (either quoted or unquoted)
let term = 
    (quotedString <|> unquotedString) |>> Term


// Parse logical operators with proper precedence
let opp = new OperatorPrecedenceParser<Expression, unit, unit>()

let addInfixOperator str precedence associativity f =
    opp.AddOperator(
        InfixOperator(str, spaces, precedence, associativity, f)
    )

// Setup operator precedence
do
    addInfixOperator "AND" 2 Associativity.Left (fun x y -> And(x, y))
    addInfixOperator "OR" 1 Associativity.Left (fun x y -> Or(x, y))

// Parse a primary expression (term, field:value, or parenthesized expression)
let primaryExpr =
    (between (pchar '(' .>> spaces) (pchar ')') expr)
    <|> term
    .>> spaces

// Implement the expression parser
do exprImpl.Value <- opp.ExpressionParser .>> spaces
opp.TermParser <- primaryExpr

// Main parser for the full search query
let searchParser =
    spaces >>. many expr .>> spaces .>> eof
    |>> fun exprs ->
        let mainExpr =
            match exprs with
            | [] -> None
            | [single] -> Some single
            | multiple -> 
                Some(multiple |> List.reduce (fun left right -> Or(left, right)))
            
        { Expression = mainExpr; }

// Helper function to stringify expressions
let rec stringify = function
    | Term value -> 
        if value.Contains(" ") then sprintf "\"%s\"" value
        else value
    | And(left, right) -> sprintf "(%s AND %s)" (stringify left) (stringify right)
    | Or(left, right) -> sprintf "(%s OR %s)" (stringify left) (stringify right)

// Function to run the parser
let parseSearchQuery (input: string) =
    run searchParser input

// Test function
let testParser input =
    printfn "\nParsing query: %s" input
    match parseSearchQuery input with
    | Success (result, _, _) ->
        match result.Expression with
        | Some expr -> printfn "Parsed expression: %s" (stringify expr)
        | None -> printfn "No main expression"
    | Failure (msg, _, _) ->
        printfn "Error: %s" msg
    printfn ""

// Run test cases
let testCases = [
    "\"red shoes\" OR ((blue OR purple) AND sneakers)"
    "comfortable AND (leather OR suede)"
    "(winter OR summer) AND boots"
    "boots summer"
]

testCases |> List.iter testParser