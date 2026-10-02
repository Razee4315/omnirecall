import { render } from "preact";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ErrorBoundary } from "./common/ErrorBoundary";
import { Markdown } from "./common/Markdown";
import { quoteForComposer } from "./chat/ChatComposer";
import { shortcutFromEvent } from "./settings/Settings";

let host: HTMLDivElement;

beforeEach(() => {
  host = document.createElement("div");
  document.body.appendChild(host);
});

afterEach(() => {
  render(null, host);
  host.remove();
});

function renderMarkdown(content: string) {
  render(<Markdown content={content} />, host);
  return host;
}

describe("Markdown", () => {
  it("renders GFM tables", () => {
    const el = renderMarkdown("| Name | Qty |\n|:-----|----:|\n| Apple | 3 |\n| Pear | 12 |");
    expect([...el.querySelectorAll("th")].map(th => th.textContent)).toEqual(["Name", "Qty"]);
    expect(el.querySelectorAll("tbody tr")).toHaveLength(2);
    expect((el.querySelectorAll("td")[1] as HTMLElement).style.textAlign).toBe("right");
  });

  it("renders nested lists, task lists, rules, deep headings and strikethrough", () => {
    const el = renderMarkdown("- one\n  - nested\n- [x] done\n\n---\n\n#### Deep\n\n~~gone~~");
    expect(el.querySelector("ul ul li")?.textContent).toContain("nested");
    expect((el.querySelector('input[type="checkbox"]') as HTMLInputElement).checked).toBe(true);
    expect(el.querySelector("hr")).not.toBeNull();
    expect(el.querySelector("h4")?.textContent).toBe("Deep");
    expect(el.querySelector("del")?.textContent).toBe("gone");
  });

  it("handles emphasis the old parser missed", () => {
    const el = renderMarkdown("**snake_case_name** and **bold with `code`**");
    const strong = el.querySelectorAll("strong");
    expect(strong[0].textContent).toBe("snake_case_name");
    expect(strong[1].querySelector("code")?.textContent).toBe("code");
  });

  it("shows special characters literally and never injects HTML", () => {
    const el = renderMarkdown("Use `a < b && c > d` & <script>alert(1)</script> <img src=x onerror=alert(1)>");
    expect(el.querySelector("code")?.textContent).toBe("a < b && c > d");
    expect(el.querySelector("script")).toBeNull();
    expect(el.querySelector("img")).toBeNull();
    expect(el.textContent).toContain("<script>alert(1)</script>");
  });

  it("only links web and mail addresses", () => {
    const el = renderMarkdown("[ok](https://example.com) [mail](mailto:a@b.c) [bad](javascript:alert(1)) [file](file:///etc/passwd)");
    const links = [...el.querySelectorAll("a")];
    expect(links.map(a => a.getAttribute("href"))).toEqual(["https://example.com", "mailto:a@b.c"]);
    expect(links.every(a => a.getAttribute("rel") === "noopener noreferrer")).toBe(true);
    expect(el.textContent).toContain("bad");
    expect(el.textContent).toContain("file");
  });

  it("renders code blocks with their language and a copy button", () => {
    const el = renderMarkdown("```ts\nconst a: number = 1;\nconsole.log(a);\n```");
    expect(el.querySelector("pre code")?.textContent).toBe("const a: number = 1;\nconsole.log(a);");
    expect(el.textContent).toContain("ts");
    expect(el.querySelector('button[aria-label="Copy code"]')).not.toBeNull();
    // Gutter shows one number per line.
    expect(el.querySelector('pre[aria-hidden="true"]')?.textContent).toBe("1\n2");
  });

  it("keeps an unterminated code block readable while streaming", () => {
    const el = renderMarkdown("Here:\n```python\nprint('hi')");
    expect(el.querySelector("pre code")?.textContent).toBe("print('hi')");
  });
});

describe("quoteForComposer", () => {
  it("quotes every clipboard line and leaves room to type", () => {
    expect(quoteForComposer("line one\r\nline two\n", "")).toBe("> line one\n> line two\n\n");
  });

  it("appends after existing text", () => {
    expect(quoteForComposer("x", "Explain this:  ")).toBe("Explain this:\n\n> x\n\n");
  });
});

describe("shortcutFromEvent", () => {
  const event = (code: string, mods: Partial<Record<"ctrlKey" | "altKey" | "shiftKey" | "metaKey", boolean>>) => ({
    code,
    ctrlKey: false,
    altKey: false,
    shiftKey: false,
    metaKey: false,
    ...mods,
  });

  it("uses the physical key, so shifted digits and symbols stay valid", () => {
    expect(shortcutFromEvent(event("Digit2", { ctrlKey: true, shiftKey: true }))).toBe("Ctrl+Shift+Digit2");
    expect(shortcutFromEvent(event("Space", { altKey: true }))).toBe("Alt+Space");
    expect(shortcutFromEvent(event("KeyK", { metaKey: true, ctrlKey: true }))).toBe("Ctrl+Super+KeyK");
  });

  it("needs a modifier and a non-modifier key", () => {
    expect(shortcutFromEvent(event("KeyA", {}))).toBeNull();
    expect(shortcutFromEvent(event("ControlLeft", { ctrlKey: true }))).toBeNull();
  });
});

describe("ErrorBoundary", () => {
  it("shows a recoverable message instead of a blank window when rendering throws", async () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    const Broken = () => {
      throw new Error("render exploded");
    };
    render(
      <ErrorBoundary>
        <Broken />
      </ErrorBoundary>,
      host,
    );
    // The boundary re-renders with its fallback on the next tick.
    await vi.waitFor(() => expect(host.querySelector('[role="alert"]')).not.toBeNull());
    const alert = host.querySelector('[role="alert"]');
    expect(alert?.textContent).toContain("Something went wrong");
    expect(alert?.textContent).toContain("render exploded");
    expect(alert?.querySelector("button")?.textContent).toBe("Reload");
    logged.mockRestore();
  });

  it("renders its children when nothing throws", () => {
    render(
      <ErrorBoundary>
        <p>fine</p>
      </ErrorBoundary>,
      host,
    );
    expect(host.textContent).toBe("fine");
  });
});
