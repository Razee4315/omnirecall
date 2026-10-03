import { useEffect, useMemo, useState, memo } from "preact/compat";
import { ComponentChild } from "preact";
import { marked, Token, Tokens } from "marked";
import { CopyIcon, CheckIcon } from "../icons";

interface MarkdownProps {
  content: string;
  className?: string;
}

/// Renders model output as GitHub-flavoured Markdown: headings, nested and
/// task lists, tables, block quotes, rules, links and highlighted code.
///
/// The text is tokenised by `marked` and the tokens are turned into elements
/// here, so nothing from the model is ever injected as HTML.
export const Markdown = memo(function Markdown({ content, className = "" }: MarkdownProps) {
  const tokens = useMemo(() => marked.lexer(content), [content]);
  return <div className={`markdown-content ${className}`}>{renderBlocks(tokens)}</div>;
});

const SAFE_LINK = /^(https?:|mailto:)/i;

// marked escapes the text of inline tokens for its own HTML renderer; undo
// that, since these strings are rendered as text nodes.
function unescapeHtml(text: string): string {
  return text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");
}

function renderInline(tokens: Token[] | undefined): ComponentChild[] {
  if (!tokens) return [];
  return tokens.map((token, key) => {
    switch (token.type) {
      case "strong":
        return <strong key={key} className="font-semibold">{renderInline(token.tokens)}</strong>;
      case "em":
        return <em key={key}>{renderInline(token.tokens)}</em>;
      case "del":
        return <del key={key}>{renderInline(token.tokens)}</del>;
      case "codespan":
        return (
          <code key={key} className="px-1.5 py-0.5 bg-bg-tertiary rounded text-accent-primary font-mono text-[0.9em]">
            {unescapeHtml(token.text)}
          </code>
        );
      case "br":
        return <br key={key} />;
      case "link": {
        const link = token as Tokens.Link;
        // Only web and mail links are made clickable; anything else
        // (javascript:, file:, custom schemes) is shown as plain text.
        if (!SAFE_LINK.test(link.href)) return <span key={key}>{renderInline(link.tokens)}</span>;
        return (
          <a key={key} href={link.href} target="_blank" rel="noopener noreferrer" className="text-accent-primary hover:underline">
            {renderInline(link.tokens)}
          </a>
        );
      }
      case "image": {
        const image = token as Tokens.Image;
        const label = image.text || "image";
        if (!SAFE_LINK.test(image.href)) return <span key={key}>[{label}]</span>;
        return (
          <a key={key} href={image.href} target="_blank" rel="noopener noreferrer" className="text-accent-primary hover:underline">
            [{label}]
          </a>
        );
      }
      case "text": {
        const text = token as Tokens.Text;
        return text.tokens ? <span key={key}>{renderInline(text.tokens)}</span> : unescapeHtml(text.text);
      }
      case "escape":
        return unescapeHtml(token.text);
      default:
        // Raw HTML and anything unrecognised is shown literally.
        return token.raw;
    }
  });
}

const HEADING_CLASS: Record<number, string> = {
  1: "text-xl font-bold mt-3 mb-2",
  2: "text-lg font-semibold mt-3 mb-1",
  3: "text-base font-semibold mt-3 mb-1",
  4: "font-semibold mt-2 mb-1",
  5: "font-semibold mt-2 mb-1",
  6: "font-medium text-text-secondary mt-2 mb-1",
};

function renderList(list: Tokens.List, key: number): ComponentChild {
  const items = list.items.map((item, index) => (
    <li key={index} className={item.task ? "list-none -ml-4" : undefined}>
      {item.task && (
        <input type="checkbox" checked={item.checked} disabled className="mr-1.5 align-middle" aria-label={item.checked ? "Done" : "Not done"} />
      )}
      {renderBlocks(item.tokens, true)}
    </li>
  ));
  return list.ordered ? (
    <ol key={key} start={typeof list.start === "number" ? list.start : undefined} className="list-decimal pl-5 my-2 space-y-1">
      {items}
    </ol>
  ) : (
    <ul key={key} className="list-disc pl-5 my-2 space-y-1">{items}</ul>
  );
}

