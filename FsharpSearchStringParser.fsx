#!/usr/bin/env dotnet fsi
#r "nuget: FParsec"
open FParsec

// Define the types
type SearchCriteria =
    { SearchTerms: string list
      Fields: Map<string, string> }

// Parser for quoted string - handles escaped quotes
let quotedString = 
    between 
        (pchar '"') 
        (pchar '"')
        (manyChars (noneOf "\"" <|> (pstring "\\\"" >>% '"')))

// Parser for unquoted string (no spaces)
let unquotedString = 
    many1Chars (noneOf " :")

// Parser for field:value pairs
let fieldValue =
    pipe2
        (many1Chars letter .>> pchar ':')
        (quotedString <|> unquotedString)
        (fun field value -> Choice1Of2 (field.ToLower(), value))

// Parser for search terms
let searchTerm =
    (quotedString <|> unquotedString)
    |>> Choice2Of2

// Parser for tokens (either field:value or search term)
let token =
    attempt fieldValue <|> searchTerm

// Main parser
let searchParser : Parser<SearchCriteria, unit> =
    many (token .>> spaces) |>> fun tokens ->
        let fields, searchTerms =
            tokens |> List.fold (fun (fields, terms) token ->
                match token with
                | Choice1Of2 (field, value) -> (Map.add field value fields, terms)
                | Choice2Of2 term -> (fields, term :: terms)
            ) (Map.empty, [])
        {
            SearchTerms = List.rev searchTerms
            Fields = fields
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
        printfn "Fields:"
        result.Fields |> Map.iter (fun k v -> printfn "  %s: %s" k v)
    | Failure (msg, _, _) ->
        printfn "Error: %s" msg
    printfn ""

testParser "\"red shoes\" category:clothing size:10 color:red brand:nike"
testParser "red shoes category:clothing size:10 color:red brand:nike"
testParser "comfortable red shoes category:clothing size:10"
testParser "category:clothing \"red winter shoes\" warm cozy"
testParser "\"quoted term\" another term yet:another"
