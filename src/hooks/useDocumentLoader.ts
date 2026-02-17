import { useState, useEffect, useRef } from "preact/hooks";
import { invoke } from "@tauri-apps/api/core";
import { documents, Document } from "../stores/appStore";

export interface DocumentWithContent extends Document {
  content?: string;
  isLoading?: boolean;
}

export function useDocumentLoader() {
  const [docsWithContent, setDocsWithContent] = useState<DocumentWithContent[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const cacheRef = useRef<Map<string, string>>(new Map());

  // Load document content when documents change, with caching
  useEffect(() => {
    let cancelled = false;

    const loadDocumentContents = async () => {
      if (documents.value.length === 0) {
        setDocsWithContent([]);
        return;
      }

      setLoadingDocs(true);

      const loadPromises = documents.value.map(async (doc) => {
        // Use cached content if available
        const cached = cacheRef.current.get(doc.id);
        if (cached !== undefined) {
          return { ...doc, content: cached };
        }

        try {
          const content = await invoke<string>("read_document_content", { filePath: doc.path });
          // Cache the loaded content
          cacheRef.current.set(doc.id, content);
          return { ...doc, content };
        } catch {
          cacheRef.current.set(doc.id, "");
          return { ...doc, content: "" };
        }
      });

      const loaded = await Promise.all(loadPromises);
      if (!cancelled) {
        setDocsWithContent(loaded);
        setLoadingDocs(false);
      }
    };

    loadDocumentContents();

    // Clean up stale cache entries for removed documents
    const currentIds = new Set(documents.value.map(d => d.id));
    for (const key of cacheRef.current.keys()) {
      if (!currentIds.has(key)) {
        cacheRef.current.delete(key);
      }
    }

    return () => { cancelled = true; };
  }, [documents.value]);

  const totalDocsLoaded = docsWithContent.filter(d => d.content && d.content.length > 0).length;

  return { docsWithContent, loadingDocs, totalDocsLoaded };
}
