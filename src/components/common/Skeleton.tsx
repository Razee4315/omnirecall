// Skeleton loading components with shimmer animation

interface SkeletonProps {
    className?: string;
}

// Base shimmer animation wrapper
function ShimmerWrapper({ children, className = "", style }: { children: preact.ComponentChildren; className?: string; style?: preact.JSX.CSSProperties }) {
    return (
        <div className={`relative overflow-hidden ${className}`} style={style}>
            {children}
            <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/10 to-transparent" />
        </div>
    );
}

// Text line skeleton
export function SkeletonText({ className = "" }: SkeletonProps) {
    return (
        <ShimmerWrapper className={`h-3 bg-bg-tertiary rounded ${className}`}>
            <div className="invisible">placeholder</div>
        </ShimmerWrapper>
    );
}

// Avatar/icon skeleton
export function SkeletonAvatar({ size = 32, className = "" }: { size?: number; className?: string }) {
    return (
        <ShimmerWrapper
            className={`bg-bg-tertiary rounded-full ${className}`}
            style={{ width: size, height: size }}
        >
            <div />
        </ShimmerWrapper>
    );
}

// Card skeleton
export function SkeletonCard({ className = "" }: SkeletonProps) {
    return (
        <ShimmerWrapper className={`bg-bg-tertiary rounded-lg ${className}`}>
            <div className="p-4 space-y-3">
                <div className="h-4 bg-bg-secondary/50 rounded w-3/4" />
                <div className="h-3 bg-bg-secondary/50 rounded w-full" />
                <div className="h-3 bg-bg-secondary/50 rounded w-2/3" />
            </div>
        </ShimmerWrapper>
    );
}

// Chat message skeleton - mimics the shape of a chat bubble
export function ChatMessageSkeleton({ isUser = false }: { isUser?: boolean }) {
    return (
        <div className={`flex ${isUser ? "justify-end" : "justify-start"} animate-fade-in`}>
            <ShimmerWrapper className={`max-w-[80%] rounded-lg px-4 py-3 ${isUser ? "bg-accent-primary/20" : "bg-bg-tertiary"
                }`}>
                <div className="space-y-2">
                    <div className="h-3 bg-bg-secondary/30 rounded w-48" />
                    <div className="h-3 bg-bg-secondary/30 rounded w-36" />
                    {!isUser && <div className="h-3 bg-bg-secondary/30 rounded w-24" />}
                </div>
            </ShimmerWrapper>
        </div>
    );
}

// Document list item skeleton
export function DocumentSkeleton() {
    return (
        <ShimmerWrapper className="flex items-center gap-2 px-2 py-1.5 rounded">
            <div className="w-4 h-4 bg-bg-secondary/50 rounded" />
            <div className="flex-1">
                <div className="h-3 bg-bg-secondary/50 rounded w-3/4" />
            </div>
        </ShimmerWrapper>
    );
}

// Chat history item skeleton
export function ChatHistorySkeleton() {
    return (
        <ShimmerWrapper className="px-2 py-2 rounded-lg">
            <div className="h-4 bg-bg-secondary/30 rounded w-4/5" />
        </ShimmerWrapper>
    );
}

// Multiple document skeletons
export function DocumentListSkeleton({ count = 3 }: { count?: number }) {
    return (
        <div className="space-y-1">
            {Array.from({ length: count }).map((_, i) => (
                <DocumentSkeleton key={i} />
            ))}
        </div>
    );
}

// Loading state for chat area
export function ChatLoadingSkeleton() {
    return (
        <div className="p-4 space-y-4">
            <ChatMessageSkeleton isUser={true} />
            <ChatMessageSkeleton isUser={false} />
            <ChatMessageSkeleton isUser={true} />
            <ChatMessageSkeleton isUser={false} />
        </div>
    );
}
