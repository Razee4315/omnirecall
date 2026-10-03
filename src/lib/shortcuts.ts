export interface Shortcut {
  keys: string[];
  description: string;
}

export interface ShortcutGroup {
  title: string;
  shortcuts: Shortcut[];
}

/// The one list of in-app shortcuts and slash commands, shown by the
/// shortcuts overlay and linked from Settings. (The global show/hide hotkey
/// is configurable and listed separately.)
export const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    title: "General",
    shortcuts: [
      { keys: ["Ctrl", "K"], description: "Command palette" },
      { keys: ["Ctrl", ","], description: "Settings" },
      { keys: ["Ctrl", "/"], description: "Keyboard shortcuts" },
      { keys: ["Esc"], description: "Close overlay / hide Spotlight" },
      { keys: ["F11"], description: "Fullscreen (Dashboard)" },
    ],
  },
  {
    title: "Chat",
    shortcuts: [
      { keys: ["Enter"], description: "Send message" },
      { keys: ["Shift", "Enter"], description: "New line" },
      { keys: ["Ctrl", "N"], description: "New chat" },
      { keys: ["Ctrl", "."], description: "Stop generating" },
      { keys: ["Ctrl", "Shift", "C"], description: "Copy last response" },
      { keys: ["Ctrl", "Shift", "V"], description: "Quote clipboard text" },
    ],
  },
  {
    title: "Navigation",
    shortcuts: [
      { keys: ["Ctrl", "["], description: "Previous chat" },
      { keys: ["Ctrl", "]"], description: "Next chat" },
      { keys: ["Ctrl", "1-9"], description: "Jump to chat" },
      { keys: ["Ctrl", "Shift", "M"], description: "Compare models" },
    ],
  },
  {
    title: "Slash commands",
    shortcuts: [
      { keys: ["/new"], description: "Start a new chat" },
      { keys: ["/clear"], description: "Same as /new" },
      { keys: ["/system", "..."], description: "Set the system prompt" },
      { keys: ["/help"], description: "Show this list" },
    ],
  },
];
