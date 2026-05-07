import { describe, it, expect } from "vitest";
import { extractTag, parseFloat01, parseBool, parseEnum } from "./xml.js";

describe("extractTag", () => {
  it("extracts content from a simple tag", () => {
    expect(extractTag("<foo>bar</foo>", "foo")).toBe("bar");
  });

  it("extracts multiline content", () => {
    const xml = "<foo>\n  hello\n  world\n</foo>";
    expect(extractTag(xml, "foo")).toBe("hello\n  world");
  });

  it("returns null for a missing tag", () => {
    expect(extractTag("<foo>bar</foo>", "baz")).toBeNull();
  });

  it("is case-insensitive on the tag name", () => {
    expect(extractTag("<FOO>bar</FOO>", "foo")).toBe("bar");
  });

  it("trims whitespace from extracted content", () => {
    expect(extractTag("<foo>  bar  </foo>", "foo")).toBe("bar");
  });

  it("handles empty tag content", () => {
    expect(extractTag("<foo></foo>", "foo")).toBe("");
  });

  it("extracts the correct tag from a multi-tag XML blob", () => {
    const xml = [
      "<diagnosis>",
      "  <failure_type>wrong_approach</failure_type>",
      "  <root_cause>too slow</root_cause>",
      "</diagnosis>",
    ].join("\n");
    expect(extractTag(xml, "failure_type")).toBe("wrong_approach");
    expect(extractTag(xml, "root_cause")).toBe("too slow");
  });

  it("handles LLM prose before and after the tag", () => {
    const xml = "Some preamble text\n<foo>the answer</foo>\nSome trailing text";
    expect(extractTag(xml, "foo")).toBe("the answer");
  });

  it("returns null for empty input", () => {
    expect(extractTag("", "foo")).toBeNull();
  });

  it("does not partially match tag names", () => {
    // <foo_bar> should not be matched by tag "foo"
    expect(extractTag("<foo_bar>value</foo_bar>", "foo")).toBeNull();
  });

  it("handles nested whitespace in multiline content", () => {
    const xml = "<hint>\n  Think about it differently.\n  Consider the inverse.\n</hint>";
    const result = extractTag(xml, "hint");
    expect(result).toBe("Think about it differently.\n  Consider the inverse.");
  });
});

describe("parseFloat01", () => {
  it("parses a valid float", () => {
    expect(parseFloat01("0.5")).toBe(0.5);
  });

  it("parses zero", () => {
    expect(parseFloat01("0")).toBe(0);
  });

  it("parses one", () => {
    expect(parseFloat01("1")).toBe(1);
  });

  it("parses a value with leading/trailing whitespace", () => {
    expect(parseFloat01("  0.75  ")).toBe(0.75);
  });

  it("clamps values above 1 to 1", () => {
    expect(parseFloat01("1.5")).toBe(1);
  });

  it("clamps values below 0 to 0", () => {
    expect(parseFloat01("-0.1")).toBe(0);
  });

  it("returns null for null input", () => {
    expect(parseFloat01(null)).toBeNull();
  });

  it("returns null for a non-numeric string", () => {
    expect(parseFloat01("abc")).toBeNull();
  });

  it("returns null for an empty string", () => {
    expect(parseFloat01("")).toBeNull();
  });

  it("handles scientific notation", () => {
    expect(parseFloat01("1e-1")).toBeCloseTo(0.1, 5);
  });
});

describe("parseBool", () => {
  it("parses 'true'", () => {
    expect(parseBool("true")).toBe(true);
  });

  it("parses 'false'", () => {
    expect(parseBool("false")).toBe(false);
  });

  it("is case-insensitive", () => {
    expect(parseBool("True")).toBe(true);
    expect(parseBool("FALSE")).toBe(false);
    expect(parseBool("TRUE")).toBe(true);
  });

  it("trims surrounding whitespace", () => {
    expect(parseBool("  true  ")).toBe(true);
    expect(parseBool("  false  ")).toBe(false);
  });

  it("returns null for null input", () => {
    expect(parseBool(null)).toBeNull();
  });

  it("returns null for unrecognized value 'yes'", () => {
    expect(parseBool("yes")).toBeNull();
  });

  it("returns null for numeric '1'", () => {
    expect(parseBool("1")).toBeNull();
  });

  it("returns null for an empty string", () => {
    expect(parseBool("")).toBeNull();
  });
});

describe("parseEnum", () => {
  const levels = ["easy", "medium", "hard", "out_of_scope"] as const;

  it("parses a valid enum value", () => {
    expect(parseEnum("easy", levels)).toBe("easy");
  });

  it("is case-insensitive", () => {
    expect(parseEnum("EASY", levels)).toBe("easy");
    expect(parseEnum("Medium", levels)).toBe("medium");
    expect(parseEnum("HARD", levels)).toBe("hard");
  });

  it("trims surrounding whitespace", () => {
    expect(parseEnum("  hard  ", levels)).toBe("hard");
  });

  it("returns null for an invalid value", () => {
    expect(parseEnum("extreme", levels)).toBeNull();
  });

  it("returns null for null input", () => {
    expect(parseEnum(null, levels)).toBeNull();
  });

  it("returns null for an empty string", () => {
    expect(parseEnum("", levels)).toBeNull();
  });

  it("matches values containing underscores", () => {
    expect(parseEnum("out_of_scope", levels)).toBe("out_of_scope");
  });

  it("does not match partial strings", () => {
    expect(parseEnum("eas", levels)).toBeNull();
  });
});
