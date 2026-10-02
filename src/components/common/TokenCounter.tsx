import { activeModel, contextTokens, contextUsageFraction, getContextWindow } from "../../stores/appStore";
import { TokenIcon } from "../icons";

function formatTokens(n: number): string {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
    return n.toString();
}

/// How much of the active model's context window the next request will use
/// (conversation, system prompt and attached documents).
export function TokenCounter() {
    const windowTokens = getContextWindow(activeModel.value);
    const fraction = contextUsageFraction.value;
    const pct = Math.min(100, Math.round(fraction * 100));

    // Color + level are driven by usage relative to the active model's window,
    // not absolute counts. The level word makes the state non-color-only.
    const level = fraction < 0.6 ? "ok" : fraction < 0.85 ? "high" : "very-high";
    const color = level === "ok" ? "text-success" : level === "high" ? "text-warning" : "text-error";
    const label =
        `Context usage ${pct}% — about ${formatTokens(contextTokens.value)} of ${formatTokens(windowTokens)} tokens, including documents and the system prompt` +
        (level === "ok" ? "" : level === "high" ? ". High usage" : ". Very high usage — older messages will be left out; consider a new chat");

    return (
        <div className="flex items-center gap-1 flex-shrink-0" title={label} aria-label={label} role="status">
            <TokenIcon size={14} className={color} />
            <span className={`text-xs ${color}`}>{pct}%</span>
        </div>
    );
}
