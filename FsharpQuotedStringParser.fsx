#!/usr/bin/env dotnet fsi
#r "nuget: FParsec"
open FParsec

// Define the types
type SearchQuery =
    { SearchTerms: string list }

// Parser for quoted string - handles escaped quotes
let quotedString = 
    between 
        (pchar '"') 
        (pchar '"')
        (manyChars (noneOf "\"" <|> (pstring "\\\"" >>% '"')))

// Parser for unquoted string (no spaces)
let unquotedString = 
    many1Chars (noneOf " ")

// Parser for search terms
let searchTerm =
    (quotedString <|> unquotedString)

// Main parser
let searchParser : Parser<SearchQuery, unit> =
    many (searchTerm .>> spaces) |>> fun terms ->
        let searchTerms =
            terms |> List.fold (fun (terms) term ->
                (term :: terms)
            ) []
        {
            SearchTerms = List.rev searchTerms
        }

// Function to run the parser
let parseSearchQuery (input: string) =
    run (spaces >>. searchParser .>> eof) input

// Test function
let testParser input =
    printfn "Parsing query: %s" input
    match parseSearchQuery input with
    | Success (result, _, _) ->
        printfn "Search terms: %A" result.SearchTerms
    | Failure (msg, _, _) ->
        printfn "Error: %s" msg
    printfn ""

testParser "\"red shoes\""
testParser "red shoes"
testParser "comfortable red shoes"
testParser "\"red winter shoes\" warm cozy"
