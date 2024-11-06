/*
https://microsoft.github.io/monaco-editor/playground.html?source=v0.52.0#example-interacting-with-the-editor-line-and-inline-decorations

probably better to just use the monaco editor
*/

import React, { useState, useRef } from "react";

const SearchInput = () => {
  const [query, setQuery] = useState(
    "invalid_field:test category:books bad_field:value color:red size:large location:paris date:2024"
  );
  const inputRef = useRef(null);
  const errorRanges = [
    [0, 13],
    [34, 43],
  ];

  const handleInput = (e) => {
    setQuery(e.currentTarget.textContent);
  };

  const renderContent = () => {
    let result = [];
    let lastIndex = 0;

    errorRanges.forEach(([start, end], i) => {
      if (start > lastIndex) {
        result.push(
          <span key={`normal-${i}`}>{query.slice(lastIndex, start)}</span>
        );
      }

      result.push(
        <span key={`error-${i}`} className="relative border-b-2 border-red-500">
          {query.slice(start, end)}
        </span>
      );

      lastIndex = end;
    });

    if (lastIndex < query.length) {
      result.push(<span key="normal-last">{query.slice(lastIndex)}</span>);
    }

    return result;
  };

  return (
    <div className="w-full max-w-2xl mx-auto p-4">
      <div className="relative overflow-auto rounded border">
        <div
          ref={inputRef}
          contentEditable
          onInput={handleInput}
          className="w-full p-2 font-mono text-base whitespace-nowrap outline-none"
          style={{
            height: "2rem",
            lineHeight: "1.5rem",
          }}
        >
          {renderContent()}
        </div>
      </div>
    </div>
  );
};

export default SearchInput;
