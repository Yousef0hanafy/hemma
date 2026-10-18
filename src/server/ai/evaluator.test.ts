import { describe, it, expect, afterEach, vi } from "vitest";
import { getAIApiKey, getAIModelName } from "./evaluator";

afterEach(() => vi.unstubAllEnvs());

describe("getAIApiKey", () => {
  it("uses OPENROUTER_API_KEY", () => {
    vi.stubEnv("OPENROUTER_API_KEY", "sk-or-v1-abc");
    expect(getAIApiKey()).toBe("sk-or-v1-abc");
  });

  it("never sends a real Google key to OpenRouter", () => {
    vi.stubEnv("OPENROUTER_API_KEY", "");
    vi.stubEnv("GOOGLE_API_KEY", "AIzaSyFakeGoogleKey");
    expect(getAIApiKey()).toBe("");
  });

  it("accepts an OpenRouter key left in GOOGLE_API_KEY (legacy setups)", () => {
    vi.stubEnv("OPENROUTER_API_KEY", "");
    vi.stubEnv("GOOGLE_API_KEY", "sk-or-v1-legacy");
    expect(getAIApiKey()).toBe("sk-or-v1-legacy");
  });
});

describe("getAIModelName", () => {
  it("defaults to the OpenRouter free router", () => {
    vi.stubEnv("AI_MODEL", "");
    expect(getAIModelName()).toBe("openrouter/free");
  });

  it("uses any OpenRouter model id from AI_MODEL", () => {
    vi.stubEnv("AI_MODEL", "anthropic/claude-sonnet-4");
    expect(getAIModelName()).toBe("anthropic/claude-sonnet-4");
  });

  it("ignores ids that aren't provider/model", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.stubEnv("AI_MODEL", "gemini-2.0-flash");
    expect(getAIModelName()).toBe("openrouter/free");
  });
});
