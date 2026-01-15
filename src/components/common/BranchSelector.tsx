import {
    activeSessionId,
    switchToBranch,
    getBranchesForSession,
    getCurrentBranchInfo,
} from "../../stores/appStore";
import { ChevronLeftIcon, ChevronRightIcon, BranchIcon } from "../icons";

interface BranchSelectorProps {
    className?: string;
}

export function BranchSelector({ className = "" }: BranchSelectorProps) {
    const sessionId = activeSessionId.value;
    if (!sessionId) return null;

    const branches = getBranchesForSession(sessionId);
    const branchInfo = getCurrentBranchInfo(sessionId);

    // Only show if there are multiple branches
    if (branches.length <= 1) return null;

    const handlePrev = () => {
        if (branchInfo.index > 0) {
            const prevBranch = branches[branchInfo.index - 1];
            switchToBranch(sessionId, prevBranch.id);
        }
    };

    const handleNext = () => {
        if (branchInfo.index < branches.length - 1) {
            const nextBranch = branches[branchInfo.index + 1];
            switchToBranch(sessionId, nextBranch.id);
        }
    };

    return (
        <div className={`flex items-center gap-1 ${className}`}>
            <button
                onClick={handlePrev}
                disabled={branchInfo.index === 0}
                className="p-1 rounded hover:bg-bg-tertiary disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                title="Previous branch"
            >
                <ChevronLeftIcon size={14} className="text-text-secondary" />
            </button>

            <div className="flex items-center gap-1 px-1.5 py-0.5 bg-bg-tertiary rounded text-xs text-text-secondary min-w-[3rem] justify-center">
                <BranchIcon size={10} />
                <span>{branchInfo.index + 1}/{branchInfo.total}</span>
            </div>

            <button
                onClick={handleNext}
                disabled={branchInfo.index === branches.length - 1}
                className="p-1 rounded hover:bg-bg-tertiary disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                title="Next branch"
            >
                <ChevronRightIcon size={14} className="text-text-secondary" />
            </button>
        </div>
    );
}
