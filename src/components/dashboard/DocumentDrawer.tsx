import { useState } from "preact/hooks";
import {
  DocumentIcon,
  PlusIcon,
  CloseIcon,
  ChevronDownIcon,
  MenuIcon,
} from "../icons";
import { clsx } from "clsx";

interface Document {
  id: string;
  name: string;
  type: string;
  pages: number;
  tokens: number;
  status: "indexed" | "processing" | "error";
  progress?: number;
}

interface DocumentDrawerProps {
  collapsed: boolean;
  onToggle: () => void;
}

export function DocumentDrawer({ collapsed, onToggle }: DocumentDrawerProps) {
  const [documents] = useState<Document[]>([
    {
      id: "1",
      name: "Q3_Report.pdf",
      type: "pdf",
      pages: 24,
      tokens: 15234,
      status: "indexed",
    },
    {
      id: "2",
      name: "Q2_Report.pdf",
      type: "pdf",
      pages: 22,
      tokens: 14102,
      status: "indexed",
    },
    {
      id: "3",
      name: "Strategy.docx",
      type: "docx",
      pages: 8,
      tokens: 3450,
      status: "indexed",
    },
    {
      id: "4",
      name: "NewReport.pdf",
      type: "pdf",
      pages: 0,
      tokens: 0,
      status: "processing",
      progress: 67,
    },
  ]);

  const [dragOver, setDragOver] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<string | null>(null);

  const indexedDocs = documents.filter((d) => d.status === "indexed");
  const processingDocs = documents.filter((d) => d.status === "processing");

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => {
    setDragOver(false);
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    // Handle file drop
  };

  if (collapsed) {
    return (
      <div className="w-[60px] h-full bg-bg-secondary border-l border-border flex flex-col items-center py-4">
        <button
          onClick={onToggle}
          className="p-2 rounded-lg hover:bg-bg-tertiary transition-colors"
        >
          <MenuIcon size={20} className="text-text-secondary" />
        </button>
        <div className="mt-4 text-xs text-text-tertiary">
          {documents.length}
        </div>
        <DocumentIcon size={20} className="text-text-tertiary mt-1" />
      </div>
    );
  }

  return (
    <div className="w-[300px] h-full bg-bg-secondary border-l border-border flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <span className="font-medium text-text-primary">Documents</span>
          <span className="text-xs text-text-tertiary">({documents.length})</span>
        </div>
        <button
          onClick={onToggle}
          className="p-1.5 rounded-md hover:bg-bg-tertiary transition-colors text-text-tertiary"
        >
          <CloseIcon size={16} />
        </button>
      </div>

      {/* Drop Zone */}
      <div
        className={clsx(
          "mx-3 mt-3 p-4 border-2 border-dashed rounded-lg transition-colors text-center",
          dragOver
            ? "border-accent-primary bg-accent-primary/5"
            : "border-border hover:border-text-tertiary"
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <PlusIcon size={24} className="mx-auto text-text-tertiary mb-2" />
        <div className="text-sm text-text-secondary">Drop files here</div>
        <div className="text-xs text-text-tertiary mt-1">
          PDF, Word, TXT, MD, Code
        </div>
        <button className="mt-3 px-4 py-1.5 bg-bg-tertiary rounded-lg text-sm text-text-secondary hover:bg-bg-primary hover:text-text-primary transition-colors">
          Browse Files
        </button>
      </div>

      {/* Document List */}
      <div className="flex-1 overflow-y-auto p-3">
        {/* Processing */}
        {processingDocs.length > 0 && (
          <div className="mb-4">
            <div className="text-xs font-medium text-text-tertiary uppercase tracking-wider mb-2">
              Processing
            </div>
            <div className="space-y-2">
              {processingDocs.map((doc) => (
                <div
                  key={doc.id}
                  className="p-3 bg-bg-tertiary rounded-lg"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <DocumentIcon size={16} className="text-text-tertiary" />
                    <span className="text-sm text-text-primary truncate flex-1">
                      {doc.name}
                    </span>
                  </div>
                  <div className="h-1.5 bg-bg-primary rounded-full overflow-hidden">
                    <div
                      className="h-full bg-accent-primary transition-all duration-300"
                      style={{ width: `${doc.progress}%` }}
                    />
                  </div>
                  <div className="text-xs text-text-tertiary mt-1">
                    {doc.progress}% complete
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Indexed */}
        {indexedDocs.length > 0 && (
          <div>
            <div className="text-xs font-medium text-text-tertiary uppercase tracking-wider mb-2">
              Indexed
            </div>
            <div className="space-y-1">
              {indexedDocs.map((doc) => (
                <button
                  key={doc.id}
                  onClick={() =>
                    setSelectedDoc(selectedDoc === doc.id ? null : doc.id)
                  }
                  className={clsx(
                    "w-full p-3 rounded-lg text-left transition-colors",
                    selectedDoc === doc.id
                      ? "bg-accent-primary/10 border border-accent-primary/30"
                      : "bg-bg-tertiary hover:bg-bg-primary"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <DocumentIcon size={16} className="text-text-tertiary flex-shrink-0" />
                    <span className="text-sm text-text-primary truncate flex-1">
                      {doc.name}
                    </span>
                    <ChevronDownIcon
                      size={14}
                      className={clsx(
                        "text-text-tertiary transition-transform",
                        selectedDoc === doc.id && "rotate-180"
                      )}
                    />
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-text-tertiary">
                    <span>{doc.pages} pages</span>
                    <span>{doc.tokens.toLocaleString()} tokens</span>
                  </div>
                  {selectedDoc === doc.id && (
                    <div className="mt-3 pt-3 border-t border-border flex gap-2">
                      <button className="px-2 py-1 bg-bg-secondary rounded text-xs text-text-secondary hover:text-text-primary transition-colors">
                        Preview
                      </button>
                      <button className="px-2 py-1 bg-bg-secondary rounded text-xs text-text-secondary hover:text-text-primary transition-colors">
                        Re-index
                      </button>
                      <button className="px-2 py-1 bg-bg-secondary rounded text-xs text-[#ef4444] hover:bg-[#ef4444]/10 transition-colors">
                        Remove
                      </button>
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {documents.length === 0 && (
          <div className="text-center py-8">
            <DocumentIcon size={32} className="mx-auto text-text-tertiary mb-3" />
            <div className="text-sm text-text-secondary">No documents yet</div>
            <div className="text-xs text-text-tertiary mt-1">
              Add documents to start chatting
            </div>
          </div>
        )}
      </div>

      {/* Footer Stats */}
      <div className="p-3 border-t border-border">
        <div className="flex items-center justify-between text-xs text-text-tertiary">
          <span>Total: {indexedDocs.length} documents</span>
          <span>
            {indexedDocs.reduce((sum, d) => sum + d.tokens, 0).toLocaleString()} tokens
          </span>
        </div>
      </div>
    </div>
  );
}
