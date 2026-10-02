import { beforeEach, describe, expect, it, vi } from "vitest";
import { tauriMock } from "../test/setup";

type AppStore = typeof import("./appStore");

/// A fresh copy of the store module (it keeps module-level persistence state)
/// on top of whatever is in the mocked store file.
async function freshStore(): Promise<AppStore> {
  vi.resetModules();
  return import("./appStore");
}

function invokeHandlers(handlers: Record<string, (args: Record<string, unknown>) => unknown>) {
  tauriMock.invoke.mockImplementation(async (cmd: string, args?: Record<string, unknown>) => {
    const handler = handlers[cmd];
    return handler ? handler(args ?? {}) : undefined;
  });
}

const session = (id: string, overrides: Record<string, unknown> = {}) => ({
  id,
  title: `Chat ${id}`,
  messages: [
    { id: `${id}-u1`, role: "user", content: "hello there" },
    { id: `${id}-a1`, role: "assistant", content: "general kenobi" },
  ],
  branches: [],
  branchMessages: {},
  createdAt: "2026-01-01T00:00:00.000Z",
  ...overrides,
});

beforeEach(() => {
  tauriMock.reset();
  localStorage.clear();
});

describe("adoptProviderIfActiveUnusable", () => {
  it("switches to the verified provider when the active one has no key", async () => {
    const store = await freshStore();
    store.updateProviderApiKey("openai", "sk-test");
    store.adoptProviderIfActiveUnusable("openai");
    expect(store.activeProvider.value).toBe("openai");
    expect(store.activeModel.value).toBe("gpt-4o");
  });

  it("keeps the active provider when it already has a key", async () => {
    const store = await freshStore();
    store.updateProviderApiKey("gemini", "g-test");
    store.adoptProviderIfActiveUnusable("openai");
    expect(store.activeProvider.value).toBe("gemini");
  });

  it("keeps a local Ollama selection", async () => {
    const store = await freshStore();
    store.setActiveModel("ollama", "llama3.2");
    store.adoptProviderIfActiveUnusable("openai");
    expect(store.activeProvider.value).toBe("ollama");
  });
});

describe("verifyProvider", () => {
  it("stores the live model list and replaces a model the provider no longer offers", async () => {
    const store = await freshStore();
    invokeHandlers({ test_api_key: () => ["claude-new-1", "claude-new-2"] });
    store.setActiveModel("anthropic", "claude-3-5-sonnet-20241022");
    await store.verifyProvider("anthropic", "a-key");

    expect(store.getProviderModels("anthropic")).toEqual(["claude-new-1", "claude-new-2"]);
    expect(store.activeModel.value).toBe("claude-new-1");
    expect(store.providers.value.find(p => p.id === "anthropic")?.isConnected).toBe(true);
  });

  it("reports an invalid key and leaves the provider disconnected", async () => {
    const store = await freshStore();
    invokeHandlers({ test_api_key: () => { throw "Invalid API key"; } });
    await expect(store.verifyProvider("openai", "bad")).rejects.toThrow(/Invalid API key/);
    expect(store.providers.value.find(p => p.id === "openai")?.isConnected).toBe(false);
  });

  it("keeps custom models alongside the live list", async () => {
    const store = await freshStore();
    invokeHandlers({ test_api_key: () => ["gpt-x"] });
    expect(store.addCustomModel("openai", "my-finetune")).toEqual({ ok: true });
    await store.verifyProvider("openai", "sk");
    expect(store.getProviderModels("openai")).toEqual(["gpt-x", "my-finetune"]);
  });
});

