import { signal } from "@preact/signals";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import {
  activeBranchId,
  activeModel,
  activeProvider,
  activeSessionId,
  activeStreamId,
  addChatSession,
  ChatMessage,
  ChatSession,
  contextTokens,
  createRegenerationBranch,
  currentMessages,
  currentQuery,
  deleteBranch,
  docsEnabled,
  documentRequestArgs,
  getContextWindow,
  isGenerating,
  isOnline,
  isShortcutsHelpOpen,
  providers,
  saveChatHistoryNow,
  setSystemPrompt,
  startNewChat,
  switchToBranch,
  systemPrompt,
  threadEpoch,
  updateThreadMessages,
} from "./appStore";
import { toast } from "./toastStore";
import { parseApiError } from "../lib/errors";
import { estimateTokens, trimHistory } from "../lib/history";

/// If we don't see a stream chunk for this long, assume the connection is
/// dead and surface an error rather than leaving the user staring at a
/// blinking cursor forever. Local models can take a while to load, so they
/// get longer.
const CHUNK_IDLE_TIMEOUT_MS = 60_000;
const LOCAL_CHUNK_IDLE_TIMEOUT_MS = 180_000;
/// How often streamed text is painted.
const STREAM_PAINT_INTERVAL_MS = 80;
/// Share of the model's context window a request may fill, leaving room for
/// the answer.
const CONTEXT_FILL_LIMIT = 0.75;
const MIN_HISTORY_TOKENS = 2_000;

/// Hard cap on a single user message. The actual model context window is
/// far smaller than this, but we use the cap as a frontline guard against
/// pasted megabytes of text (which would freeze the textarea). The error
/// message points the user toward the document feature for large content.
export const MAX_MESSAGE_CHARS = 200_000;

/// Error shown above the composer. Lives here rather than in a component so
/// it survives switching between Spotlight and the Dashboard mid-request.
export const chatError = signal<string | null>(null);

interface StreamResult {
  stopped: boolean;
  sources: string[];
  contextMode: string;
}

/// What "Try again" should redo after a failure.
type LastSend =
  | { kind: "submit"; message: string }
  | { kind: "regenerate"; assistantMessageId: string };

let lastSend: LastSend | null = null;

export function canRetry(): boolean {
  return lastSend !== null;
}

/// Handle a slash command typed into the input. Returns true if the input was
/// consumed. Unrecognised commands return false and are sent to the model.
///
///   /clear, /new      - start a fresh chat
///   /help             - open the keyboard shortcuts overlay
///   /system <prompt>  - replace the persistent system prompt
function handleSlashCommand(input: string): boolean {
  const space = input.indexOf(" ");
  const cmd = (space === -1 ? input : input.slice(0, space)).toLowerCase();
  const arg = space === -1 ? "" : input.slice(space + 1).trim();

  switch (cmd) {
    case "/clear":
    case "/new":
      startNewChat();
      chatError.value = null;
      return true;
    case "/help":
      currentQuery.value = "";
      isShortcutsHelpOpen.value = true;
      return true;
    case "/system":
      if (!arg) {
        chatError.value = "Usage: /system <your system prompt>";
        return true;
      }
      setSystemPrompt(arg);
      currentQuery.value = "";
      chatError.value = null;
      toast.success("System prompt updated");
      return true;
    default:
      return false;
  }
}

interface SendRequest {
  /// Session and thread the turn belongs to (null session = unsaved chat).
  sessionId: string | null;
  branchId: string | null;
  /// The user message being answered.
  message: string;
  /// The thread up to and including that user message.
  baseMessages: ChatMessage[];
  providerId: string;
  model: string;
}

