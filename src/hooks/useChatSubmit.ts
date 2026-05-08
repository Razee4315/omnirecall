import { useRef, useCallback } from "preact/hooks";
import { invoke } from "@tauri-apps/api/core";
import { listen, UnlistenFn } from "@tauri-apps/api/event";
import {
  activeModel,
  activeProvider,
  providers,
  isGenerating,
  currentQuery,
  activeSessionId,
  activeBranchId,
  currentMessages,
  addChatSession,
  updateChatSession,
  updateBranchMessages,
  saveChatHistoryNow,
  ChatMessage,
  ChatSession,
  estimateTokens,
  systemPrompt,
  stopGeneration,
} from "../stores/appStore";

/// If we don't see a stream chunk for this long, assume the connection is
/// dead and surface an error rather than leaving the user staring at a
/// blinking cursor forever.
const CHUNK_IDLE_TIMEOUT_MS = 60_000;

interface DocumentWithContent {
  name: string;
  content?: string;
}

/// Hard cap on a single user message. The actual model context window is
/// far smaller than this, but we use the cap as a frontline guard against
/// pasted megabytes of text (which would freeze the textarea). The error
/// message points the user toward the document feature for large content.
export const MAX_MESSAGE_CHARS = 200_000;

// Parse and simplify API error messages for user display
export function parseApiError(err: any): string {
  const rawMessage = err?.message || err?.toString() || "Failed to get response";

  // Rate limit / quota errors
  if (rawMessage.includes("429") || rawMessage.includes("quota") || rawMessage.includes("RESOURCE_EXHAUSTED")) {
    return "Rate limit exceeded. Please wait a moment and try again.";
  }

  // Authentication errors
  if (rawMessage.includes("401") || rawMessage.includes("unauthorized") || rawMessage.includes("invalid_api_key")) {
    return "Invalid API key. Please check your settings.";
  }

  // Model not found
  if (rawMessage.includes("404") || rawMessage.includes("model not found")) {
    return "Model not found. Please select a different model.";
  }

  // Context too long
  if (rawMessage.includes("context_length") || rawMessage.includes("too long") || rawMessage.includes("max tokens")) {
    return "Message too long. Try shortening your input or clearing some context.";
  }

  // Network/connection errors
  if (rawMessage.includes("network") || rawMessage.includes("ECONNREFUSED") || rawMessage.includes("timeout")) {
    return "Connection failed. Check your internet connection.";
  }

  // If message is super long, truncate it
  if (rawMessage.length > 150) {
    const match = rawMessage.match(/message["']?\s*[:=]\s*["']([^"']+)["']/i);
    if (match) return match[1].slice(0, 100);
    return rawMessage.slice(0, 100) + "...";
  }

  return rawMessage;
}

export function useChatSubmit(
  docsWithContent: DocumentWithContent[],
  setError: (err: string | null) => void,
) {
  const unlistenRef = useRef<UnlistenFn | null>(null);
  const streamingContentRef = useRef("");
  const throttleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clean up stream listener
  const cleanupStream = useCallback(() => {
    if (unlistenRef.current) {
      unlistenRef.current();
      unlistenRef.current = null;
    }
    if (throttleTimerRef.current) {
      clearTimeout(throttleTimerRef.current);
      throttleTimerRef.current = null;
    }
    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current);
      idleTimerRef.current = null;
    }
    streamingContentRef.current = "";
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!currentQuery.value.trim() || isGenerating.value) return;

    if (currentQuery.value.length > MAX_MESSAGE_CHARS) {
      setError(
        `Message is too long (${currentQuery.value.length.toLocaleString()} characters). ` +
        `Maximum is ${MAX_MESSAGE_CHARS.toLocaleString()}. ` +
        `For larger content, add it as a document instead.`,
      );
      return;
    }

    const provider = providers.value.find(p => p.id === activeProvider.value);
    if (!provider?.apiKey && provider?.id !== "ollama") {
      setError(
        `No API key for ${provider?.name ?? activeProvider.value}. Open Settings (Ctrl+,) to add one.`,
      );
      return;
    }

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: currentQuery.value,
      tokenCount: estimateTokens(currentQuery.value),
    };

    const newMessages = [...currentMessages.value, userMessage];
    currentMessages.value = newMessages;
    const query = currentQuery.value;
    currentQuery.value = "";
    isGenerating.value = true;
    setError(null);

    // Create placeholder for assistant message
    const assistantId = crypto.randomUUID();
    const assistantMessage: ChatMessage = {
      id: assistantId,
      role: "assistant",
      content: "",
      tokenCount: 0,
    };
    currentMessages.value = [...newMessages, assistantMessage];

    // Capture the session/branch context at submit time. If the user
    // navigates away mid-stream we drop the update on the floor instead of
    // mutating whatever they're now looking at.
    const submitSessionId = activeSessionId.value;
    const submitBranchId = activeBranchId.value;

    try {
      const history = newMessages.slice(0, -1).map(m => ({ role: m.role, content: m.content }));
      const documentContext = docsWithContent
        .filter(d => d.content && d.content.length > 0)
        .map(d => ({ name: d.name, content: d.content! }));

      streamingContentRef.current = "";

      const stillOnSameThread = () => (
        activeSessionId.value === submitSessionId &&
        activeBranchId.value === submitBranchId
      );

      // Locate the assistant message by id rather than a captured index.
      // If a regenerate / branch / new chat shifts indices we must not
      // overwrite the wrong message.
      const findAssistantIndex = (msgs: ChatMessage[]) =>
        msgs.findIndex(m => m.id === assistantId);

      // Throttled UI update - only update DOM every 80ms during streaming
      const flushStreamUpdate = () => {
        if (!stillOnSameThread()) return;
        const msgs = currentMessages.value;
        const idx = findAssistantIndex(msgs);
        if (idx === -1) return;
        const next = [...msgs];
        next[idx] = { ...next[idx], content: streamingContentRef.current };
        currentMessages.value = next;
      };

      const armIdleTimer = () => {
        if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
        idleTimerRef.current = setTimeout(() => {
          // No chunk in CHUNK_IDLE_TIMEOUT_MS - tell the backend to drop
          // the connection and surface a friendly error.
          stopGeneration();
          cleanupStream();
          isGenerating.value = false;
          setError("Connection stalled. The AI provider stopped responding. Please try again.");
        }, CHUNK_IDLE_TIMEOUT_MS);
      };

      armIdleTimer();

      unlistenRef.current = await listen<{ chunk: string; done: boolean }>("chat-stream", (event) => {
        if (!event.payload.done) {
          streamingContentRef.current += event.payload.chunk;
          armIdleTimer();

          // Throttle UI updates to every 80ms instead of every chunk
          if (!throttleTimerRef.current) {
            throttleTimerRef.current = setTimeout(() => {
              throttleTimerRef.current = null;
              flushStreamUpdate();
            }, 80);
          }
        } else {
          // Stream complete - final flush with token count
          if (throttleTimerRef.current) {
            clearTimeout(throttleTimerRef.current);
            throttleTimerRef.current = null;
          }
          if (idleTimerRef.current) {
            clearTimeout(idleTimerRef.current);
            idleTimerRef.current = null;
          }

          const finalContent = streamingContentRef.current;
          const sameThread = stillOnSameThread();

          if (sameThread) {
            const msgs = currentMessages.value;
            const idx = findAssistantIndex(msgs);
            if (idx !== -1) {
              const next = [...msgs];
              next[idx] = {
                ...next[idx],
                content: finalContent,
                tokenCount: estimateTokens(finalContent),
              };
              currentMessages.value = next;
            }
          }

          isGenerating.value = false;
          cleanupStream();

          // Persist regardless of whether the user is still looking at
          // this thread — they may come back. Write to the captured
          // session/branch, not the current one.
          if (!submitSessionId) {
            // First message in a fresh chat: only create a session if we
            // actually have content. Empty stream completions (network
            // failure, provider returns nothing) shouldn't litter the
            // sidebar with empty conversations.
            if (finalContent.trim().length > 0) {
              const messagesToSave = sameThread
                ? currentMessages.value
                : [
                    ...newMessages,
                    { ...assistantMessage, content: finalContent, tokenCount: estimateTokens(finalContent) },
                  ];
              const newSession: ChatSession = {
                id: crypto.randomUUID(),
                title: userMessage.content.slice(0, 30) + (userMessage.content.length > 30 ? "..." : ""),
                messages: messagesToSave,
                branches: [],
                branchMessages: {},
                createdAt: new Date().toISOString(),
                folderId: null,
              };
              addChatSession(newSession);
              if (sameThread) {
                activeSessionId.value = newSession.id;
              }
            }
          } else if (sameThread) {
            if (submitBranchId) {
              updateBranchMessages(submitSessionId, submitBranchId, currentMessages.value);
            } else {
              updateChatSession(submitSessionId, currentMessages.value);
            }
            saveChatHistoryNow();
          }
        }
      });

      // Start streaming
      await invoke("send_message_stream", {
        message: query,
        history,
        documents: documentContext,
        provider: activeProvider.value,
        model: activeModel.value,
        apiKey: provider?.apiKey || "",
        systemPrompt: systemPrompt.value.trim() || null,
      });

    } catch (err: any) {
      setError(parseApiError(err));
      isGenerating.value = false;
      cleanupStream();
    }
  }, [docsWithContent, setError, cleanupStream]);

  return { handleSubmit, cleanupStream };
}
