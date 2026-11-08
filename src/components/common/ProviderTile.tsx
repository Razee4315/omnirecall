import { providerMeta } from "../../lib/models";

/// A provider's monogram in its brand-tinted tile.
export function ProviderTile({ providerId, size = 20, className = "" }: { providerId: string; size?: number; className?: string }) {
  const meta = providerMeta(providerId);
  return (
    <span
      aria-hidden="true"
      className={`inline-flex items-center justify-center flex-shrink-0 font-semibold leading-none ${className}`}
      style={{
        width: size,
        height: size,
        borderRadius: Math.max(4, Math.round(size * 0.28)),
        background: meta.tile,
        color: meta.tileFg,
        fontSize: Math.round(size * 0.5),
        boxShadow: "0 1px 0 rgba(255,255,255,0.22) inset, 0 0 0 1px rgba(0,0,0,0.06)",
      }}
    >
      {meta.monogram}
    </span>
  );
}
