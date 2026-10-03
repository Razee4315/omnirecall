import { describe, expect, it } from "vitest";
import { errorMessage, parseApiError } from "./errors";
import { estimateTokens, trimHistory } from "./history";

describe("errorMessage", () => {
  it("reads Tauri string rejections and Error objects alike", () => {
    expect(errorMessage("API error: boom")).toBe("API error: boom");
    expect(errorMessage(new Error("nope"))).toBe("nope");
    expect(errorMessage({ message: "from object" })).toBe("from object");
    expect(errorMessage(undefined, "fallback")).toBe("fallback");
    expect(errorMessage("   ", "fallback")).toBe("fallback");
  });
});

describe("parseApiError", () => {
  it("maps provider failures to actionable messages", () => {
    expect(parseApiError("Invalid API key")).toMatch(/Invalid API key/);
    expect(parseApiError("Rate limit exceeded (429). Please wait")).toMatch(/Rate limit/);
    expect(parseApiError("API error: Anthropic error 404: not_found_error")).toMatch(/Model not found/);
    expect(parseApiError("Network error: Could not connect to the provider")).toMatch(/Connection failed/);
    expect(parseApiError("Network error: Cannot connect to Ollama")).toMatch(/Ollama/);
  });

  it("keeps the reason for an empty response", () => {
    expect(parseApiError("No response received: the prompt was blocked (SAFETY)")).toBe(
      "No response received: the prompt was blocked (SAFETY). Try again, rephrase, or switch models.",
    );
  });

  it("shortens very long raw errors", () => {
    expect(parseApiError("x".repeat(500)).length).toBeLessThan(160);
  });
});

describe("trimHistory", () => {
  const turn = (role: string, chars: number) => ({ role, content: "x".repeat(chars) });

  it("keeps everything when it fits", () => {
    const history = [turn("user", 40), turn("assistant", 40)];
    expect(trimHistory(history, 100)).toEqual(history);
  });

  it("drops the oldest turns first", () => {
    const history = [turn("user", 400), turn("assistant", 400), turn("user", 40), turn("assistant", 40)];
    expect(trimHistory(history, 30)).toEqual(history.slice(2));
  });

  it("never starts on an assistant turn", () => {
    const history = [turn("user", 400), turn("assistant", 40), turn("user", 40), turn("assistant", 40)];
    // Budget fits the last three turns, but the first of those is the assistant's.
    expect(trimHistory(history, 30).map(t => t.role)).toEqual(["user", "assistant"]);
  });

  it("returns nothing when even the latest turn is too big", () => {
    expect(trimHistory([turn("user", 4000)], 10)).toEqual([]);
  });

  it("estimates four characters per token", () => {
    expect(estimateTokens("")).toBe(0);
    expect(estimateTokens("abcde")).toBe(2);
  });
});
