import { describe, expect, it } from "vitest";

import { parseJSONResponse } from "../src/utils/json.js";

describe("parseJSONResponse", () => {
  it("parses a JSON object", () => {
    expect(parseJSONResponse('{"name":"Nabil"}')).toEqual({
      name: "Nabil"
    });
  });

  it("parses a fenced JSON response", () => {
    expect(parseJSONResponse(["```json", '{"name":"Nabil"}', "```"].join("\n"))).toEqual({
      name: "Nabil"
    });
  });

  it("rejects invalid JSON", () => {
    expect(() => {
      parseJSONResponse("This is not JSON");
    }).toThrowError(
      expect.objectContaining({
        code: "INVALID_STRUCTURED_OUTPUT"
      })
    );
  });

  it("does not extract JSON from surrounding text", () => {
    expect(() => {
      parseJSONResponse('Result: {"name":"Nabil"}');
    }).toThrowError(
      expect.objectContaining({
        code: "INVALID_STRUCTURED_OUTPUT"
      })
    );
  });
});
