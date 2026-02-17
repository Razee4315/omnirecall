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
} from "../stores/appStore";

interface DocumentWithContent {
  name: string;
  content?: string;
}

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
    streamingContentRef.current = "";
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!currentQuery.value.trim() || isGenerating.value) return;

    const provider = providers.value.find(p => p.id === activeProvider.value);
    if (!provider?.apiKey && provider?.id !== "ollama") {
      setError("Please add your API key in Settings");
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

    try {
      const history = newMessages.slice(0, -1).map(m => ({ role: m.role, content: m.content }));
      const documentContext = docsWithContent
        .filter(d => d.content && d.content.length > 0)
        .map(d => ({ name: d.name, content: d.content! }));

      streamingContentRef.current = "";
      const assistantIdx = currentMessages.value.length - 1;

      // Throttled UI update - only update DOM every 80ms during streaming
      const flushStreamUpdate = () => {
        const content = streamingContentRef.current;
        const msgs = [...currentMessages.value];
        msgs[assistantIdx] = { ...msgs[assistantIdx], content };
        currentMessages.value = msgs;
      };

      unlistenRef.current = await listen<{ chunk: string; done: boolean }>("chat-stream", (event) => {
        if (!event.payload.done) {
          streamingContentRef.current += event.payload.chunk;

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

          const finalContent = streamingContentRef.current;
          const msgs = [...currentMessages.value];
          msgs[assistantIdx] = {
            ...msgs[assistantIdx],
            content: finalContent,
            tokenCount: estimateTokens(finalContent),
          };
          currentMessages.value = msgs;

          isGenerating.value = false;
          cleanupStream();

          // Save to chat history (immediate save on completion)
          const updatedMessages = currentMessages.value;
          if (!activeSessionId.value) {
            const newSession: ChatSession = {
              id: crypto.randomUUID(),
              title: userMessage.content.slice(0, 30) + (userMessage.content.length > 30 ? "..." : ""),
              messages: updatedMessages,
              branches: [],
              branchMessages: {},
              createdAt: new Date().toISOString(),
              folderId: null,
            };
            addChatSession(newSession);
            activeSessionId.value = newSession.id;
          } else {
            if (activeBranchId.value) {
              updateBranchMessages(activeSessionId.value, activeBranchId.value, updatedMessages);
            } else {
              updateChatSession(activeSessionId.value, updatedMessages);
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
      });

    } catch (err: any) {
      setError(parseApiError(err));
      isGenerating.value = false;
      cleanupStream();
    }
  }, [docsWithContent, setError, cleanupStream]);

  return { handleSubmit, cleanupStream };
}
