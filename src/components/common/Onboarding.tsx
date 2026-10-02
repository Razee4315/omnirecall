import { ComponentChild } from "preact";
import { useRef } from "preact/hooks";
import { signal } from "@preact/signals";
import {
    completeOnboarding,
    formatHotkey,
    globalHotkey,
    hotkeyError,
    isOnboardingActive,
    isSettingsOpen,
    providers,
    readableDocumentCount,
    settingsTab,
} from "../../stores/appStore";
import { useFocusTrap } from "../../hooks/useFocusTrap";
import { pickAndAddDocuments } from "../../lib/documents";
import { CheckIcon, ChevronRightIcon, CommandIcon, DocumentIcon, KeyIcon, LogoIcon } from "../icons";

interface OnboardingStep {
    id: string;
    title: string;
    description: string;
    icon: ComponentChild;
    action?: () => void;
    actionLabel?: string;
    /// Shown instead of the action once the step's goal is met.
    doneLabel?: string;
}

function StepIcon({ children, tone }: { children: ComponentChild; tone: string }) {
    return <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${tone}`}>{children}</div>;
}

// Kept outside the component so the tour resumes where it was after stepping
// aside for Settings (which can remount this lazily-loaded overlay).
const stepIndex = signal(0);

export function Onboarding() {
    const currentStep = stepIndex.value;
    const setCurrentStep = (step: number) => {
        stepIndex.value = step;
    };
    const panelRef = useRef<HTMLDivElement>(null);
    // The tour steps aside while Settings is open (its "Open Settings" action
    // would otherwise open the modal underneath this overlay) and resumes on
    // the same step once Settings closes.
    const visible = isOnboardingActive.value && !isSettingsOpen.value;
    // Finishing rewinds the tour so it starts from the top if shown again
    // (after "Reset all data").
    const finish = () => {
        stepIndex.value = 0;
        completeOnboarding();
    };
    useFocusTrap(panelRef, visible, finish);

    if (!visible) return null;

    const hotkey = formatHotkey(globalHotkey.value);
    const hasProvider = providers.value.some(p => p.apiKey !== "" || (p.id === "ollama" && p.isConnected));
    const docCount = readableDocumentCount.value;

    const steps: OnboardingStep[] = [
        {
            id: "welcome",
            title: "Welcome to OmniRecall",
            description: "An AI assistant that appears at your cursor, answers, and gets out of the way. Setup takes about a minute.",
            icon: <LogoIcon size={48} className="text-accent-primary" />,
        },
        {
            id: "api-key",
            title: "Connect an AI provider",
            description: "Add an API key for Gemini, OpenAI, Claude or GLM — or connect to Ollama to run models locally with no key.",
            icon: <StepIcon tone="bg-accent-primary/20"><KeyIcon size={24} className="text-accent-primary" /></StepIcon>,
            action: () => {
                settingsTab.value = "providers";
                isSettingsOpen.value = true;
            },
            actionLabel: "Open Settings",
            doneLabel: hasProvider ? "Provider connected" : undefined,
        },
        {
            id: "documents",
            title: "Ask about your own files",
            description: "Attach PDFs, notes or code and OmniRecall answers from them. You can also drop files onto the window. This is optional.",
            icon: <StepIcon tone="bg-success/20"><DocumentIcon size={24} className="text-success" /></StepIcon>,
            action: () => void pickAndAddDocuments(),
            actionLabel: "Add documents",
            doneLabel: docCount > 0 ? `${docCount} document${docCount === 1 ? "" : "s"} added` : undefined,
        },
        {
            id: "complete",
            title: "You're all set",
            description: hotkeyError.value
                ? `${hotkeyError.value} Until then, open OmniRecall from its tray icon.`
                : `Press ${hotkey} from any app to show or hide OmniRecall. Ctrl+K opens the command palette, and Ctrl+/ lists every shortcut.`,
            icon: <StepIcon tone="bg-accent-secondary/20"><CommandIcon size={24} className="text-accent-secondary" /></StepIcon>,
            action: hotkeyError.value
                ? () => {
                    settingsTab.value = "shortcuts";
                    isSettingsOpen.value = true;
                }
                : undefined,
            actionLabel: "Choose another shortcut",
        },
    ];

    const step = steps[currentStep];
    const isLastStep = currentStep === steps.length - 1;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] flex items-center justify-center p-3 animate-fade-in">
            <div
                ref={panelRef}
                role="dialog"
                aria-modal="true"
                aria-label="Getting started"
                className="w-full max-w-md max-h-full overflow-y-auto bg-bg-primary border border-border rounded-2xl shadow-2xl animate-scale-in"
            >
                <div className="flex items-center justify-center gap-2 pt-5" aria-hidden="true">
                    {steps.map((s, idx) => (
                        <div
                            key={s.id}
                            className={`h-2 rounded-full transition-all duration-300 ${
                                idx === currentStep ? "bg-accent-primary w-6" : idx < currentStep ? "bg-accent-primary/50 w-2" : "bg-bg-tertiary w-2"
                            }`}
                        />
                    ))}
                </div>

                <div className="px-6 pt-6 pb-5 text-center" aria-live="polite">
                    <div className="flex justify-center mb-4">{step.icon}</div>
                    <p className="text-[11px] text-text-tertiary mb-1">Step {currentStep + 1} of {steps.length}</p>
                    <h2 className="text-lg font-bold text-text-primary mb-2">{step.title}</h2>
                    <p className="text-sm text-text-secondary leading-relaxed">{step.description}</p>
                </div>

                <div className="px-6 pb-6 space-y-2.5">
                    {step.doneLabel ? (
                        <div className="w-full py-2.5 px-4 rounded-xl bg-success/10 border border-success/30 text-success text-sm font-medium flex items-center justify-center gap-2">
                            <CheckIcon size={14} />
                            {step.doneLabel}
                        </div>
                    ) : (
                        step.action && (
                            <button
                                onClick={step.action}
                                className="w-full py-2.5 px-4 rounded-xl border border-border text-text-primary text-sm font-medium hover:bg-bg-tertiary transition-colors"
                            >
                                {step.actionLabel}
                            </button>
                        )
                    )}
                    <button
                        onClick={() => (isLastStep ? finish() : setCurrentStep(currentStep + 1))}
                        className="w-full py-2.5 px-4 rounded-xl bg-accent-primary text-on-accent text-sm font-medium hover:bg-accent-primary/90 transition-colors flex items-center justify-center gap-2"
                    >
                        {isLastStep ? "Start chatting" : "Continue"}
                        {!isLastStep && <ChevronRightIcon size={16} />}
                    </button>

                    <div className="flex items-center justify-between pt-1 min-h-[20px]">
                        {currentStep > 0 ? (
                            <button
                                onClick={() => setCurrentStep(currentStep - 1)}
                                className="text-sm text-text-tertiary hover:text-text-primary transition-colors"
                            >
                                Back
                            </button>
                        ) : (
                            <span />
                        )}
                        {!isLastStep && (
                            <button
                                onClick={finish}
                                className="text-sm text-text-tertiary hover:text-text-primary transition-colors"
                            >
                                Skip intro
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
