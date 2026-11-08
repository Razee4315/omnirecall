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
import { CheckIcon, ChevronRightIcon, CommandIcon, DocumentIcon, KeyIcon, LogoMark } from "../icons";

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

function StepIcon({ children }: { children: ComponentChild }) {
    return (
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center bg-surface-2 border border-line text-accent shadow-soft">
            {children}
        </div>
    );
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
            icon: <LogoMark size={56} />,
        },
        {
            id: "api-key",
            title: "Connect an AI provider",
            description: "Add an API key for Gemini, OpenAI, Claude or GLM — or connect to Ollama to run models locally with no key.",
            icon: <StepIcon><KeyIcon size={24} /></StepIcon>,
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
            icon: <StepIcon><DocumentIcon size={24} /></StepIcon>,
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
            icon: <StepIcon><CommandIcon size={24} /></StepIcon>,
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
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-3">
            <div className="scrim absolute inset-0" />
            <div
                ref={panelRef}
                role="dialog"
                aria-modal="true"
                aria-label="Getting started"
                className="dialog relative w-full max-w-[420px] max-h-full overflow-y-auto"
            >
                <div className="ambient px-7 pt-8 pb-2 text-center" aria-live="polite" key={step.id}>
                    <div className="flex justify-center mb-5 animate-pop-in">{step.icon}</div>
                    <p className="section-label mb-2">Step {currentStep + 1} of {steps.length}</p>
                    <h2 className="font-display text-[30px] leading-tight text-fg animate-rise">{step.title}</h2>
                    <p className="text-[13.5px] text-fg-muted leading-relaxed mt-2 animate-rise" style={{ animationDelay: "40ms" }}>{step.description}</p>
                </div>

                <div className="px-7 pt-5 pb-6 space-y-2.5">
                    {step.doneLabel ? (
                        <div className="w-full h-10 px-4 rounded-xl bg-success/10 border border-success/30 text-success text-[13px] font-medium flex items-center justify-center gap-2">
                            <CheckIcon size={14} />
                            {step.doneLabel}
                        </div>
                    ) : (
                        step.action && (
                            <button onClick={step.action} className="btn btn-lg btn-secondary w-full">
                                {step.actionLabel}
                            </button>
                        )
                    )}
                    <button
                        onClick={() => (isLastStep ? finish() : setCurrentStep(currentStep + 1))}
                        className="btn btn-lg btn-primary w-full"
                    >
                        {isLastStep ? "Start chatting" : "Continue"}
                        {!isLastStep && <ChevronRightIcon size={15} />}
                    </button>

                    <div className="flex items-center justify-between pt-2 min-h-[24px]">
                        {currentStep > 0 ? (
                            <button onClick={() => setCurrentStep(currentStep - 1)} className="btn btn-sm btn-ghost -ml-2.5">
                                Back
                            </button>
                        ) : (
                            <span />
                        )}
                        <div className="flex items-center gap-1.5" aria-hidden="true">
                            {steps.map((s, idx) => (
                                <span
                                    key={s.id}
                                    className={`h-1.5 rounded-full transition-all duration-300 ${
                                        idx === currentStep ? "w-5 bg-accent" : idx < currentStep ? "w-1.5 bg-accent/50" : "w-1.5 bg-surface-3"
                                    }`}
                                />
                            ))}
                        </div>
                        {!isLastStep ? (
                            <button onClick={finish} className="btn btn-sm btn-ghost -mr-2.5">
                                Skip
                            </button>
                        ) : (
                            <span className="w-10" />
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
