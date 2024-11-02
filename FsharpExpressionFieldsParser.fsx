#!/usr/bin/env dotnet fsi
#r "nuget: FParsec"
open FParsec

// AST types
type Expression =
    | Term of string
    | Field of string * string
    | And of Expression * Expression
    | Or of Expression * Expression

type SearchQuery = {
    Expression: Expression option
}

// Forward declare expression parser for recursive use
let expr, exprImpl = createParserForwardedToRef()

// Helper to handle escaped characters in quoted strings
let escapedChar = 
    pstring "\\" >>. 
    (choice [
        pchar '"' >>% '"'     // \" -> "
        pchar '\\' >>% '\\'   // \\ -> \
        anyChar               // \x -> x (treat escape as nothing for any other char)
    ])

// Parser for quoted string that correctly handles escaping
let quotedString = 
    between 
        (pchar '"') 
        (pchar '"')
        (manyChars (escapedChar <|> noneOf "\"\\"))


// Parse a word (unquoted string - stops at whitespace, quotes, parens, or standalone AND/OR)
let unquotedString =
    many1Chars (noneOf " \"():") 

// Parse a field:value pair
let fieldValue =
    pipe3 
        (many1Chars (noneOf " \"():") .>> spaces) 
        (pchar ':' >>. spaces)
        (quotedString <|> many1Chars (noneOf " \"()")) 
        (fun field _ value -> Field(field, value))

// Parse a term (either field:value, quoted string, or unquoted string)
let term =
    attempt fieldValue 
    <|> (quotedString |>> Term)
    <|> (unquotedString |>> Term)

// Parse logical operators with proper precedence
let opp = new OperatorPrecedenceParser<Expression, unit, unit>()

let addInfixOperator str precedence associativity f =
    opp.AddOperator(
        InfixOperator(str, spaces, precedence, associativity, f)
    )

// Setup operator precedence
do
    addInfixOperator "AND" 2 Associativity.Right (fun x y -> And(x, y))
    addInfixOperator "OR" 1 Associativity.Right (fun x y -> Or(x, y))

let rec combineWithAnd exprs =
    match exprs with
    | [] -> None
    | [single] -> Some single
    | multiple -> Some(multiple |> List.reduce (fun left right -> And(left, right)))

// Parse a sequence of expressions within parentheses or a single term
let primaryExpr =
    let parenExpr = 
        between 
            (pchar '(' .>> spaces) 
            (pchar ')') 
            (many1 (expr .>> spaces)
             |>> fun exprs -> 
                match combineWithAnd exprs with
                | Some expr -> expr
                | None -> failwith "Empty parentheses not allowed")
    
    (attempt parenExpr <|> term)
    .>> spaces

// Implement the expression parser
do exprImpl.Value <- opp.ExpressionParser .>> spaces
opp.TermParser <- primaryExpr

// Main parser for the full search query
let searchParser =
    spaces >>. many1 (expr .>> spaces) .>> eof
    |>> fun exprs ->
        { Expression = combineWithAnd exprs }

// Helper function to stringify expressions
let rec stringify = function
    | Term value ->
        if value.Contains(" ") then sprintf "\"%s\"" value
        else value
    | Field(field, value) ->
        sprintf "%s:%s" field value
    | And(left, right) -> 
        sprintf "(%s AND %s)" (stringify left) (stringify right)
    | Or(left, right) -> 
        sprintf "(%s OR %s)" (stringify left) (stringify right)

// Function to run the parser
let parseSearchQuery (input: string) =
    run searchParser input

// Test function
let testParser input =
    printfn "\nParsing query: %s" input
    match parseSearchQuery input with
    | Success (result, _, _) ->
        printfn "%A" result
        match result.Expression with
        | Some expr -> printfn "Parsed expression: %s" (stringify expr)
        | None -> printfn "No main expression"
    | Failure (msg, _, _) ->
        printfn "Error: %s" msg
    printfn ""

// Run test cases
let testQueries = [
    "\"red shoes\" OR ((blue OR purple) AND sneakers)"
    "comfortable AND (leather OR suede)"
    "(winter OR summer) AND boots"
    "boots summer"
    "color:red AND size:large"
    "category:\"winter boots\" AND (color:black OR color:brown)"
    "winter boots color:blue"
    "red boots black"
    "red (boots black)"
    "AND:value"
    "OR:test"
    "brand:\"Nike\\Air\""
    "brand:\"Nike\\\"Air\""
    "brand:\"Nike\\\\\"Air\""
    "field: value"
    "field :value"
    "field : value"
    "a AND b OR c"
    "a OR b AND c"
    "a OR b OR c AND d"
    ""
    "()"
    "field:"
    ":value"
    "(a OR b) c d"
    "a AND (b OR c) AND d"
    "((a AND b) OR c) AND d"
    "status:\"pending review\""
    "category:pending review"
    "size:large color:red status:available"
    "category:\"winter boots\" AND (color:black OR color:brown) AND size:12"
]

testQueries |> List.iter testParser