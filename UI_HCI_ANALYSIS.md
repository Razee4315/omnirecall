# OmniRecall: UI & HCI Deep Analysis

## Overview

This document provides a comprehensive analysis of the OmniRecall user interface from both a frontend engineering perspective and Human-Computer Interaction (HCI) perspective, applying Nielsen's Heuristics, Fitts' Law, cognitive load theory, and accessibility standards (WCAG 2.1).

---

# PART 1: Frontend UI Issues

## 1. Inconsistent Error Handling Between Views

### Spotlight Shows Raw Errors, Dashboard Shows Friendly Ones
**Files:** `Spotlight.tsx:175` vs `Dashboard.tsx:71-108`

Dashboard has a comprehensive `parseApiError()` function that converts raw API errors into user-friendly messages (rate limits, auth failures, etc.). Spotlight just shows `err?.message || err?.toString()`.

Users see different error experiences depending on which view they're in.

**Fix:** Move `parseApiError()` to a shared utility, use in both views.

---

## 2. Model Selector Dropdown Has No Click-Outside Dismiss

### Dropdown Stays Open Until Explicit Close
**Files:** `Dashboard.tsx:706-748`, `Spotlight.tsx:278-316`

The model selector dropdown opens on click but only closes when:
- A model is selected
- The same button is clicked again

There's no click-outside handler, so the dropdown stays open if the user clicks elsewhere in the app, creating a floating orphan dropdown.

**Fix:** Add click-outside detection via `useEffect` with document click listener.

---

## 3. Textarea Does Not Auto-Resize

### Fixed Height Input Area
**Files:** `Dashboard.tsx:956-966`, `Spotlight.tsx:453-462`

The textarea has `min-h-[24px] max-h-[200px]` (Dashboard) or `min-h-[32px] max-h-[60px]` (Spotlight) but no auto-resize logic. Users type multiline messages but can't see their full input until they scroll within the tiny box.

**Fix:** Add auto-resize on input that adjusts height based on `scrollHeight`.

---

## 4. No Confirmation for Destructive Actions

### Chat Deletion Has No Confirmation
**File:** `Dashboard.tsx:583-587`

```typescript
<button onClick={(e) => { e.stopPropagation(); handleDeleteSession(session.id); }}>
```

Clicking the tiny X button instantly deletes a chat session with all its messages and branches. There's no "Are you sure?" dialog or undo capability. Accidental clicks are common due to the small target size (12px icon).

**Fix:** Add confirmation dialog or toast with undo action.

---

## 5. Sidebar Width Transition Causes Content Reflow

### Sidebar Animates Width Causing Layout Shifts
**File:** `Dashboard.tsx:436`

```typescript
<div className={`${sidebarOpen ? "w-72" : "w-0"} transition-all duration-200 overflow-hidden`}>
```

The `transition-all duration-200` on width causes the entire main content area to reflow during the 200ms animation. Every frame recalculates the layout of the messages area.

**Fix:** Use `transform: translateX()` instead of width animation, or use `display: none`/`block` toggle without animation.

---

## 6. Settings Modal Has No Keyboard Trap

### Focus Escapes Modal to Background Elements
**File:** `Settings.tsx:36-107`

The settings modal renders as a fixed overlay but doesn't trap focus. Users can Tab to elements behind the modal, interact with the chat input, or trigger keyboard shortcuts while the modal is open.

**Fix:** Implement focus trap using `createPortal` and tab key interception.

---

## 7. Keyboard Shortcuts Help Modal Shows Incomplete List

### Only 3 Shortcuts in Compact, ~4 in Full
**File:** `Settings.tsx:337-341, 651-656`

The shortcuts tab only shows 3-4 fixed shortcuts, but the app has 12+ keyboard shortcuts defined in `App.tsx:70-201`. Users have no way to discover most shortcuts.

**Fix:** Show all available shortcuts in the help modal.

---

