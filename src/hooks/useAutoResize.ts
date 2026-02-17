import { useCallback } from "preact/hooks";

export function useAutoResize(maxHeight = 200) {
  const handleAutoResize = useCallback((e: Event) => {
    const textarea = e.target as HTMLTextAreaElement;
    // Reset height to measure scrollHeight accurately
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, maxHeight)}px`;
  }, [maxHeight]);

  return handleAutoResize;
}
