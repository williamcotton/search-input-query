#!/usr/bin/env dotnet fsi
#r "nuget: FParsec"
open FParsec

// Define the types
type SearchQuery =
    { SearchTerms: string list }

// Parser for search terms
let searchTerm =
    many1Chars (noneOf " ")

// Main parser
let searchParser : Parser<SearchQuery, unit> =
    many (searchTerm .>> spaces) |>> fun searchTerms ->
        {
            SearchTerms = searchTerms
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

testParser "red shoes"
testParser "comfortable red shoes"