## 8. Branch Selector Not Accessible from Spotlight

### Branching Only Available in Dashboard
**File:** `Spotlight.tsx` - no branch imports

Spotlight mode completely lacks branch functionality. Users who primarily use Spotlight cannot:
- See which branch they're on
- Switch branches
- Create branches
- Regenerate responses (which creates branches)

**Fix:** Add minimal branch indicator and controls to Spotlight mode.

---

## 9. Toast Notifications Position Conflicts with Content

### Toasts Appear Without Positioning Context
**File:** `Toast.tsx` - renders in `App.tsx:219` flow

Toast notifications render inside the main app flow without fixed positioning relative to the viewport. Depending on scroll position, they may overlap with message content or be pushed off-screen.

**Fix:** Ensure toasts use `fixed` positioning with consistent viewport placement.

---

## 10. Document Badge Shows Count But Not Status

### No Visual Distinction Between Loaded and Loading Docs
**Files:** `Dashboard.tsx:756-761`, `Spotlight.tsx:325-329`

The document badge shows `3 docs` but doesn't indicate:
- Are they loaded? Still loading? Failed to load?
- Which ones have content vs empty?
- Are they indexed for RAG?

**Fix:** Add loading spinner, error indicator, and index status to doc badge.

---

## 11. Code Block Dark Background Hardcoded

### Code Blocks Always Use Dark Background
**File:** `Markdown.tsx:263`

```typescript
<div className="my-2 rounded-lg overflow-hidden border border-border bg-[#1a1a2e]">
```

The code block uses a hardcoded dark background (`#1a1a2e`) regardless of the active theme. In the Light or Paper theme, this creates jarring contrast.

**Fix:** Use theme-aware code block backgrounds via CSS variables.

---

## 12. Ollama Base URL Not Persisted

### Custom Ollama URL Lost on Restart
**File:** `Settings.tsx:523-524`

```typescript
<input type="text" defaultValue={provider.baseUrl} placeholder="http://localhost:11434"
```

The Ollama base URL input uses `defaultValue` but has no `onBlur` or `onChange` handler to save changes. The URL is lost when the settings modal closes.

**Fix:** Add save handler for base URL changes.

---

---

# PART 2: HCI Analysis

## A. Nielsen's 10 Usability Heuristics Evaluation

### H1: Visibility of System Status

**Score: 5/10**

