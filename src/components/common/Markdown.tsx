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
          <code key={key} className="px-[0.35em] py-[0.1em] rounded-[5px] bg-surface-2 border border-line font-mono text-[0.86em] text-fg">
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
          <a key={key} href={link.href} target="_blank" rel="noopener noreferrer">
            {renderInline(link.tokens)}
          </a>
        );
      }
      case "image": {
        const image = token as Tokens.Image;
        const label = image.text || "image";
        if (!SAFE_LINK.test(image.href)) return <span key={key}>[{label}]</span>;
        return (
          <a key={key} href={image.href} target="_blank" rel="noopener noreferrer">
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
  1: "text-[1.45em] font-semibold mt-6 mb-2",
  2: "text-[1.22em] font-semibold mt-5 mb-2",
  3: "text-[1.08em] font-semibold mt-4 mb-1.5",
  4: "font-semibold mt-3 mb-1",
  5: "font-semibold mt-3 mb-1",
  6: "font-medium text-fg-muted mt-3 mb-1",
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
    <ol key={key} start={typeof list.start === "number" ? list.start : undefined} className="list-decimal pl-6 my-2.5 space-y-1">
      {items}
    </ol>
  ) : (
    <ul key={key} className="list-disc pl-6 my-2.5 space-y-1">{items}</ul>
  );
}

function renderTable(table: Tokens.Table, key: number): ComponentChild {
  const align = (index: number) => {
    const value = table.align[index];
    return value ? { textAlign: value } : undefined;
  };
  return (
    <div key={key} className="my-3 overflow-x-auto rounded-xl border border-line">
      <table className="w-full border-collapse text-left text-[0.93em]">
        <thead className="bg-surface-2">
          <tr>
            {table.header.map((cell, index) => (
              <th key={index} scope="col" style={align(index)} className="px-3 py-2 font-semibold text-fg border-b border-line">
                {renderInline(cell.tokens)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((row, rowIndex) => (
            <tr key={rowIndex} className="border-b border-line last:border-b-0 even:bg-surface/50">
              {row.map((cell, index) => (
                <td key={index} style={align(index)} className="px-3 py-2 align-top">
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
          <blockquote key={key} className="border-l-2 border-accent/60 pl-4 my-3 text-fg-muted">
            {renderBlocks((token as Tokens.Blockquote).tokens)}
          </blockquote>
        );
      case "list":
        return renderList(token as Tokens.List, key);
      case "table":
        return renderTable(token as Tokens.Table, key);
      case "hr":
        return <hr key={key} className="my-5 border-line" />;
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
    <div className="group/code my-3 rounded-xl overflow-hidden border border-line bg-code-block not-italic" style={{ boxShadow: "0 1px 0 rgba(255,255,255,0.04) inset" }}>
      <div className="flex items-center justify-between h-9 pl-3.5 pr-1.5 border-b border-white/[0.06]">
        <span className="text-[11px] font-mono text-white/45 lowercase">{language || "code"}</span>
        <button
          onClick={handleCopy}
          className="inline-flex items-center gap-1.5 h-6 px-2 rounded-md text-[11px] text-white/55 hover:text-white hover:bg-white/[0.08] transition-colors"
          aria-label="Copy code"
        >
          {copied ? (
            <>
              <CheckIcon size={12} className="text-success" />
              <span>Copied</span>
            </>
          ) : (
            <>
              <CopyIcon size={12} />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>

      <div className="flex overflow-auto max-h-[440px] text-[12.5px] font-mono leading-[1.65]">
        <pre aria-hidden="true" className="select-none text-right text-white/25 pl-3.5 pr-3 py-3 sticky left-0 bg-code-block">
          {gutter}
        </pre>
        <pre className="pr-4 py-3 text-code-text flex-1">
          {html !== null ? <code className="hljs" dangerouslySetInnerHTML={{ __html: html }} /> : <code>{code}</code>}
        </pre>
      </div>
    </div>
  );
}
