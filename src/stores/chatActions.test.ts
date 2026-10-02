import { beforeEach, describe, expect, it, vi } from "vitest";
import { tauriMock } from "../test/setup";

type AppStore = typeof import("./appStore");
type ChatActions = typeof import("./chatActions");

interface StreamArgs {
  streamId: string;
  message: string;
  history: { role: string; content: string }[];
  documents: unknown[];
  provider: string;
  model: string;
  baseUrl: string | null;
}

/// Controls one in-flight `send_message_stream` call from the test.
interface PendingStream {
  args: StreamArgs;
  emit: (chunk: string, streamId?: string) => void;
  finish: (result?: { stopped?: boolean; sources?: string[] }) => void;
  fail: (error: string) => void;
}

let store: AppStore;
let chat: ChatActions;
let streams: PendingStream[];

async function nextStream(): Promise<PendingStream> {
  const count = streams.length;
  await vi.waitFor(() => expect(streams.length).toBeGreaterThan(count));
  return streams[streams.length - 1];
}

beforeEach(async () => {
  tauriMock.reset();
  localStorage.clear();
  streams = [];
  vi.resetModules();
  store = await import("./appStore");
  chat = await import("./chatActions");

  tauriMock.invoke.mockImplementation(async (cmd: string, args?: Record<string, unknown>) => {
    if (cmd !== "send_message_stream") return undefined;
    const streamArgs = args as unknown as StreamArgs;
    return new Promise((resolve, reject) => {
      streams.push({
        args: streamArgs,
        emit: (chunk, streamId = streamArgs.streamId) => tauriMock.emit("chat-stream", { streamId, chunk }),
        finish: (result = {}) => resolve({ stopped: false, sources: [], contextMode: "none", ...result }),
        fail: reject,
      });
    });
  });

  store.updateProviderApiKey("gemini", "g-key");
});

async function send(text: string) {
  store.currentQuery.value = text;
  const done = chat.submitMessage();
  const stream = await nextStream();
  return { done, stream };
}

