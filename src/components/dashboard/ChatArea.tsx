import { useState, useRef, useEffect } from "preact/hooks";
import {
  activeSpace,
  activeModel,
  activeConversation,
  isGenerating,
  streamingContent,
  createConversation,
  addMessage,
  activeConversationId,
  activeSpaceId,
} from "../../stores/appStore";
import {
  SendIcon,
  SpinnerIcon,
  CopyIcon,
  RefreshIcon,
  ThumbsUpIcon,
  ThumbsDownIcon,
  ChevronDownIcon,
  LogoIcon,
  PlusIcon,
} from "../icons";
import { clsx } from "clsx";

export function ChatArea() {
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [activeConversation.value?.messages, streamingContent.value]);

  const handleSubmit = async () => {
    if (!input.trim() || isGenerating.value) return;

    let conversationId = activeConversationId.value;
    if (!conversationId) {
      const conv = createConversation(activeSpaceId.value);
      conversationId = conv.id;
    }

    const userMessage = {
      id: crypto.randomUUID(),
      role: "user" as const,
      content: input.trim(),
      timestamp: new Date().toISOString(),
    };
    addMessage(conversationId, userMessage);
    setInput("");

    isGenerating.value = true;
    streamingContent.value = "";

    // Simulate AI response
    const mockResponse = `Based on the documents in your "${activeSpace.value?.name}" space, I found relevant information regarding your question.

Here's a comprehensive analysis:

**Key Points:**
1. The main topic you asked about is well-documented across multiple sources
2. There are several supporting facts that corroborate the main findings
3. Some additional context helps understand the broader implications

**Detailed Findings:**
The analysis reveals that the subject matter is extensively covered in your indexed documents. The primary sources indicate a strong consensus on the main points, while secondary sources provide valuable supplementary information.

Would you like me to elaborate on any specific aspect of this response?`;

    for (let i = 0; i < mockResponse.length; i++) {
      await new Promise((resolve) => setTimeout(resolve, 8));
      streamingContent.value = mockResponse.slice(0, i + 1);
    }

    const assistantMessage = {
      id: crypto.randomUUID(),
      role: "assistant" as const,
      content: mockResponse,
      timestamp: new Date().toISOString(),
      sources: [
        { documentId: "doc1", page: 5, text: "Relevant excerpt..." },
        { documentId: "doc2", page: 12, text: "Another excerpt..." },
      ],
    };
    addMessage(conversationId, assistantMessage);
    streamingContent.value = "";
    isGenerating.value = false;
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const messages = activeConversation.value?.messages || [];

  return (
    <div className="flex-1 flex flex-col h-full bg-bg-primary">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border">
        <div className="flex items-center gap-3">
          <span className="text-text-secondary">{activeSpace.value?.name}</span>
          <span className="text-text-tertiary">/</span>
          <span className="text-text-primary font-medium">
            {activeConversation.value?.title || "New Conversation"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-1.5 px-3 py-1.5 bg-bg-secondary rounded-lg text-sm text-text-secondary hover:text-text-primary transition-colors">
            {activeModel.value}
            <ChevronDownIcon size={14} />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto">
        {messages.length === 0 && !streamingContent.value ? (
          <div className="h-full flex flex-col items-center justify-center text-center px-4">
            <LogoIcon size={48} className="text-accent-primary mb-4" />
            <h2 className="text-xl font-semibold text-text-primary mb-2">
              Start a conversation
            </h2>
            <p className="text-text-secondary max-w-md mb-6">
              Ask questions about your documents in the "{activeSpace.value?.name}" space.
              Add documents using the panel on the right.
            </p>
            <div className="flex flex-wrap gap-2 justify-center max-w-lg">
              {[
                "Summarize my documents",
                "What are the key findings?",
                "Compare the main themes",
                "Extract action items",
              ].map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => setInput(suggestion)}
                  className="px-3 py-2 bg-bg-secondary rounded-lg text-sm text-text-secondary hover:bg-bg-tertiary hover:text-text-primary transition-colors"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="py-6">
            {messages.map((message) => (
              <MessageBubble key={message.id} message={message} />
            ))}
            {streamingContent.value && (
              <div className="px-6 py-4">
                <div className="flex gap-4 max-w-3xl mx-auto">
                  <div className="w-8 h-8 rounded-lg bg-accent-primary flex items-center justify-center flex-shrink-0">
                    <LogoIcon size={18} className="text-white" />
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-medium text-text-primary mb-1">
                      OmniRecall
                    </div>
                    <div className="text-text-primary whitespace-pre-wrap">
                      {streamingContent.value}
                      <span className="inline-block w-2 h-4 bg-accent-primary ml-0.5 animate-pulse-subtle" />
                    </div>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="border-t border-border p-4">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-end gap-3 bg-bg-secondary rounded-xl p-3">
            <button className="p-2 rounded-lg hover:bg-bg-tertiary transition-colors text-text-tertiary hover:text-text-primary">
              <PlusIcon size={20} />
            </button>
            <textarea
              ref={inputRef}
              value={input}
              onInput={(e) => setInput((e.target as HTMLTextAreaElement).value)}
              onKeyDown={handleKeyDown}
              placeholder="Type your message..."
              className="flex-1 bg-transparent text-text-primary placeholder:text-text-tertiary resize-none outline-none text-base min-h-[24px] max-h-[200px]"
              rows={1}
              disabled={isGenerating.value}
            />
            <button
              onClick={handleSubmit}
              disabled={!input.trim() || isGenerating.value}
              className={clsx(
                "p-2 rounded-lg transition-all",
                input.trim() && !isGenerating.value
                  ? "bg-accent-primary text-white hover:bg-accent-primary/90"
                  : "bg-bg-tertiary text-text-tertiary cursor-not-allowed"
              )}
            >
              {isGenerating.value ? (
                <SpinnerIcon size={20} />
              ) : (
                <SendIcon size={20} />
              )}
            </button>
          </div>
          <div className="text-xs text-text-tertiary text-center mt-2">
            Press Enter to send, Shift+Enter for new line
          </div>
        </div>
      </div>
    </div>
  );
}

interface MessageBubbleProps {
  message: {
    id: string;
    role: "user" | "assistant" | "system";
    content: string;
    timestamp: string;
    sources?: { documentId: string; page: number; text: string }[];
  };
}

function MessageBubble({ message }: MessageBubbleProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isUser = message.role === "user";

  return (
    <div className={clsx("px-6 py-4", isUser ? "bg-bg-secondary/50" : "")}>
      <div className="flex gap-4 max-w-3xl mx-auto">
        <div
          className={clsx(
            "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0",
            isUser ? "bg-bg-tertiary" : "bg-accent-primary"
          )}
        >
          {isUser ? (
            <span className="text-sm font-medium text-text-primary">U</span>
          ) : (
            <LogoIcon size={18} className="text-white" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-text-primary mb-1">
            {isUser ? "You" : "OmniRecall"}
            <span className="text-text-tertiary font-normal ml-2">
              {new Date(message.timestamp).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          </div>
          <div className="text-text-primary whitespace-pre-wrap">
            {message.content}
          </div>

          {/* Sources */}
          {message.sources && message.sources.length > 0 && (
            <div className="mt-3 pt-3 border-t border-border">
              <div className="text-xs text-text-tertiary mb-2">Sources</div>
              <div className="flex flex-wrap gap-2">
                {message.sources.map((source, i) => (
                  <button
                    key={i}
                    className="px-2 py-1 bg-bg-tertiary rounded text-xs text-text-secondary hover:text-text-primary transition-colors"
                  >
                    [{i + 1}] Page {source.page}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          {!isUser && (
            <div className="flex items-center gap-1 mt-3">
              <button
                onClick={handleCopy}
                className="p-1.5 rounded hover:bg-bg-tertiary transition-colors text-text-tertiary hover:text-text-primary"
                title="Copy"
              >
                <CopyIcon size={14} />
              </button>
              <button
                className="p-1.5 rounded hover:bg-bg-tertiary transition-colors text-text-tertiary hover:text-text-primary"
                title="Regenerate"
              >
                <RefreshIcon size={14} />
              </button>
              <button
                className="p-1.5 rounded hover:bg-bg-tertiary transition-colors text-text-tertiary hover:text-text-primary"
                title="Good response"
              >
                <ThumbsUpIcon size={14} />
              </button>
              <button
                className="p-1.5 rounded hover:bg-bg-tertiary transition-colors text-text-tertiary hover:text-text-primary"
                title="Bad response"
              >
                <ThumbsDownIcon size={14} />
              </button>
              {copied && (
                <span className="text-xs text-accent-primary ml-2">Copied!</span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