function renderTable(table: Tokens.Table, key: number): ComponentChild {
  const align = (index: number) => {
    const value = table.align[index];
    return value ? { textAlign: value } : undefined;
  };
  return (
    <div key={key} className="my-2 overflow-x-auto rounded-lg border border-border">
      <table className="w-full border-collapse text-left">
        <thead className="bg-bg-tertiary">
          <tr>
            {table.header.map((cell, index) => (
              <th key={index} scope="col" style={align(index)} className="px-3 py-1.5 font-semibold border-b border-border">
                {renderInline(cell.tokens)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((row, rowIndex) => (
            <tr key={rowIndex} className="border-b border-border last:border-b-0">
              {row.map((cell, index) => (
                <td key={index} style={align(index)} className="px-3 py-1.5 align-top">
                  {renderInline(cell.tokens)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/// `tight` renders bare text (inside list items) without paragraph wrappers.
function renderBlocks(tokens: Token[], tight = false): ComponentChild[] {
  return tokens.map((token, key) => {
    switch (token.type) {
      case "space":
        return null;
      case "heading": {
        const heading = token as Tokens.Heading;
        const Tag = `h${heading.depth}` as "h1";
        return <Tag key={key} className={HEADING_CLASS[heading.depth]}>{renderInline(heading.tokens)}</Tag>;
      }
      case "paragraph":
        return <p key={key} className="my-1">{renderInline((token as Tokens.Paragraph).tokens)}</p>;
      case "text": {
        const text = token as Tokens.Text;
        const children = text.tokens ? renderInline(text.tokens) : unescapeHtml(text.text);
        return tight ? <span key={key}>{children}</span> : <p key={key} className="my-1">{children}</p>;
      }
      case "code": {
        const code = token as Tokens.Code;
        return <CodeBlock key={key} code={code.text} language={(code.lang ?? "").split(/\s+/)[0]} />;
      }
      case "blockquote":
        return (
          <blockquote key={key} className="border-l-[3px] border-accent-primary pl-3 my-2 text-text-secondary italic">
            {renderBlocks((token as Tokens.Blockquote).tokens)}
          </blockquote>
        );
      case "list":
        return renderList(token as Tokens.List, key);
      case "table":
        return renderTable(token as Tokens.Table, key);
      case "hr":
        return <hr key={key} className="my-3 border-border" />;
      default:
        return <p key={key} className="my-1 whitespace-pre-wrap">{token.raw}</p>;
    }
  });
}

const HIGHLIGHT_DELAY_MS = 150;

function CodeBlock({ code, language }: { code: string; language: string }) {
  const [copied, setCopied] = useState(false);
  const [highlighted, setHighlighted] = useState<{ code: string; html: string } | null>(null);
  const lineCount = code.split("\n").length;

  // Highlight once the code has stopped changing (it grows while streaming),
  // loading the highlighter on first use.
  useEffect(() => {
    if (!language) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      import("../../lib/highlight")
        .then(({ highlightCode }) => {
          const html = highlightCode(code, language);
          if (!cancelled && html !== null) setHighlighted({ code, html });
        })
        .catch(() => {});
    }, HIGHLIGHT_DELAY_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [code, language]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  const html = highlighted && highlighted.code === code ? highlighted.html : null;
  const gutter = Array.from({ length: lineCount }, (_, i) => i + 1).join("\n");

  return (
    <div className="my-2 rounded-lg overflow-hidden border border-border bg-code-block not-italic">
      <div className="flex items-center justify-between px-3 py-1.5 bg-bg-tertiary border-b border-border">
        <span className="text-xs text-text-tertiary font-mono">{language || "code"}</span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 px-2 py-0.5 rounded text-xs text-text-secondary hover:text-text-primary hover:bg-bg-secondary transition-colors"
          aria-label="Copy code"
        >
          {copied ? (
            <>
              <CheckIcon size={12} className="text-success" />
              <span className="text-success">Copied!</span>
            </>
          ) : (
            <>
              <CopyIcon size={12} />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>

      <div className="flex overflow-auto max-h-[400px] text-xs font-mono leading-relaxed">
        <pre aria-hidden="true" className="select-none text-right text-text-tertiary/60 px-3 py-2 border-r border-border/30 sticky left-0 bg-code-block">
          {gutter}
        </pre>
        <pre className="px-3 py-2 text-code-text flex-1">
          {html !== null ? <code className="hljs" dangerouslySetInnerHTML={{ __html: html }} /> : <code>{code}</code>}
        </pre>
      </div>
    </div>
  );
}
