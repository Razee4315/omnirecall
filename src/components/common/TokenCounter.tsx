import { estimateTokens, currentSessionTokenCount, currentMessages } from "../../stores/appStore";
import { TokenIcon } from "../icons";

interface TokenCounterProps {
    className?: string;
    showDetails?: boolean;
}

export function TokenCounter({ className = "", showDetails = false }: TokenCounterProps) {
    const totalTokens = currentSessionTokenCount.value;

    // Format large numbers
    const formatTokens = (n: number): string => {
        if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
        if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
        return n.toString();
    };

    // Get color based on token count (relative to common context limits)
    const getTokenColor = (tokens: number): string => {
        if (tokens < 8000) return "text-success";
        if (tokens < 32000) return "text-warning";
        return "text-error";
    };

    if (!showDetails) {
        return (
            <div className={`flex items-center gap-1.5 ${className}`} title="Estimated token count">
                <TokenIcon size={14} className={getTokenColor(totalTokens)} />
                <span className={`text-xs ${getTokenColor(totalTokens)}`}>
                    {formatTokens(totalTokens)}
                </span>
            </div>
        );
    }

    // Calculate per-message stats
    const userTokens = currentMessages.value
        .filter(m => m.role === "user")
        .reduce((sum, m) => sum + estimateTokens(m.content), 0);

    const assistantTokens = currentMessages.value
        .filter(m => m.role === "assistant")
        .reduce((sum, m) => sum + estimateTokens(m.content), 0);

    return (
        <div className={`flex flex-col gap-1 ${className}`}>
            <div className="flex items-center gap-2">
                <TokenIcon size={16} className={getTokenColor(totalTokens)} />
                <span className={`text-sm font-medium ${getTokenColor(totalTokens)}`}>
                    {formatTokens(totalTokens)} tokens
                </span>
            </div>
            <div className="flex items-center gap-4 text-xs text-text-tertiary">
                <span>You: {formatTokens(userTokens)}</span>
                <span>AI: {formatTokens(assistantTokens)}</span>
                <span>Messages: {currentMessages.value.length}</span>
            </div>
        </div>
    );
}

// Inline token badge for individual messages
interface MessageTokenBadgeProps {
    content: string;
}

export function MessageTokenBadge({ content }: MessageTokenBadgeProps) {
    const tokens = estimateTokens(content);

    if (tokens < 10) return null; // Don't show for very short messages

    return (
        <span
            className="text-xs text-text-tertiary/60 ml-2"
            title="Estimated tokens"
        >
            ~{tokens} tokens
        </span>
    );
}
