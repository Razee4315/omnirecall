import { useCallback } from "preact/hooks";

/// Returns a function that sizes a textarea to its content, up to maxHeight.
/// Call it whenever the value changes (typed or programmatic).
export function useAutoResize(maxHeight = 200) {
  const resize = useCallback((textarea: HTMLTextAreaElement | null) => {
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, maxHeight)}px`;
  }, [maxHeight]);

  return { resize };
}
