#!/usr/bin/env dotnet fsi
#r "nuget: FParsec"
open FParsec

// Define Expression type for our AST
type Expression =
    | Atom of string
    | List of Expression list

// Helper to prettify the output
let rec prettyPrint = function
    | Atom s -> s
    | List exprs -> 
        let inner = exprs |> List.map prettyPrint |> String.concat " "
        $"({inner})"

// Forward reference for recursive expressions
let expr, exprImpl = createParserForwardedToRef()

// Parse an atom (anything that's not whitespace or parens)
let atom =
    many1Chars (noneOf " ()")
    |>> Atom

// Parse a list of expressions between parentheses
let list = 
    between
        (pchar '(' .>> spaces)
        (spaces >>. pchar ')') // Consume optional spaces before ')'
        (sepEndBy expr spaces) // Use sepEndBy to handle spaces between expressions
    |>> List

// Implementation of the expression parser
do exprImpl.Value <- (list <|> atom)

// Main entry point parser - handles whitespace and EOF
let parseExpr =
    spaces >>. expr .>> spaces .>> eof

// Function to run the parser
let parseExpression input =
    run parseExpr input

// Test function with error handling
let testParse input =
    printfn "\nParsing: %s" input
    match parseExpression input with
    | Success (result, _, _) ->
        printfn "Parsed: %A" result
        printfn "Pretty printed: %s" (prettyPrint result)
    | Failure (msg, _, _) ->
        printfn "Error: %s" msg

// Example usage with test cases
let main() =
    let testCases = [
        "((one) two three)"
        "((a b) (c d) e)"
        "(a)"
        "((a (b c)) d)"
        "(((deeply) nested) parens)"
    ]
    
    for test in testCases do
        testParse test

// Run the main function
main()