describe("submitMessage", () => {
  it("streams an answer and saves the first exchange as a session", async () => {
    const { done, stream } = await send("What is Rust?");
    expect(store.isGenerating.value).toBe(true);
    expect(store.currentQuery.value).toBe("");

    stream.emit("A systems ");
    stream.emit("language.");
    stream.finish({ sources: ["book.pdf"] });
    await done;

    expect(store.isGenerating.value).toBe(false);
    expect(store.currentMessages.value.map(m => [m.role, m.content])).toEqual([
      ["user", "What is Rust?"],
      ["assistant", "A systems language."],
    ]);
    const answer = store.currentMessages.value[1];
    expect(answer).toMatchObject({ model: store.activeModel.value, sources: ["book.pdf"] });
    expect(answer.interrupted).toBeUndefined();

    expect(store.chatHistory.value).toHaveLength(1);
    expect(store.chatHistory.value[0].title).toBe("What is Rust?");
    expect(store.activeSessionId.value).toBe(store.chatHistory.value[0].id);
  });

  it("ignores chunks that belong to another stream", async () => {
    const { done, stream } = await send("hi");
    stream.emit("stale text", "some-other-stream");
    stream.emit("mine");
    stream.finish();
    await done;
    expect(store.currentMessages.value[1].content).toBe("mine");
  });

  it("sends the prior turns as history, and the provider's base URL", async () => {
    store.updateProviderBaseUrl("ollama", "http://10.0.0.5:11434");
    store.setActiveModel("ollama", "llama3.2");
    const first = await send("one");
    first.stream.emit("1");
    first.stream.finish();
    await first.done;

    const second = await send("two");
    expect(second.stream.args.history).toEqual([
      { role: "user", content: "one" },
      { role: "assistant", content: "1" },
    ]);
    expect(second.stream.args.message).toBe("two");
    expect(second.stream.args.baseUrl).toBe("http://10.0.0.5:11434");
    second.stream.finish();
    await second.done;
  });

  it("keeps a stopped answer and marks it interrupted", async () => {
    const { done, stream } = await send("long one");
    stream.emit("partial");
    store.stopGeneration();
    expect(tauriMock.invoke).toHaveBeenCalledWith("stop_generation", { streamId: stream.args.streamId });
    stream.finish({ stopped: true });
    await done;

    expect(store.currentMessages.value[1]).toMatchObject({ content: "partial", interrupted: true });
    expect(store.chatHistory.value[0].messages[1].interrupted).toBe(true);
    expect(chat.chatError.value).toBeNull();
  });

  it("saves what arrived before a mid-stream failure and offers a retry", async () => {
    const first = await send("setup");
    first.stream.emit("ok");
    first.stream.finish();
    await first.done;

    const { done, stream } = await send("will fail");
    stream.emit("half an ans");
    stream.fail("Network error: connection reset");
    await done;

    const saved = store.chatHistory.value[0].messages;
    expect(saved.map(m => m.content)).toEqual(["setup", "ok", "will fail", "half an ans"]);
    expect(saved[3].interrupted).toBe(true);
    expect(chat.chatError.value).toMatch(/Connection failed/);
    expect(chat.canRetry()).toBe(true);

    // Retrying a partial answer regenerates it as a new version rather than
    // re-sending the user message after it.
    const retry = chat.retryLast();
    const retryStream = await nextStream();
    expect(retryStream.args.message).toBe("will fail");
    retryStream.emit("full answer");
    retryStream.finish();
    await retry;
    expect(store.currentMessages.value.map(m => m.content)).toEqual(["setup", "ok", "will fail", "full answer"]);
    expect(store.getMessageVersions(3)).toMatchObject({ current: 1 });
    expect(store.chatHistory.value[0].messages[3].content).toBe("half an ans");
  });

  it("shows an error for an empty response and does not create a session", async () => {
    const { done, stream } = await send("blocked");
    stream.fail("No response received: the prompt was blocked (SAFETY)");
    await done;

    expect(chat.chatError.value).toMatch(/No response received: the prompt was blocked/);
    expect(store.chatHistory.value).toEqual([]);
    expect(store.currentMessages.value.map(m => m.role)).toEqual(["user"]);

    // Retry re-sends the same message without duplicating it.
    const retry = chat.retryLast();
    const retryStream = await nextStream();
    retryStream.emit("fine");
    retryStream.finish();
    await retry;
    expect(store.currentMessages.value.map(m => m.content)).toEqual(["blocked", "fine"]);
    expect(store.chatHistory.value).toHaveLength(1);
  });

  it("saves the answer to its own session when the user starts a new chat mid-stream", async () => {
    const { done, stream } = await send("background question");
    stream.emit("partial ");
    store.startNewChat();
    store.currentQuery.value = "typing the next thing";
    stream.emit("answer");
    stream.finish();
    await done;

    // The new chat the user is looking at is untouched...
    expect(store.currentMessages.value).toEqual([]);
    expect(store.activeSessionId.value).toBeNull();
    expect(store.currentQuery.value).toBe("typing the next thing");
    // ...and the answer landed in a session of its own.
    expect(store.chatHistory.value).toHaveLength(1);
    expect(store.chatHistory.value[0].messages.map(m => m.content)).toEqual(["background question", "partial answer"]);
    expect(store.isGenerating.value).toBe(false);
  });

  it("writes to the original session when the user switches chats mid-stream", async () => {
    const first = await send("chat one");
    first.stream.emit("answer one");
    first.stream.finish();
    await first.done;
    const sessionOne = store.chatHistory.value[0].id;

    const { done, stream } = await send("follow up");
    store.startNewChat();
    stream.emit("late answer");
    stream.finish();
    await done;

    const saved = store.chatHistory.value.find(s => s.id === sessionOne)!;
    expect(saved.messages.map(m => m.content)).toEqual(["chat one", "answer one", "follow up", "late answer"]);
    expect(store.currentMessages.value).toEqual([]);
  });

  it("refuses to send without a key, offline, or while generating", async () => {
    store.updateProviderApiKey("gemini", "");
    store.currentQuery.value = "hello";
    await chat.submitMessage();
    expect(chat.chatError.value).toMatch(/No API key for Google Gemini/);
    expect(store.currentQuery.value).toBe("hello");
    expect(streams).toHaveLength(0);

    store.updateProviderApiKey("gemini", "g-key");
    store.isOnline.value = false;
    await chat.submitMessage();
    expect(chat.chatError.value).toMatch(/offline/);

    store.isOnline.value = true;
    const { done, stream } = await send("first");
    store.currentQuery.value = "second";
    await chat.submitMessage();
    expect(streams).toHaveLength(1);
    expect(store.currentQuery.value).toBe("second");
    stream.finish();
    await done;
  });

  it("handles slash commands without calling the model", async () => {
    store.currentQuery.value = "/system Be brief";
    await chat.submitMessage();
    expect(store.systemPrompt.value).toBe("Be brief");
    expect(store.currentQuery.value).toBe("");

    store.currentQuery.value = "/help";
    await chat.submitMessage();
    expect(store.isShortcutsHelpOpen.value).toBe(true);

    store.currentQuery.value = "/system";
    await chat.submitMessage();
    expect(chat.chatError.value).toMatch(/Usage/);
    expect(streams).toHaveLength(0);
  });
});

describe("regenerateMessage", () => {
  async function answered() {
    const { done, stream } = await send("question");
    stream.emit("first answer");
    stream.finish();
    await done;
    return store.currentMessages.value[1].id;
  }

  it("adds a version and keeps the original answer", async () => {
    const assistantId = await answered();
    const regen = chat.regenerateMessage(assistantId);
    const stream = await nextStream();
    expect(stream.args.history).toEqual([]);
    stream.emit("second answer");
    stream.finish();
    await regen;

    expect(store.currentMessages.value[1].content).toBe("second answer");
    expect(store.chatHistory.value[0].messages[1].content).toBe("first answer");
    expect(store.getMessageVersions(1)).toMatchObject({ current: 1 });
  });

  it("discards the empty version and returns to the previous answer on failure", async () => {
    const assistantId = await answered();
    const regen = chat.regenerateMessage(assistantId);
    const stream = await nextStream();
    stream.fail("Rate limit exceeded (429). Please wait a moment and try again.");
    await regen;

    expect(store.chatHistory.value[0].branches).toEqual([]);
    expect(store.activeBranchId.value).toBeNull();
    expect(store.currentMessages.value[1].content).toBe("first answer");
    expect(chat.chatError.value).toMatch(/Rate limit/);

    // "Try again" works because the original message id is valid again.
    const retry = chat.retryLast();
    const retryStream = await nextStream();
    retryStream.emit("second answer");
    retryStream.finish();
    await retry;
    expect(store.currentMessages.value[1].content).toBe("second answer");
  });
});
