import { useState, useRef } from "preact/hooks";
import {
    isOnboardingActive,
    hasCompletedOnboarding,
    isSettingsOpen,
} from "../../stores/appStore";
import { useFocusTrap } from "../../hooks/useFocusTrap";
import { LogoIcon, ChevronDownIcon, CommandIcon } from "../icons";
import { toast } from "../../stores/toastStore";

interface OnboardingStep {
    id: string;
    title: string;
    description: string;
    icon: preact.JSX.Element;
    action?: () => void;
    actionLabel?: string;
}

const steps: OnboardingStep[] = [
    {
        id: "welcome",
        title: "Welcome to OmniRecall",
        description: "Your AI-powered assistant for intelligent document conversations. Let's get you set up in just a few steps.",
        icon: <LogoIcon size={48} className="text-accent-primary" />,
    },
    {
        id: "api-key",
        title: "Connect Your AI Provider",
        description: "Add an API key to start chatting. We support Gemini, OpenAI, Claude, and local Ollama models.",
        icon: (
            <div className="w-12 h-12 rounded-xl bg-accent-primary/20 flex items-center justify-center">
                <span className="text-2xl">🔑</span>
            </div>
        ),
        // Open Settings but keep the tour active so the user returns to it
        // after adding a key (previously this dismissed onboarding without
        // persisting completion, so the tour re-appeared every launch).
        action: () => { isSettingsOpen.value = true; },
        actionLabel: "Open Settings",
    },
    {
        id: "shortcuts",
        title: "Master the Shortcuts",
        description: "Speed up your workflow with keyboard shortcuts. Press ? anytime to see all available shortcuts.",
        icon: (
            <div className="w-12 h-12 rounded-xl bg-accent-secondary/20 flex items-center justify-center">
                <CommandIcon size={24} className="text-accent-secondary" />
            </div>
        ),
    },
    {
        id: "documents",
        title: "Add Your Documents",
        description: "Upload PDFs, code files, or markdown documents. OmniRecall will help you search and chat with your content.",
        icon: (
            <div className="w-12 h-12 rounded-xl bg-success/20 flex items-center justify-center">
                <span className="text-2xl">📄</span>
            </div>
        ),
    },
    {
        id: "complete",
        title: "You're All Set!",
        description: "Start chatting by typing a message. Use Alt+Space (or your custom hotkey) to open OmniRecall from anywhere.",
        icon: (
            <div className="w-12 h-12 rounded-xl bg-success/20 flex items-center justify-center">
                <span className="text-2xl">🚀</span>
            </div>
        ),
    },
];

export function Onboarding() {
    const [currentStep, setCurrentStep] = useState(0);
    const panelRef = useRef<HTMLDivElement>(null);
    // The tour steps aside while Settings is open (its "Open Settings" action
    // would otherwise open the modal underneath this overlay) and resumes on
    // the same step once Settings closes.
    const visible = isOnboardingActive.value && !isSettingsOpen.value;
    useFocusTrap(panelRef, visible, () => completeOnboarding());

    if (!visible) return null;

    const step = steps[currentStep];
    const isLastStep = currentStep === steps.length - 1;

    const handleNext = () => {
        if (isLastStep) {
            completeOnboarding();
        } else {
            setCurrentStep(currentStep + 1);
        }
    };

    const handleBack = () => {
        if (currentStep > 0) setCurrentStep(currentStep - 1);
    };

    const handleSkip = () => {
        completeOnboarding();
    };

    function completeOnboarding() {
        hasCompletedOnboarding.value = true;
        isOnboardingActive.value = false;
        toast.success("Welcome! Start by typing a message below.");

        // Persist onboarding completion
        localStorage.setItem("omnirecall_onboarding_complete", "true");
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] flex items-center justify-center animate-fade-in">
            <div
                ref={panelRef}
                role="dialog"
                aria-modal="true"
                aria-label="Getting started"
                className="w-full max-w-md bg-bg-primary border border-border rounded-2xl shadow-2xl overflow-hidden animate-scale-in"
            >
                {/* Progress dots */}
                <div className="flex items-center justify-center gap-2 pt-6">
                    {steps.map((_, idx) => (
                        <div
                            key={idx}
                            className={`w-2 h-2 rounded-full transition-all duration-300 ${idx === currentStep
                                    ? "bg-accent-primary w-6"
                                    : idx < currentStep
                                        ? "bg-accent-primary/50"
                                        : "bg-bg-tertiary"
                                }`}
                        />
                    ))}
                </div>

                {/* Content */}
                <div className="p-8 text-center">
                    <div className="flex justify-center mb-6">{step.icon}</div>
                    <h2 className="text-xl font-bold text-text-primary mb-3">{step.title}</h2>
                    <p className="text-sm text-text-secondary leading-relaxed">{step.description}</p>
                </div>

                {/* Actions */}
                <div className="px-8 pb-8 space-y-3">
                    {step.action && (
                        <button
                            onClick={step.action}
                            className="w-full py-3 px-4 rounded-xl border border-border text-text-primary font-medium hover:bg-bg-tertiary transition-colors"
                        >
                            {step.actionLabel}
                        </button>
                    )}
                    <button
                        onClick={handleNext}
                        className="w-full py-3 px-4 rounded-xl bg-accent-primary text-on-accent font-medium hover:bg-accent-primary/90 transition-colors flex items-center justify-center gap-2"
                    >
                        {isLastStep ? "Get Started" : "Continue"}
                        {!isLastStep && <ChevronDownIcon size={16} className="rotate-[-90deg]" />}
                    </button>

                    <div className="flex items-center justify-between pt-1">
                        {currentStep > 0 ? (
                            <button
                                onClick={handleBack}
                                className="text-sm text-text-tertiary hover:text-text-primary transition-colors"
                            >
                                Back
                            </button>
                        ) : (
                            <span />
                        )}
                        {!isLastStep && (
                            <button
                                onClick={handleSkip}
                                className="text-sm text-text-tertiary hover:text-text-primary transition-colors"
                            >
                                Skip intro
                            </button>
                        )}
                    </div>
                </div>

                {/* Feature highlights for "complete" step */}
                {step.id === "complete" && (
                    <div className="px-8 pb-6 -mt-2">
                        <div className="grid grid-cols-3 gap-3">
                            <div className="p-3 bg-bg-secondary rounded-lg text-center">
                                <div className="text-lg mb-1">⌨️</div>
                                <div className="text-[10px] text-text-tertiary">Press ? for shortcuts</div>
                            </div>
                            <div className="p-3 bg-bg-secondary rounded-lg text-center">
                                <div className="text-lg mb-1">📁</div>
                                <div className="text-[10px] text-text-tertiary">Drag to add docs</div>
                            </div>
                            <div className="p-3 bg-bg-secondary rounded-lg text-center">
                                <div className="text-lg mb-1">🌓</div>
                                <div className="text-[10px] text-text-tertiary">5 theme options</div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

// Check if onboarding should be shown
export function checkOnboardingStatus() {
    const completed = localStorage.getItem("omnirecall_onboarding_complete");
    if (!completed) {
        hasCompletedOnboarding.value = false;
        isOnboardingActive.value = true;
    } else {
        hasCompletedOnboarding.value = true;
        isOnboardingActive.value = false;
    }
}
