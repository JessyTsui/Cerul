import { describe, expect, it } from "vitest";
import {
  parseQueryLogFiltersFromSearchParams,
  serializeQueryLogFiltersToSearchParams,
} from "./use-query-logs-url-state";

describe("query log url state helpers", () => {
  it("round-trips populated filters through URLSearchParams", () => {
    const params = serializeQueryLogFiltersToSearchParams(
      {
        requestId: "req_123",
        userId: "user_123",
        query: "openai",
        surface: "mcp",
        clientSource: "cli",
        from: "2026-04-01T00:00:00.000Z",
        to: "2026-04-08T00:00:00.000Z",
        limit: 25,
        offset: 50,
      },
      "req_123",
    );

    expect(parseQueryLogFiltersFromSearchParams(params)).toEqual({
      requestId: "req_123",
      userId: "user_123",
      query: "openai",
      surface: "mcp",
      clientSource: "cli",
      from: "2026-04-01T00:00:00.000Z",
      to: "2026-04-08T00:00:00.000Z",
      limit: 25,
      offset: 50,
    });
    expect(params.get("selected")).toBe("req_123");
  });

  it("drops empty values and restores defaults for absent pagination", () => {
    const parsed = parseQueryLogFiltersFromSearchParams(new URLSearchParams("query=&offset=-2"));

    expect(parsed).toEqual({
      requestId: undefined,
      userId: undefined,
      query: undefined,
      surface: undefined,
      clientSource: undefined,
      from: undefined,
      to: undefined,
      limit: 50,
      offset: 0,
    });

    const params = serializeQueryLogFiltersToSearchParams(parsed, null);
    expect(params.toString()).toBe("");
  });
});