/// Send one turn and stream the answer into the thread. Resolves to whether
/// any answer text was received.
///
/// Each request has its own stream id: only events tagged with it are
/// applied, so a previous, stopped or concurrent stream can never write into
/// this message. Completion is the command resolving (or rejecting), and in
/// every outcome — finished, stopped, failed mid-way — whatever was received
/// is saved to the thread it was asked in, even if the user has since moved
/// to another chat.
async function runAssistantStream(request: SendRequest): Promise<boolean> {
  const { sessionId, branchId, message, baseMessages, providerId, model } = request;
  const provider = providers.value.find(p => p.id === providerId);
  const streamId = crypto.randomUUID();
  const assistantId = crypto.randomUUID();

  currentMessages.value = [...baseMessages, { id: assistantId, role: "assistant", content: "", tokenCount: 0, model }];
  // Captured after the placeholder is in place; any navigation bumps it.
  const epoch = threadEpoch.value;
  const onThread = () => threadEpoch.value === epoch;

  let content = "";
  let stalled = false;
  let paintTimer: ReturnType<typeof setTimeout> | null = null;
  let idleTimer: ReturnType<typeof setTimeout> | null = null;

  const paint = () => {
    paintTimer = null;
    if (!onThread()) return;
    currentMessages.value = currentMessages.value.map(m => (m.id === assistantId ? { ...m, content } : m));
  };

  const idleTimeout = providerId === "ollama" ? LOCAL_CHUNK_IDLE_TIMEOUT_MS : CHUNK_IDLE_TIMEOUT_MS;
  const armIdleTimer = () => {
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      stalled = true;
      invoke("stop_generation", { streamId }).catch(() => {});
    }, idleTimeout);
  };

  const unlisten = await listen<{ streamId: string; chunk: string }>("chat-stream", (event) => {
    if (event.payload.streamId !== streamId) return;
    content += event.payload.chunk;
    armIdleTimer();
    if (!paintTimer) paintTimer = setTimeout(paint, STREAM_PAINT_INTERVAL_MS);
  });

  // Everything before the user message, trimmed so the request leaves room
  // for the answer within the model's context window.
  const history = baseMessages.slice(0, -1).map(m => ({ role: m.role, content: m.content }));
  const fixedTokens = contextTokens.value - history.reduce((sum, m) => sum + estimateTokens(m.content), 0);
  const historyBudget = Math.max(
    MIN_HISTORY_TOKENS,
    Math.floor(getContextWindow(model) * CONTEXT_FILL_LIMIT) - fixedTokens,
  );

  activeStreamId.value = streamId;
  isGenerating.value = true;
  armIdleTimer();

  let result: StreamResult | null = null;
  let failure: unknown = null;
  try {
    result = await invoke<StreamResult>("send_message_stream", {
      streamId,
      message,
      history: trimHistory(history, historyBudget),
      ...documentRequestArgs(),
      provider: providerId,
      model,
      apiKey: provider?.apiKey ?? "",
      baseUrl: provider?.baseUrl || null,
      systemPrompt: systemPrompt.value.trim() || null,
    });
  } catch (err) {
    failure = err;
  } finally {
    unlisten();
    if (paintTimer) clearTimeout(paintTimer);
    if (idleTimer) clearTimeout(idleTimer);
    if (activeStreamId.value === streamId) activeStreamId.value = null;
    isGenerating.value = false;
  }

  const hasContent = content.trim().length > 0;
  const interrupted = failure !== null || stalled || result?.stopped === true;
  const answer: ChatMessage = {
    id: assistantId,
    role: "assistant",
    content,
    tokenCount: estimateTokens(content),
    model,
  };
  if (result && result.sources.length > 0) answer.sources = result.sources;
  if (interrupted) answer.interrupted = true;

  const finalMessages = hasContent ? [...baseMessages, answer] : baseMessages;
  if (onThread()) currentMessages.value = finalMessages;

  if (sessionId) {
    updateThreadMessages(sessionId, branchId, finalMessages);
    void saveChatHistoryNow();
  } else if (hasContent) {
    // First answer in a fresh chat: only now does it become a saved session,
    // so failed first sends don't litter the sidebar.
    const firstUser = baseMessages.find(m => m.role === "user")?.content ?? message;
    const now = new Date().toISOString();
    const session: ChatSession = {
      id: crypto.randomUUID(),
      title: firstUser.slice(0, 30) + (firstUser.length > 30 ? "..." : ""),
      messages: finalMessages,
      branches: [],
      branchMessages: {},
      createdAt: now,
      updatedAt: now,
      folderId: null,
      docsEnabled: docsEnabled.value,
    };
    addChatSession(session);
    if (onThread()) activeSessionId.value = session.id;
  }

  if (stalled) {
    chatError.value = "Connection stalled. The AI provider stopped responding. Please try again.";
  } else if (failure !== null) {
    chatError.value = parseApiError(failure);
  }
  // A partial answer is retried by regenerating it, not by re-sending the
  // user message after it.
  if ((stalled || failure !== null) && hasContent) {
    lastSend = { kind: "regenerate", assistantMessageId: assistantId };
  }

  return hasContent;
}

