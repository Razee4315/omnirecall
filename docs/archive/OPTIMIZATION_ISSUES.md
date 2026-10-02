# OmniRecall: Optimization & Logic Issues Audit

## Overview

This document catalogs every rendering, logic, and performance issue found in the OmniRecall codebase across both the Preact frontend and Rust/Tauri backend. Issues are categorized by severity and area.

---

## 1. CRITICAL: State Persistence Bottleneck

### Full Chat History Serialization on Every Message
**Files:** `src/stores/appStore.ts:379-384`, `src/stores/appStore.ts:591-611`

Every time a message is added (during streaming, that's every chunk), `updateChatSession()` or `updateBranchMessages()` is called, which:
1. Maps over the **entire** `chatHistory` array (O(n) sessions)
2. Calls `saveChatHistory()` which serializes the **entire** history to JSON
3. Writes to disk via Tauri Store plugin

With 50 sessions averaging 20 messages each, this means serializing ~1000 messages on every single streaming chunk. During a streaming response with 100 chunks, that's 100 full serializations.

**Impact:** UI jank during streaming, disk I/O saturation, battery drain
**Fix:** Debounce `saveChatHistory()` with 1-2 second delay, only save on stream completion

---

## 2. CRITICAL: Streaming Update Creates New Array Per Chunk

### Array Spread on Every Stream Chunk
**Files:** `src/components/dashboard/Dashboard.tsx:213-215`, `src/components/spotlight/Spotlight.tsx:136-138`

```typescript
const msgs = [...currentMessages.value];  // Full array copy
msgs[assistantIdx] = { ...msgs[assistantIdx], content: fullResponse, tokenCount: estimateTokens(fullResponse) };
currentMessages.value = msgs;  // Triggers signal update -> re-render
```

On every streaming chunk:
1. Full array copy of all messages (`[...currentMessages.value]`)
2. Object spread of the assistant message
3. Signal assignment triggers full component re-render
4. `estimateTokens()` called on every chunk (unnecessary during streaming)

With 100 chunks and 20 messages, that's 2000 array element copies + 100 re-renders.

**Impact:** High CPU usage during streaming, dropped frames, UI stutter
**Fix:** Use a ref for in-flight streaming content, only update signal on completion or throttled interval (e.g., every 100ms)

---

## 3. CRITICAL: Duplicate Logic Between Spotlight and Dashboard

### handleSubmit, Document Loading, Stream Handling
**Files:** `src/components/spotlight/Spotlight.tsx:88-178` vs `src/components/dashboard/Dashboard.tsx:165-260`

The two main views duplicate nearly identical code:
- `handleSubmit()` - ~80 lines duplicated with minor differences
- Document loading `useEffect` - ~20 lines duplicated
- Stream event listener setup - ~35 lines duplicated
- Error handling logic - duplicated

When bugs are fixed in one, they're often not fixed in the other. Example: Dashboard has `parseApiError()` for friendly error messages, but Spotlight shows raw errors (line 175).

**Impact:** Maintenance nightmare, inconsistent behavior, doubled bug surface area
**Fix:** Extract into custom hooks: `useChatSubmit()`, `useDocumentLoader()`, `useChatStream()`

---

## 4. HIGH: No Message List Virtualization

### All Messages Rendered to DOM
**Files:** `src/components/dashboard/Dashboard.tsx:857-930`, `src/components/spotlight/Spotlight.tsx:390-430`

```typescript
{currentMessages.value.map((message, index) => (
  <div key={message.id} className={`group flex ...`} style={{ animationDelay: `${Math.min(index * 50, 200)}ms` }}>
```

Every message in a conversation is rendered as a full DOM node with:
- Animation delay calculation per message
- Complex className conditional logic
- Markdown parsing for assistant messages
- Action buttons (copy, branch, regenerate)

With 200+ messages, this means 200+ DOM nodes with event listeners, animations, and markdown parsing.

**Impact:** Severe performance degradation on long conversations (>50 messages)
**Fix:** Implement windowed rendering - only render messages in viewport + buffer

---

## 5. HIGH: Documents Loaded Eagerly on Mount

### All Document Contents Loaded Simultaneously
**Files:** `src/components/dashboard/Dashboard.tsx:128-154`, `src/components/spotlight/Spotlight.tsx:67-86`

```typescript
const loadPromises = documents.value.map(async (doc) => {
  const content = await invoke<string>("read_document_content", { filePath: doc.path });
  return { ...doc, content };
});
const docsWithContentArr = await Promise.all(loadPromises);
```

All documents are loaded into memory on component mount, even if the user never sends a message. With 10 large PDFs (50KB each), that's 500KB loaded into the JS heap unnecessarily.

Also: document content is re-loaded every time `documents.value` changes (even just adding/removing a doc forces re-reading ALL docs).

**Impact:** Slow startup, wasted memory, unnecessary IPC calls
**Fix:** Lazy load on first message send, cache content, only load new documents incrementally

---

## 6. HIGH: Search Runs on Every Keystroke Without Debounce

### Linear Search Triggers on Every Character
**Files:** `src/components/dashboard/Dashboard.tsx:157-163`, `src/stores/appStore.ts:213-241`

```typescript
useEffect(() => {
  if (localSearchQuery.trim()) {
    searchChatHistory(localSearchQuery);  // Called on every keystroke
  }
}, [localSearchQuery]);
```

`searchChatHistory()` performs a linear scan through ALL sessions and ALL messages with `.toLowerCase()` on every message content. Typing "hello" triggers 5 full scans.

**Impact:** UI lag during search, wasted CPU cycles
**Fix:** Add 300ms debounce on search input, consider indexing

---

## 7. HIGH: Chat History Grouping Recalculated Every Render

### Date Grouping Logic Inside IIFE in Render
**File:** `src/components/dashboard/Dashboard.tsx:519-595`

```typescript
(() => {
  const getDateGroup = (dateStr: string) => {
    const date = new Date(dateStr);
    const today = new Date();
    // ... date comparison logic
  };
  const grouped = chatHistory.value.reduce((acc, session) => {
    const group = getDateGroup(session.createdAt);
    // ... grouping logic
  }, {});
  // ... sorting logic
})()
```

This entire IIFE:
1. Creates `getDateGroup` function on every render
2. Creates new `Date()` objects for every session
3. Runs `.reduce()` over all sessions
4. Sorts the groups

All inside the JSX render path, recalculated on ANY state change.

**Impact:** Unnecessary CPU work on every render
**Fix:** Extract to `useMemo` with `chatHistory.value` dependency

---

## 8. HIGH: CommandPalette Commands Array Recreated Every Render

### Static Commands With JSX Icons Recreated
**File:** `src/components/common/CommandPalette.tsx:41-109`

The `commands` array contains 5 command objects with JSX icon elements. This array is recreated on every render even though the commands themselves never change. Each render creates 5 new icon elements and 5 new action closures.

Additionally, `recentChats` (line 112-123) maps over `chatHistory.value.slice(0, 5)` on every render.

**Impact:** Unnecessary allocations, GC pressure
**Fix:** Move commands outside component or memoize with `useMemo`

---

## 9. MEDIUM: CSS will-change Applied Too Broadly

### GPU Layer Promotion for ALL Interactive Elements
**File:** `src/styles/globals.css:187-194`

```css
button, input, textarea, select, [role="button"] {
  will-change: transform, opacity, background-color;
}
```

This promotes EVERY button, input, textarea, and select to its own GPU compositing layer. With dozens of buttons in the dashboard sidebar, model selector, and message actions, this creates excessive GPU memory usage and can actually hurt performance.

**Impact:** Excessive GPU memory, potential compositing overhead
**Fix:** Remove blanket `will-change`, apply only to elements that actually animate

---

## 10. MEDIUM: CSS Transitions on All Themed Elements

### Transition Applied to Every Element Matching `[class*="bg-"]`
**File:** `src/styles/globals.css:418-432`

```css
.glass, button, input, textarea, select,
[class*="bg-"], [class*="border-"], [class*="text-"] {
  transition: background-color 0.3s ease, color 0.3s ease,
    border-color 0.3s ease, opacity 0.15s ease, transform 0.15s ease;
}
```

This selector matches virtually EVERY element in the app (since Tailwind classes like `bg-bg-primary`, `text-text-primary` all match). This means the browser has to calculate transitions for hundreds of elements on every state change.

**Impact:** Layout thrashing, jank during theme changes and state updates
**Fix:** Apply transitions only to the root theme container, not every element

---

## 11. MEDIUM: Markdown Regex Patterns Recompiled on Every Call

### Regex Literals Inside parseInline Loop
**File:** `src/components/common/Markdown.tsx:124-187`

```typescript
function parseInline(text: string): (preact.JSX.Element | string)[] {
  while (remaining.length > 0) {
    const codeMatch = remaining.match(/^`([^`]+)`/);        // Regex compiled each iteration
    const boldMatch = remaining.match(/^(\*\*|__)([^*_]+)\1/);  // Regex compiled each iteration
    const italicMatch = remaining.match(/^(\*|_)([^*_]+)\1/);   // Regex compiled each iteration
    const linkMatch = remaining.match(/^\[([^\]]+)\]\(([^)]+)\)/);