describe("API key storage", () => {
  it("moves keys from the store file into the credential store", async () => {
    tauriMock.storeData.set("providers", [{ id: "openai", apiKey: "sk-legacy", isConnected: true }]);
    const secrets: Record<string, string> = {};
    invokeHandlers({
      get_api_key_secrets: () => ({ ...secrets }),
      set_api_key_secret: ({ provider, value }) => { secrets[provider as string] = value as string; },
    });
    const store = await freshStore();
    await store.loadPersistedData();

    expect(store.providers.value.find(p => p.id === "openai")?.apiKey).toBe("sk-legacy");
    expect(secrets.openai).toBe("sk-legacy");
    const stored = tauriMock.storeData.get("providers") as { id: string; apiKey: string }[];
    expect(stored.every(p => p.apiKey === "")).toBe(true);
  });

  it("falls back to the store file when the credential store is unavailable", async () => {
    tauriMock.storeData.set("providers", [{ id: "openai", apiKey: "sk-legacy", isConnected: false }]);
    invokeHandlers({ get_api_key_secrets: () => { throw "Credential store unavailable"; } });
    const store = await freshStore();
    await store.loadPersistedData();
    store.updateProviderApiKey("gemini", "g-new");
    await vi.waitFor(() => {
      const stored = tauriMock.storeData.get("providers") as { id: string; apiKey: string }[];
      expect(stored.find(p => p.id === "gemini")?.apiKey).toBe("g-new");
    });
    expect(store.providers.value.find(p => p.id === "openai")?.apiKey).toBe("sk-legacy");
  });
});

describe("session persistence", () => {
  it("migrates the legacy single-array history to one key per session", async () => {
    tauriMock.storeData.set("chatHistory", [session("a"), session("b"), { junk: true }]);
    const store = await freshStore();
    await store.loadPersistedData();

    expect(store.chatHistory.value.map(s => s.id)).toEqual(["a", "b"]);
    expect(tauriMock.storeData.get("sessionIndex")).toEqual(["a", "b"]);
    expect(tauriMock.storeData.has("session:a")).toBe(true);
    expect(tauriMock.storeData.has("chatHistory")).toBe(false);
  });

  it("writes only the session that changed", async () => {
    tauriMock.storeData.set("sessionIndex", ["a", "b"]);
    tauriMock.storeData.set("session:a", session("a"));
    tauriMock.storeData.set("session:b", session("b"));
    const store = await freshStore();
    await store.loadPersistedData();

    const before = tauriMock.storeData.get("session:b");
    store.updateSessionTitle("a", "Renamed");
    await store.saveChatHistoryNow();

    expect((tauriMock.storeData.get("session:a") as { title: string }).title).toBe("Renamed");
    // Untouched session was not rewritten (the mock clones on every set).
    expect(tauriMock.storeData.get("session:b")).toBe(before);
  });

  it("removes a deleted session's key and restores it on undo in place", async () => {
    tauriMock.storeData.set("sessionIndex", ["a", "b", "c"]);
    for (const id of ["a", "b", "c"]) tauriMock.storeData.set(`session:${id}`, session(id));
    const store = await freshStore();
    await store.loadPersistedData();

    const deleted = store.chatHistory.value[1];
    store.deleteChatSession("b");
    await store.saveChatHistoryNow();
    expect(tauriMock.storeData.has("session:b")).toBe(false);
    expect(tauriMock.storeData.get("sessionIndex")).toEqual(["a", "c"]);

    store.restoreChatSession(deleted, 1);
    await store.saveChatHistoryNow();
    expect(tauriMock.storeData.get("sessionIndex")).toEqual(["a", "b", "c"]);
  });

  it("orders sessions by pin, then by last activity", async () => {
    const store = await freshStore();
    store.chatHistory.value = [
      store.sanitizeSession(session("old", { updatedAt: "2026-01-05T00:00:00.000Z" }), true)!,
      store.sanitizeSession(session("new", { updatedAt: "2026-02-01T00:00:00.000Z" }), true)!,
      store.sanitizeSession(session("pinned", { isPinned: true }), true)!,
    ];
    expect(store.orderedSessions.value.map(s => s.id)).toEqual(["pinned", "new", "old"]);
    expect(store.loadSessionByIndex(1)).toBe(true);
    expect(store.activeSessionId.value).toBe("new");
  });
});

