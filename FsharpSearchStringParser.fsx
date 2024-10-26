#!/usr/bin/env dotnet fsi
#r "nuget: FParsec"
open FParsec

// Define the types
type SearchCriteria = {
    SearchTerm: string option
    Fields: Map<string, string>
}

// Parser for quoted string - handles escaped quotes
let quotedString = 
    between 
        (pchar '"') 
        (pchar '"')
        (manyChars (noneOf "\"" <|> (pstring "\\\"" >>% '"')))

// Parser for unquoted string (no spaces)
let unquotedString = 
    many1Chars (noneOf " :")

// Parser for the search term (either quoted or unquoted)
let searchTerm = 
    (quotedString <|> unquotedString) .>> spaces

// Parser for field:value pairs
let fieldValue = 
    pipe2
        (many1Chars letter .>> pchar ':')
        (many1Chars (noneOf " "))
        (fun field value -> (field.ToLower(), value))

// Main parser
let searchParser : Parser<SearchCriteria, unit> =
    pipe2
        (opt searchTerm)
        (many (fieldValue .>> spaces))
        (fun searchTerm fields ->
            {
                SearchTerm = searchTerm
                Fields = Map.ofList fields
            })

// Function to run the parser
let parseSearchQuery (input: string) =
    run (spaces >>. searchParser .>> eof) input

// Test it
let r = parseSearchQuery "\"red shoes\" category:clothing size:10 color:red brand:nike"
match r with
| Success (result, _, _) -> 
    printfn "Search term: %A" result.SearchTerm
    printfn "Fields:"
    result.Fields |> Map.iter (fun k v -> printfn "  %s: %s" k v)
| Failure (msg, _, _) -> 
    printfn "Error: %s" msg