import { activeModel, contextTokens, contextUsageFraction, getContextWindow } from "../../stores/appStore";

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 100_000 ? 0 : 1)}K`;
  return n.toString();
}

/// A small ring gauge: how much of the active model's context window the next
/// request will use (conversation, system prompt and attached documents).
export function TokenCounter({ showLabel = false }: { showLabel?: boolean }) {
  const windowTokens = getContextWindow(activeModel.value);
  const fraction = contextUsageFraction.value;
  const pct = Math.min(100, Math.round(fraction * 100));

  // The level word keeps the state from being color-only.
  const level = fraction < 0.6 ? "ok" : fraction < 0.85 ? "high" : "very-high";
  const stroke = level === "ok" ? "var(--accent)" : level === "high" ? "var(--warning)" : "var(--danger)";
  const label =
    `Context ${pct}% used — about ${formatTokens(contextTokens.value)} of ${formatTokens(windowTokens)} tokens, including documents and the system prompt` +
    (level === "ok" ? "" : level === "high" ? ". High usage" : ". Very high usage — older messages will be left out; consider a new chat");

  const r = 6;
  const circumference = 2 * Math.PI * r;
  // Show a sliver even at 0-1% so the ring reads as a gauge.
  const visible = Math.max(fraction, 0.02);

  return (
    <div
      className="inline-flex items-center gap-1.5 h-7 px-1.5 rounded-lg text-fg-subtle hover:bg-surface-2 transition-colors flex-shrink-0"
      title={label}
      aria-label={label}
      role="status"
    >
      <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" className="-rotate-90">
        <circle cx="8" cy="8" r={r} fill="none" stroke="var(--line-strong)" strokeWidth="2" />
        <circle
          cx="8"
          cy="8"
          r={r}
          fill="none"
          stroke={stroke}
          strokeWidth="2"
          strokeLinecap="round"
          strokeDasharray={`${Math.min(1, visible) * circumference} ${circumference}`}
          style={{ transition: "stroke-dasharray 0.4s ease" }}
        />
      </svg>
      <span className={`text-2xs tabular-nums ${level === "ok" ? "" : level === "high" ? "text-warning" : "text-danger"} ${showLabel ? "" : "sr-only"}`}>
        {pct}%
      </span>
    </div>
  );
}