describe("sanitizeSession", () => {
  it("rejects things that are not sessions", async () => {
    const store = await freshStore();
    expect(store.sanitizeSession(null, true)).toBeNull();
    expect(store.sanitizeSession({ title: "x" }, true)).toBeNull();
    expect(store.sanitizeSession({ title: "  ", messages: [] }, true)).toBeNull();
  });

  it("coerces malformed fields instead of passing them through", async () => {
    const store = await freshStore();
    const result = store.sanitizeSession(
      {
        id: "s",
        title: "T",
        messages: [{ role: "system", content: 42 }, "garbage"],
        branches: [{ id: "b1", name: "B" }, { name: "no id" }],
        branchMessages: { b1: [{ role: "assistant", content: "x" }], orphan: [] },
        activeBranchId: "missing",
        folderId: 7,
      },
      true,
    )!;
    expect(result.messages).toHaveLength(1);
    expect(result.messages[0]).toMatchObject({ role: "user", content: "42" });
    expect(result.branches.map(b => b.id)).toEqual(["b1"]);
    expect(Object.keys(result.branchMessages)).toEqual(["b1"]);
    expect(result.activeBranchId).toBeNull();
    expect(result.folderId).toBeNull();
  });
});

describe("import", () => {
  it("imports a backup once and reports duplicates on the second try", async () => {
    const store = await freshStore();
    const backup = JSON.stringify({
      version: 1,
      sessions: [session("a"), session("b"), { broken: true }],
      folders: [{ id: "f1", name: "Work", color: "#fff" }],
    });
    expect(store.importChats(backup)).toEqual({ ok: true, sessions: 2, skipped: 1 });
    expect(store.chatFolders.value.map(f => f.name)).toEqual(["Work"]);
    expect(store.importChats(backup)).toEqual({ ok: true, sessions: 0, skipped: 3 });
    expect(store.chatHistory.value).toHaveLength(2);
  });

  it("gives a single imported chat a new id", async () => {
    const store = await freshStore();
    const result = store.importChats(JSON.stringify(session("a")));
    expect(result).toEqual({ ok: true, sessions: 1, skipped: 0 });
    expect(store.chatHistory.value[0].id).not.toBe("a");
  });

  it("explains invalid input", async () => {
    const store = await freshStore();
    expect(store.importChats("not json")).toMatchObject({ ok: false });
    expect(store.importChats('{"hello": 1}')).toMatchObject({ ok: false });
  });
});

describe("search", () => {
  it("finds titles, main-thread messages and branch-only messages", async () => {
    const store = await freshStore();
    store.chatHistory.value = [
      store.sanitizeSession(
        session("a", {
          title: "Kenobi notes",
          branches: [{ id: "b1", name: "Branch 1", fromMessageId: "x", createdAt: "2026-01-01T00:00:00.000Z" }],
          branchMessages: {
            b1: [
              { id: "x", role: "user", content: "hello there" },
              { id: "b1-a", role: "assistant", content: "kenobi in a branch" },
            ],
          },
        }),
        true,
      )!,
    ];
    const results = store.searchChatHistory("KENOBI");
    expect(results.map(r => [r.kind, r.branchId, r.messageId])).toEqual([
      ["title", null, null],
      ["assistant", null, "a-a1"],
      ["assistant", "b1", "b1-a"],
    ]);

    store.openSearchResult(results[2]);
    expect(store.activeBranchId.value).toBe("b1");
    expect(store.pendingScrollMessageId.value).toBe("b1-a");
    expect(store.searchChatHistory("   ")).toEqual([]);
  });
});

