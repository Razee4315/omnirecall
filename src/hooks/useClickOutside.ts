import { useEffect, useRef } from "preact/hooks";

export function useClickOutside<T extends HTMLElement>(
  callback: () => void,
  active = true,
) {
  const ref = useRef<T>(null);

  useEffect(() => {
    if (!active) return;

    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        callback();
      }
    };

    // Delay to avoid catching the click that opened the dropdown
    const timer = setTimeout(() => {
      document.addEventListener("mousedown", handleClick);
    }, 0);

    return () => {
      clearTimeout(timer);
      document.removeEventListener("mousedown", handleClick);
    };
  }, [callback, active]);

  return ref;
}
