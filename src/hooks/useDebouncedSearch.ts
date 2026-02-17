import { useState, useEffect, useRef } from "preact/hooks";
import { searchChatHistory, searchQuery } from "../stores/appStore";

export function useDebouncedSearch(delay = 300) {
  const [localSearchQuery, setLocalSearchQuery] = useState("");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);

    if (localSearchQuery.trim()) {
      timerRef.current = setTimeout(() => {
        searchChatHistory(localSearchQuery);
      }, delay);
    } else {
      searchQuery.value = "";
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [localSearchQuery, delay]);

  return { localSearchQuery, setLocalSearchQuery };
}