describe("branches and versions", () => {
  async function withSession() {
    const store = await freshStore();
    store.chatHistory.value = [store.sanitizeSession(session("a"), true)!];
    store.loadSession(store.chatHistory.value[0]);
    return store;
  }

  it("groups regenerated answers as versions instead of named branches", async () => {
    const store = await withSession();
    const v2 = store.createRegenerationBranch("a", "a-u1")!;
    expect(store.currentMessages.value.map(m => m.content)).toEqual(["hello there"]);
    store.updateThreadMessages("a", v2, [...store.currentMessages.value, { id: "v2-a", role: "assistant", content: "second" }]);
    store.switchToBranch("a", v2);

    // Regenerating again from version 2 adds a sibling of the same answer.
    const v3 = store.createRegenerationBranch("a", store.currentMessages.value[0].id)!;
    const versions = store.getMessageVersions(1)!;
    expect(versions.ids).toEqual([null, v2, v3]);
    expect(versions.current).toBe(2);

    // Versions don't show up as branches the user has to manage...
    expect(store.visibleThreadCount(store.chatHistory.value[0])).toBe(1);
    // ...and Main is still reachable.
    store.switchToBranch("a", null);
    expect(store.getMessageVersions(1)).toMatchObject({ current: 0 });
    expect(store.getMessageVersions(0)).toBeNull();
  });

  it("bumps the thread epoch on every navigation", async () => {
    const store = await withSession();
    const start = store.threadEpoch.value;
    store.branchFromMessage("a", "a-a1");
    store.switchToBranch("a", null);
    store.startNewChat();
    expect(store.threadEpoch.value).toBe(start + 3);
  });

  it("editing a later message continues on a branch and keeps the original", async () => {
    const store = await withSession();
    store.updateThreadMessages("a", null, [
      ...store.chatHistory.value[0].messages,
      { id: "a-u2", role: "user", content: "second question" },
    ]);
    store.loadSession(store.chatHistory.value[0]);

    expect(store.editMessage("a-u2")).toBe(true);
    expect(store.currentQuery.value).toBe("second question");
    expect(store.activeBranchId.value).not.toBeNull();
    expect(store.currentMessages.value).toHaveLength(2);
    expect(store.chatHistory.value[0].messages).toHaveLength(3);
  });

  it("editing the first message starts a new chat and leaves the saved one intact", async () => {
    const store = await withSession();
    expect(store.editMessage("a-u1")).toBe(true);
    expect(store.activeSessionId.value).toBeNull();
    expect(store.currentMessages.value).toEqual([]);
    expect(store.currentQuery.value).toBe("hello there");
    expect(store.chatHistory.value[0].messages).toHaveLength(2);
  });
});

describe("drafts", () => {
  it("keeps unsent text per chat", async () => {
    const store = await freshStore();
    store.chatHistory.value = [
      store.sanitizeSession(session("a"), true)!,
      store.sanitizeSession(session("b"), true)!,
    ];
    store.loadSession(store.chatHistory.value[0]);
    store.currentQuery.value = "draft for a";
    store.loadSession(store.chatHistory.value[1]);
    expect(store.currentQuery.value).toBe("");
    store.currentQuery.value = "draft for b";
    store.loadSession(store.chatHistory.value[0]);
    expect(store.currentQuery.value).toBe("draft for a");
    store.startNewChat();
    expect(store.currentQuery.value).toBe("");
    store.loadSession(store.chatHistory.value[1]);
    expect(store.currentQuery.value).toBe("draft for b");
  });
});

