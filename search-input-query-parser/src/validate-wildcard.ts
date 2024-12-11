import { StringLiteral, WildcardPattern } from "./first-pass-parser";
import { ValidationError, SearchQueryErrorCode } from "./validator";

// Validates wildcard patterns

export const validateWildcard = (
  expr: StringLiteral | WildcardPattern,
  errors: ValidationError[]
) => {
  const value = expr.type === "STRING" ? expr.value : expr.prefix + "*";
  const starCount = (value.match(/\*/g) || []).length;
  const isQuoted = expr.quoted;

  // For unquoted strings
  if (!isQuoted) {
    const firstStar = value.indexOf("*");
    if (starCount > 1) {
      const secondStar = value.indexOf("*", firstStar + 1);
      errors.push({
        message: "Only one trailing wildcard (*) is allowed",
        code: SearchQueryErrorCode.WILDCARD_MULTIPLE_NOT_PERMITTED,
        position: expr.position + secondStar,
        length: 1,
      });
    }
    if ((firstStar !== -1 && firstStar !== value.length - 1) && !value.endsWith("**")) {
      errors.push({
        message: "Wildcard (*) can only appear at the end of a term",
        code: SearchQueryErrorCode.WILDCARD_POSITION_INVALID,
        position: expr.position + firstStar,
        length: 1,
      });
    }
  }

  // For quoted strings
  else {
    // Handle multiple wildcards or internal wildcards in quoted strings
    if (value.endsWith("**")) {
      errors.push({
        message: "Only one trailing wildcard (*) is allowed",
        code: SearchQueryErrorCode.WILDCARD_MULTIPLE_NOT_PERMITTED,
        position: expr.position + value.length - 1,
        length: 1,
      });
    }
  }
};