```

While V8 does cache regex literals, `parseInline` is called many times per message (once per line), and the match attempts execute sequentially for every character position.

**Impact:** Minor per-call, but compounds across many messages during streaming
**Fix:** Pre-compile regex patterns as module-level constants

---

## 12. MEDIUM: Duplicate `applyThemeClasses` Function

### Same Function Defined in Two Files
**Files:** `src/App.tsx:27-51`, `src/stores/appStore.ts:718-739`

The `applyThemeClasses` function is defined identically in both `App.tsx` and `appStore.ts`. Both manipulate `document.documentElement.classList`.

**Impact:** Code duplication, potential for divergence
**Fix:** Remove from one location, export from the other

---

## 13. MEDIUM: Event Listener Not Cleaned Up in Streaming

### Stream Listener Leaks on Component Unmount
**Files:** `src/components/dashboard/Dashboard.tsx:209-244`, `src/components/spotlight/Spotlight.tsx:132-162`

```typescript
unlisten = await listen<{ chunk: string; done: boolean }>("chat-stream", (event) => {
  // ... updates state
});
```

The `unlisten` function is called when `done` is true, but if the component unmounts mid-stream (e.g., switching from Spotlight to Dashboard), the listener is never cleaned up. This causes:
1. Memory leak (listener stays registered)
2. Stale state updates (writing to unmounted component's state)
3. Potential duplicate listeners on remount

**Impact:** Memory leak, ghost state updates
**Fix:** Store unlisten ref and clean up in useEffect return

---

## 14. MEDIUM: Animation Delay Calculated for Every Message

### Math.min on Every Message Render
**File:** `src/components/dashboard/Dashboard.tsx:861`

```typescript
style={{ animationDelay: `${Math.min(index * 50, 200)}ms` }}
```

For existing messages (not new ones), this animation has already completed. But the style is still applied on every re-render, creating unnecessary inline style objects.

**Impact:** Minor, but creates garbage for GC
**Fix:** Only apply animation on new messages, use CSS class instead of inline style

---

## 15. MEDIUM: Multiple Synchronous Save Calls in deleteChatFolder

### Two Separate Serializations for One Action
**File:** `src/stores/appStore.ts:461-471`

```typescript
export function deleteChatFolder(folderId: string) {
  chatHistory.value = chatHistory.value.map(s =>
    s.folderId === folderId ? { ...s, folderId: null } : s
  );
  saveChatHistory();    // First full serialization

  chatFolders.value = chatFolders.value.filter(f => f.id !== folderId);
  saveChatFolders();    // Second serialization
}
```

Two separate disk writes when one batched write would suffice.

**Impact:** Double I/O for single user action
**Fix:** Batch saves with debounce

---

## 16. LOW: `estimateTokens` Called During Streaming

### Token Count Estimated on Every Chunk
**Files:** `src/components/dashboard/Dashboard.tsx:214`, `src/components/spotlight/Spotlight.tsx:137`

```typescript
msgs[assistantIdx] = { ...msgs[assistantIdx], content: fullResponse, tokenCount: estimateTokens(fullResponse) };
```

`estimateTokens` does `Math.ceil(text.length / 4)` which is cheap, but it's called on every streaming chunk along with the array copy. The token count mid-stream isn't useful to the user.

**Impact:** Minor CPU waste during streaming
**Fix:** Only calculate token count on stream completion

---

## 17. LOW: Provider Card Initializes State From Props Without Sync

### Stale State After External Update
**Files:** `src/components/settings/Settings.tsx:123`, `src/components/settings/Settings.tsx:411`

```typescript
const [apiKey, setApiKey] = useState(provider.apiKey);
```

If `provider.apiKey` changes externally (e.g., from import), the local `apiKey` state won't update because `useState` only uses the initial value. This is a React/Preact anti-pattern.

**Impact:** Stale UI after external data changes
**Fix:** Use `useEffect` to sync, or derive directly from props

---

## 18. LOW: loadPersistedData Imports invoke Dynamically

### Unnecessary Dynamic Import
**File:** `src/stores/appStore.ts:290-291`

```typescript
const { invoke } = await import("@tauri-apps/api/core");
```

`invoke` is already imported at the top of the file (line 3). This dynamic import is redundant and adds unnecessary async overhead.

**Impact:** Negligible, but confusing code
**Fix:** Use the already-imported `invoke`

---

## Summary Priority Matrix

| # | Issue | Severity | Effort | Impact |
|---|-------|----------|--------|--------|
| 1 | Debounce chat history saves | CRITICAL | Low | High |
| 2 | Throttle streaming UI updates | CRITICAL | Medium | High |
| 3 | Extract shared hooks (DRY) | CRITICAL | Medium | High |
| 4 | Message list virtualization | HIGH | High | High |
| 5 | Lazy document loading | HIGH | Medium | Medium |
| 6 | Debounce search input | HIGH | Low | Medium |
| 7 | Memoize chat grouping | HIGH | Low | Medium |
| 8 | Memoize CommandPalette commands | HIGH | Low | Low |
| 9 | Fix CSS will-change overuse | MEDIUM | Low | Medium |
| 10 | Fix CSS transition overuse | MEDIUM | Low | Medium |
| 11 | Pre-compile markdown regex | MEDIUM | Low | Low |
| 12 | Remove duplicate applyThemeClasses | MEDIUM | Low | Low |
| 13 | Fix stream listener cleanup | MEDIUM | Medium | Medium |
| 14 | Fix animation delay waste | MEDIUM | Low | Low |
| 15 | Batch folder delete saves | MEDIUM | Low | Low |
| 16 | Defer token estimation | LOW | Low | Low |
| 17 | Fix provider card state sync | LOW | Low | Low |
| 18 | Remove dynamic import | LOW | Low | Low |