describe("documents", () => {
  it("adds supported files once and reports the rest", async () => {
    const store = await freshStore();
    invokeHandlers({
      get_supported_extensions: () => ["pdf", "md"],
      get_documents_status: () => ({ documents: [], contextMode: "none", contextTokens: 0 }),
    });
    const first = await store.addDocumentPaths(["C:\\docs\\a.PDF", "/home/u/b.md", "c.docx", "/home/u/b.md"]);
    expect(first).toEqual({ added: 2, unsupported: 1, duplicates: 1 });
    expect(store.documents.value.map(d => [d.name, d.type])).toEqual([["a.PDF", "pdf"], ["b.md", "md"]]);
  });

  it("removes a document's vectors along with the document", async () => {
    const store = await freshStore();
    invokeHandlers({
      get_supported_extensions: () => ["md"],
      get_documents_status: () => ({ documents: [], contextMode: "none", contextTokens: 0 }),
    });
    await store.addDocumentPaths(["a.md"]);
    const id = store.documents.value[0].id;
    store.removeDocument(id);
    expect(store.documents.value).toEqual([]);
    expect(tauriMock.invoke).toHaveBeenCalledWith("remove_document_index", { documentId: id });
  });

  it("indexes unindexed documents once an embedding key exists, and counts them in the context estimate", async () => {
    const store = await freshStore();
    const indexed: string[] = [];
    invokeHandlers({
      get_supported_extensions: () => ["md"],
      get_documents_status: ({ documents }) => ({
        documents: (documents as { id: string }[]).map(d => ({
          id: d.id, chars: 4000, error: null, indexedChunks: indexed.includes(d.id) ? 3 : 0,
        })),
        contextMode: "full",
        contextTokens: 1000,
      }),
      index_document: ({ documentId }) => { indexed.push(documentId as string); return 3; },
    });
    await store.addDocumentPaths(["a.md"]);
    await store.refreshDocumentStatus();
    expect(indexed).toEqual([]);

    store.updateProviderApiKey("gemini", "g-key");
    await vi.waitFor(() => expect(indexed).toHaveLength(1));
    await store.refreshDocumentStatus();
    // Indexed already: a further refresh must not index again.
    await store.refreshDocumentStatus();
    expect(indexed).toHaveLength(1);

    expect(store.contextTokens.value).toBe(1000);
    store.setDocsEnabled(false);
    expect(store.contextTokens.value).toBe(0);
    expect(store.documentRequestArgs().documents).toEqual([]);
  });
});

describe("resetAllData", () => {
  it("clears the store file, secrets and backend data", async () => {
    tauriMock.storeData.set("sessionIndex", ["a"]);
    tauriMock.storeData.set("session:a", session("a"));
    tauriMock.storeData.set("onboardingComplete", true);
    const secrets: Record<string, string> = { openai: "sk" };
    let backendReset = 0;
    invokeHandlers({
      get_api_key_secrets: () => ({ ...secrets }),
      set_api_key_secret: ({ provider, value }) => {
        if (value) secrets[provider as string] = value as string;
        else delete secrets[provider as string];
      },
      reset_backend_data: () => { backendReset++; return { hotkey: "Alt+Space", registered: true, error: null }; },
      get_hotkey_status: () => ({ hotkey: "Ctrl+KeyJ", registered: true, error: null }),
    });
    const store = await freshStore();
    await store.loadPersistedData();
    expect(store.globalHotkey.value).toBe("Ctrl+KeyJ");

    await store.resetAllData();
    expect(tauriMock.storeData.size).toBe(0);
    expect(secrets).toEqual({});
    expect(backendReset).toBe(1);
    expect(store.chatHistory.value).toEqual([]);
    expect(store.globalHotkey.value).toBe("Alt+Space");
    expect(store.isOnboardingActive.value).toBe(true);
    expect(store.providers.value.every(p => p.apiKey === "")).toBe(true);
  });
});

describe("window holds", () => {
  it("suspends hide-on-blur while any reason is active", async () => {
    const store = await freshStore();
    store.holdWindowOpen("settings", true);
    store.holdWindowOpen("file-dialog", true);
    store.holdWindowOpen("settings", false);
    store.holdWindowOpen("file-dialog", false);
    const calls = tauriMock.invoke.mock.calls.filter(([cmd]) => cmd === "set_blur_hide_suspended");
    expect(calls.map(([, args]) => (args as { suspended: boolean }).suspended)).toEqual([true, false]);
  });
});