/// Why the given provider can't be used right now, or null if it can.
function providerProblem(providerId: string): string | null {
  const provider = providers.value.find(p => p.id === providerId);
  if (!provider?.apiKey && providerId !== "ollama") {
    return `No API key for ${provider?.name ?? providerId}. Open Settings (Ctrl+,) to add one.`;
  }
  // Cloud providers need connectivity; local Ollama doesn't.
  if (!isOnline.value && providerId !== "ollama") {
    return "You're offline. Reconnect, or switch to a local Ollama model.";
  }
  return null;
}

/// Send the composer's text as a new user message.
export async function submitMessage(): Promise<void> {
  const text = currentQuery.value;
  const trimmed = text.trim();
  if (!trimmed || isGenerating.value) return;

  // Slash commands. Handled before any provider/network checks so power
  // users can /clear or /help even with no API key configured.
  if (trimmed.startsWith("/") && handleSlashCommand(trimmed)) return;

  if (text.length > MAX_MESSAGE_CHARS) {
    chatError.value =
      `Message is too long (${text.length.toLocaleString()} characters). ` +
      `Maximum is ${MAX_MESSAGE_CHARS.toLocaleString()}. ` +
      `For larger content, add it as a document instead.`;
    return;
  }

  const problem = providerProblem(activeProvider.value);
  if (problem) {
    chatError.value = problem;
    return;
  }

  const userMessage: ChatMessage = {
    id: crypto.randomUUID(),
    role: "user",
    content: text,
    tokenCount: estimateTokens(text),
  };
  const baseMessages = [...currentMessages.value, userMessage];
  currentQuery.value = "";
  chatError.value = null;
  lastSend = { kind: "submit", message: text };

  await runAssistantStream({
    sessionId: activeSessionId.value,
    branchId: activeBranchId.value,
    message: text,
    baseMessages,
    providerId: activeProvider.value,
    model: activeModel.value,
  });
}

/// Regenerate an assistant reply as a new version alongside the existing one.
/// If nothing comes back, the empty version is discarded and the previous
/// answer is shown again.
export async function regenerateMessage(assistantMessageId: string): Promise<void> {
  const sessionId = activeSessionId.value;
  if (!sessionId || isGenerating.value) return;

  const index = currentMessages.value.findIndex(m => m.id === assistantMessageId);
  if (index <= 0) return;
  const userMessage = currentMessages.value[index - 1];
  if (userMessage.role !== "user") return;

  const problem = providerProblem(activeProvider.value);
  if (problem) {
    chatError.value = problem;
    return;
  }

  const previousBranch = activeBranchId.value;
  // Switches the view to the new version: a copy of the thread up to and
  // including the user message.
  const branchId = createRegenerationBranch(sessionId, userMessage.id);
  if (!branchId) return;

  chatError.value = null;
  lastSend = { kind: "regenerate", assistantMessageId };

  const epoch = threadEpoch.value;
  const answered = await runAssistantStream({
    sessionId,
    branchId,
    message: userMessage.content,
    baseMessages: currentMessages.value,
    providerId: activeProvider.value,
    model: activeModel.value,
  });

  if (!answered) {
    const stillThere = threadEpoch.value === epoch;
    deleteBranch(sessionId, branchId);
    if (stillThere) switchToBranch(sessionId, previousBranch);
  }
}

/// Retry the last send after a failure, without the user retyping anything.
export async function retryLast(): Promise<void> {
  const last = lastSend;
  if (!last || isGenerating.value) return;
  chatError.value = null;

  if (last.kind === "regenerate") {
    await regenerateMessage(last.assistantMessageId);
    return;
  }

  // The failed turn left its user message at the end of the thread; take it
  // back out so re-sending doesn't duplicate it.
  const messages = currentMessages.value;
  const tail = messages[messages.length - 1];
  if (tail?.role === "user" && tail.content === last.message) {
    currentMessages.value = messages.slice(0, -1);
  }
  currentQuery.value = last.message;
  await submitMessage();
}
