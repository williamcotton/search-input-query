import React from "react";
import { SearchType } from "search-input-query-parser/search-query-to-sql";

interface SearchTypeOption {
  value: SearchType;
  label: string;
  description: string;
}

const searchTypes: SearchTypeOption[] = [
  {
    value: "ilike",
    label: "ILIKE",
    description: "Case-insensitive pattern matching using LIKE",
  },
  {
    value: "tsvector",
    label: "Full Text Search",
    description: "PostgreSQL native full text search using tsvector/tsquery",
  },
  {
    value: "paradedb",
    label: "ParadeDB",
    description: "Full text search using ParadeDB's @@@ operator",
  },
];

interface SearchTypeSelectorProps {
  searchType: SearchType;
  onSearchTypeChange: (type: SearchType) => void;
}

const SearchTypeSelector: React.FC<SearchTypeSelectorProps> = ({
  searchType,
  onSearchTypeChange,
}) => {
  return (
    <div className="search-type-selector">
      <h3>Search Type:</h3>
      <div className="search-types">
        {searchTypes.map((type) => (
          <div key={type.value} className="search-type-option">
            <input
              type="radio"
              id={`search-type-${type.value}`}
              name="searchType"
              value={type.value}
              checked={searchType === type.value}
              onChange={(e) => onSearchTypeChange(e.target.value as SearchType)}
            />
            <label htmlFor={`search-type-${type.value}`}>
              {type.label}
              <span className="type-description">{type.description}</span>
            </label>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SearchTypeSelector;