**Issues Found:**
- **Streaming feedback is good** - typing indicator and real-time text update work well
- **Missing:** No progress indicator for document loading (just a skeleton, no percentage/count)
- **Missing:** No indicator when stop generation actually takes effect (button changes but no confirmation)
- **Missing:** No status bar showing connection to AI provider (user doesn't know if API is reachable until they send a message)
- **Missing:** No indication of which documents are being used in the current query context
- **Missing:** Token counter updates during streaming but the numbers flash rapidly, causing information overload

**Recommendations:**
1. Add a persistent status indicator showing provider connection state
2. Show document loading progress (e.g., "Loading 2/5 documents...")
3. Add brief toast when generation stops confirming the action
4. Show which documents contributed context to the current response

---

### H2: Match Between System and Real World

**Score: 7/10**

**Strengths:**
- Chat metaphor is universally understood
- "Spotlight" name matches macOS mental model
- Branch metaphor borrows from Git (familiar to developers)

**Issues:**
- "RAG" terminology in developer tab is jargon (show as "Document Search" instead)
- "Index Status" button wording is unclear for non-technical users
- Token count display (`~1234 tokens`) is meaningless to most users. Show context usage percentage instead (e.g., "15% context used")
- Branch selector uses technical terminology ("Main" branch) instead of conversation metaphor ("Original conversation" vs "Alternative response")

**Recommendations:**
1. Replace "Index Status" with "Document Search Status"
2. Show token usage as percentage bar rather than raw number
3. Rename "Main" to "Original" in branch context

---

### H3: User Control and Freedom

**Score: 4/10**

**Critical Issues:**
- **No Undo for chat deletion** - Irreversible action with no recovery
- **No Undo for branch deletion** - Same problem
- **No Undo for document removal** - Same problem
- **Cannot edit sent messages** - Common in modern chat UIs
- **Cannot reorder chat history** - Fixed chronological order
- **Stop generation only sets a flag** - Doesn't actually cancel the backend HTTP request (Rust side continues receiving)
- **No way to clear all data** - No "Reset" option in settings
- **No way to export all chats at once** - Only one session at a time

**Recommendations:**
1. Implement undo via toast with "Undo" button for destructive actions
2. Add message editing capability
3. Make stop generation actually cancel the HTTP stream
4. Add bulk export feature

---

### H4: Consistency and Standards

**Score: 6/10**

**Issues:**
- **Different error handling** between Spotlight (raw) and Dashboard (friendly)
- **Different feature sets** - Dashboard has branching, export, folders; Spotlight has none
- **Inconsistent button styles** - Some action buttons are icons only, some have labels
- **Settings duplicated** - Both compact and full settings tabs with different code paths (identical business logic, different UI)
- **"Close" means different things** - In Spotlight, close hides the window; in Dashboard, close goes back to Spotlight
- **Copy button behavior** - Spotlight has a bottom action bar "Copy" button for last message, Dashboard has per-message copy. Inconsistent paradigms

**Recommendations:**
1. Unify feature set between modes (Spotlight = subset of Dashboard, not different)
2. Standardize button patterns (always icon+label, or always icon with tooltip)
3. Make close behavior consistent or clearly differentiated

---

### H5: Error Prevention

**Score: 5/10**

**Issues:**
- **No character limit warning** - Users can paste unlimited text without knowing it exceeds context window
- **No API key format validation** - Accepts any string as API key (e.g., empty spaces)
- **No empty message prevention feedback** - Send button just grays out without explanation
- **Drag-and-drop of chats to wrong folder** - No visual guide of valid drop targets
- **Can start generating while another is in progress** - No proper queuing

**Recommendations:**
1. Show context window usage and warn at 80%
2. Add API key format validation before test
3. Show tooltip on disabled send button: "Type a message to send"
4. Highlight valid drop targets during drag

---

### H6: Recognition Rather Than Recall

**Score: 6/10**

**Strengths:**
- Command palette (Ctrl+K) is great for discoverability
- Recent chats shown in command palette

**Issues:**
- **Keyboard shortcuts not shown in tooltips** - Buttons have `title` but not formatted shortcuts
- **No hover previews for chat history** - Must click to see content
- **Model selector shows model name but not provider** - `gemini-3-flash-preview` doesn't indicate "Google Gemini"
- **Document types not indicated** - All docs show same icon regardless of file type (PDF vs TXT vs code)

**Recommendations:**
1. Show keyboard shortcuts in button tooltips (e.g., "Settings (Ctrl+,)")
2. Add hover preview cards for chat history
3. Show provider name alongside model in selector
4. Use file-type specific icons for documents

---

### H7: Flexibility and Efficiency of Use

**Score: 7/10**

**Strengths:**
- Extensive keyboard shortcuts (12+)
- Spotlight for quick queries, Dashboard for deep work
- Command palette for power users
- Quick chat navigation (Ctrl+1-9)

**Issues:**
- **No slash commands** in chat input (e.g., `/clear`, `/model gpt-4`, `/export`)
- **No message templates/quick responses** for frequently used prompts
- **No customizable default model** - Always resets to default
- **No system prompt customization** - Can't set persona/context
- **No shortcuts for sidebar tabs** - Must click to switch between Chats/Folders/Docs

**Recommendations:**
1. Add keyboard shortcuts for sidebar tab switching
2. Persist last-used model across sessions
3. Consider adding system prompt/persona setting

---

### H8: Aesthetic and Minimalist Design

**Score: 8/10**

**Strengths:**
- Clean, modern design with good use of whitespace
- Theme system is well-executed (6 themes)
- Spotlight mode is genuinely minimal and beautiful
- Good typography (Inter for UI, JetBrains Mono for code)

**Issues:**
- **Token count per message is visual noise** - `~234 tokens` on every message adds clutter
- **Branch indicator on first message is subtle** - Easy to miss `Branch` label
- **Dashboard header is busy** - Logo, model selector, token counter, doc badge, export, settings, close, window controls all in one bar
- **Action bar in Spotlight** shows "Copy" and "Clear" which are rarely used; takes vertical space

**Recommendations:**
1. Hide per-message token count by default, show on hover
2. Make branch indicator more prominent (colored bar, not text)
3. Group Dashboard header actions into logical clusters with separators

---

### H9: Help Users Recognize, Diagnose, and Recover from Errors

**Score: 5/10**

**Strengths:**
- Dashboard's `parseApiError()` provides clear error messages for common API errors
- Error messages suggest corrective action ("Check your settings", "Wait and try again")

**Issues:**
- **Spotlight shows raw error strings** - No user-friendly parsing
- **No error recovery suggestions** - Error banner has no "Try again" or "Open Settings" buttons
- **Failed document loading is silent** - Just returns empty string, no user notification
- **Network errors during streaming are poorly handled** - Partial response stays without indication of truncation
- **API key test failure messages are vague** - "Failed to connect" without debugging steps

**Recommendations:**
1. Add actionable buttons to error messages (Retry, Open Settings)
2. Show visual indicator when a response was truncated or interrupted
3. Add "Troubleshoot" link to error messages

---

### H10: Help and Documentation

**Score: 4/10**

**Issues:**
- **No onboarding for key features** - Onboarding just shows "Welcome" and disappears
- **No in-app help** beyond keyboard shortcuts modal
- **No tooltip explanations** for features like RAG, branching, model comparison
- **No "What's New" changelog** accessible in-app
- **No link to documentation** from within the app
- **Keyboard shortcuts modal is incomplete** - Shows only 3-4 of 12+ shortcuts

**Recommendations:**
1. Enhance onboarding to highlight 3-4 key features (documents, branches, shortcuts)
2. Add contextual help tooltips for advanced features
3. Complete the keyboard shortcuts reference

---

## B. Cognitive Load Analysis

### Working Memory Overload Points

1. **Model Selection** - Users must remember which provider goes with which model. The flat list of 20+ models across 5 providers is overwhelming. Group by provider with clear hierarchy.

2. **Branch Navigation** - Understanding branching requires Git mental model. Users must track: main branch, branch name, branch origin point, active branch. This is 4 items in working memory.

3. **Document Context** - Users can't see which documents are included in their query. They must remember what they added and trust it's being used.

4. **Keyboard Shortcuts** - 12+ shortcuts with no in-context hints. Users must memorize or open the help modal.

### Recommended Cognitive Load Reductions

1. **Progressive disclosure** - Show basic features first, reveal advanced (branching, RAG debug) on demand
2. **Contextual hints** - Show relevant shortcuts next to actions they accelerate
3. **Visual grouping** - Better visual hierarchy in model selector and sidebar
4. **Persistent indicators** - Show active model, active branch, and loaded docs in a status bar

---

## C. Accessibility Analysis (WCAG 2.1)

### Level A Violations (Critical)

1. **No focus indicators on many interactive elements** - Buttons use `outline-none` without visible focus alternatives
2. **Color-only state indicators** - Success/error states indicated only by color (green/red), violating 1.4.1
3. **No ARIA labels on icon-only buttons** - Close (X), Copy, Branch, Regenerate buttons have no accessible names
4. **No skip navigation link** - Dashboard has sidebar + main content but no skip link
5. **No role attributes on custom widgets** - Model selector dropdown has no `role="listbox"`, command palette has no `role="dialog"`
6. **No aria-live region for streaming** - Screen readers can't follow streaming response updates

### Level AA Violations

7. **Contrast ratios on tertiary text** - `text-text-tertiary` (#6b6b73 on #0d0d0f) may fail 4.5:1 for normal text
8. **Target size** - Delete session button (12px icon) is below 24x24px minimum (2.5.8)
9. **Focus order** - Tab order in settings modal doesn't follow visual layout
10. **Resize** - No responsive behavior for different window sizes; fixed widths

### Recommendations

1. Add `focus-visible` ring styles: `focus-visible:ring-2 focus-visible:ring-accent-primary`
2. Add `aria-label` to all icon-only buttons
3. Add `role="dialog"` and `aria-modal="true"` to modals
4. Add `aria-live="polite"` region for streaming updates
5. Ensure all interactive elements have minimum 44x44px touch targets (or 24x24px for inline)

---

## D. Fitts' Law Analysis

### Small Target Issues

| Element | Current Size | Location | Risk |
|---------|-------------|----------|------|
| Delete chat (X) | 12px | Sidebar right edge | HIGH - easy to miss, close to session click area |
| Copy message button | 12px | Inside message bubble | MEDIUM |
| Branch button | 12px | Inside message bubble | MEDIUM |
| Model select chevron | 14px | Header bar | LOW |
| Close settings (X) | 16px | Modal top-right | LOW |
| Window controls | 16px | Top-right corner | MEDIUM - Fitts advantage from corner |

### Recommendations

1. Increase delete session button to at minimum 24px with larger click area (padding)
2. Message action buttons should have at least 28px touch targets with padding
3. Group message actions into a floating toolbar that appears on hover
4. Use edge/corner placement for frequently-used controls (Fitts' Law advantage)

---

## E. Interaction Design Issues

### 1. No Loading States for Async Actions

Actions that invoke Tauri commands show no loading state:
- Adding documents (file dialog opens, but no spinner after selection)
- Testing API keys (has spinner - good!)
- Exporting chat sessions

### 2. No Offline/Disconnection Handling

If internet drops mid-stream:
- Partial response stays without truncation indicator
- No reconnection attempt
- No offline mode indication
- User must manually retry

### 3. Scroll Behavior Issues

- `scrollIntoView({ behavior: "instant" })` jumps to bottom without animation during streaming
- No "scroll to bottom" button when user scrolls up to read history
- Auto-scroll interrupts reading if user is scrolled up

### 4. Empty States Could Be More Helpful

- Empty chat history: "No chats yet" - could suggest starting a conversation
- Empty search results: "No messages found" - could suggest broader search terms
- Empty folders: Just shows create button - could explain what folders do

### 5. No Keyboard Shortcut Conflicts Detection

Multiple keyboard listeners register on `window`:
- `App.tsx` global handler
- `CommandPalette.tsx` handler
- `Settings.tsx` shortcut recorder

These can conflict, with event.stopPropagation() not consistently used.

---

## Summary: Top Priority UI/HCI Fixes

| Priority | Issue | Category |
|----------|-------|----------|
| 1 | Add focus-visible styles and ARIA labels | Accessibility |
| 2 | Unify error handling between views | Consistency |
| 3 | Add click-outside dismiss for dropdowns | UI Polish |
| 4 | Auto-resize textarea | Usability |
| 5 | Add confirmation for destructive actions | Error Prevention |
| 6 | Add scroll-to-bottom button | Interaction |
| 7 | Increase touch target sizes | Fitts' Law |
| 8 | Show per-message token count on hover only | Visual Noise |
| 9 | Theme-aware code block backgrounds | Visual Consistency |
| 10 | Add ARIA roles to custom widgets | Accessibility |
| 11 | Fix keyboard shortcut conflicts | Interaction |
| 12 | Show loading states for async actions | System Status |
