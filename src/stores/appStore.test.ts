import { beforeEach, describe, expect, it } from "vitest";
import { tauriMock } from "../test/setup";
import {
  activeModel,
  activeProvider,
  adoptProviderIfActiveUnusable,
  providers,
} from "./appStore";

function setKey(providerId: string, apiKey: string) {
  providers.value = providers.value.map(p => (p.id === providerId ? { ...p, apiKey } : p));
}

beforeEach(() => {
  tauriMock.reset();
  providers.value = providers.value.map(p => ({ ...p, apiKey: "", isConnected: false }));
  activeProvider.value = "gemini";
  activeModel.value = "gemini-3-flash-preview";
});

describe("adoptProviderIfActiveUnusable", () => {
  it("switches to the verified provider when the active one has no key", () => {
    setKey("openai", "sk-test");
    adoptProviderIfActiveUnusable("openai");
    expect(activeProvider.value).toBe("openai");
    expect(activeModel.value).toBe("gpt-4o");
  });

  it("keeps the active provider when it already has a key", () => {
    setKey("gemini", "g-test");
    setKey("openai", "sk-test");
    adoptProviderIfActiveUnusable("openai");
    expect(activeProvider.value).toBe("gemini");
  });

  it("keeps a local Ollama selection", () => {
    activeProvider.value = "ollama";
    activeModel.value = "llama3.2";
    setKey("openai", "sk-test");
    adoptProviderIfActiveUnusable("openai");
    expect(activeProvider.value).toBe("ollama");
  });
});
