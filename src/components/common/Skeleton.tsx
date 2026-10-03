// Skeleton placeholders with a shimmer animation

function DocumentSkeleton() {
    return (
        <div className="relative overflow-hidden flex items-center gap-2 px-2 py-1.5 rounded">
            <div className="w-4 h-4 bg-bg-tertiary rounded" />
            <div className="flex-1">
                <div className="h-3 bg-bg-tertiary rounded w-3/4" />
            </div>
            <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/10 to-transparent" />
        </div>
    );
}

/// Placeholder rows shown while document status is first loading.
export function DocumentListSkeleton({ count = 3 }: { count?: number }) {
    return (
        <div className="space-y-1" role="status" aria-label="Loading documents">
            {Array.from({ length: count }).map((_, i) => (
                <DocumentSkeleton key={i} />
            ))}
        </div>
    );
}
