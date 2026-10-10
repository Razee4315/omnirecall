// Stand-in for the Tauri IPC layer so the real OmniRecall interface can be opened in a browser
// and photographed for the website. Everything it serves is invented demo data.
(function () {
  const iso = (minutesAgo) => new Date(Date.now() - minutesAgo * 60000).toISOString();
  const msg = (id, role, content, extra = {}) => ({ id, role, content, ...extra });
  const session = (id, title, minutesAgo, messages, extra = {}) => ({
    id, title, messages, branches: [], branchMessages: {}, createdAt: iso(minutesAgo + 5), updatedAt: iso(minutesAgo), ...extra,
  });

  const MODEL = "gemini-2.5-flash";
  const sessions = [
    session("s1", "What changed in the export format?", 2, [
      msg("m1", "user", "What changed in the export format between v2 and v3?"),
      msg("m2", "assistant",
        "Three things changed in **v3**:\n\n" +
        "1. Timestamps are ISO 8601 strings instead of Unix seconds.\n" +
        "2. Each record carries a `schema` field, so readers can tell versions apart.\n" +
        "3. Attachments moved out of the record into a separate `files` array.\n\n" +
        "The migration notes say v2 files still load, and are upgraded the first time they are saved.",
        { model: MODEL, sources: ["api-spec.md", "migration-notes.pdf"], tokenCount: 78 }),
      msg("m3", "user", "Show me a v3 record."),
      msg("m4", "assistant",
        "Here is a minimal one:\n\n```json\n{\n  \"schema\": 3,\n  \"id\": \"rec_0142\",\n  \"created\": \"2026-03-04T09:12:00Z\",\n  \"files\": []\n}\n```\n\nOnly `schema`, `id` and `created` are required.",
        { model: MODEL, sources: ["api-spec.md"], tokenCount: 61 }),
    ], { folderId: "f1" }),
    session("s2", "Regex for ISO dates", 38, [
      msg("m1", "user", "Regex for ISO dates"),
      msg("m2", "assistant", "`^\\d{4}-\\d{2}-\\d{2}$` matches the date part.", { model: MODEL }),
    ]),
    session("s3", "Debounce or throttle for scroll?", 95, [
      msg("m1", "user", "Debounce or throttle for scroll?"),
      msg("m2", "assistant", "Throttle. You want regular updates while scrolling, not one at the end.", { model: MODEL }),
    ]),
    session("s4", "Shorter version of this email", 180, [
      msg("m1", "user", "Shorter version of this email"),
      msg("m2", "assistant", "Here is a tighter draft.", { model: "claude-sonnet-4-5" }),
    ], { folderId: "f1" }),
    session("s5", "Explain CSS subgrid simply", 400, [
      msg("m1", "user", "Explain CSS subgrid simply"),
      msg("m2", "assistant", "A subgrid lets a nested grid line up with its parent's tracks.", { model: "gpt-4o" }),
    ]),
    session("s6", "Summarize the meeting notes", 1500, [
      msg("m1", "user", "Summarize the meeting notes"),
      msg("m2", "assistant", "Three decisions were made.", { model: MODEL, sources: ["meeting-notes.md"] }),
    ], { folderId: "f2" }),
    session("s7", "Name ideas for the changelog page", 3000, [
      msg("m1", "user", "Name ideas for the changelog page"),
      msg("m2", "assistant", "A few directions.", { model: "llama3.2" }),
    ]),
  ];

  const documents = [
    { id: "d1", name: "api-spec.md", path: "C:/demo/api-spec.md", type: "md", addedAt: iso(9000) },
    { id: "d2", name: "migration-notes.pdf", path: "C:/demo/migration-notes.pdf", type: "pdf", addedAt: iso(8000) },
    { id: "d3", name: "meeting-notes.md", path: "C:/demo/meeting-notes.md", type: "md", addedAt: iso(7000) },
    { id: "d4", name: "parser.ts", path: "C:/demo/parser.ts", type: "ts", addedAt: iso(6000) },
  ];

  const params = new URLSearchParams(location.search);
  const store = {
    sessionIndex: sessions.map((s) => s.id),
    ...Object.fromEntries(sessions.map((s) => [`session:${s.id}`, s])),
    chatFolders: [
      { id: "f1", name: "Work", color: "#3b82f6", createdAt: iso(9000), isCollapsed: false },
      { id: "f2", name: "Reading", color: "#22c55e", createdAt: iso(9000), isCollapsed: false },
    ],
    providers: [
      { id: "gemini", isConnected: true },
      { id: "openai", isConnected: true },
      { id: "anthropic", isConnected: true },
      { id: "ollama", isConnected: true, baseUrl: "http://localhost:11434" },
    ],
    fetchedModels: {
      gemini: ["gemini-2.5-flash", "gemini-2.5-pro"],
      openai: ["gpt-4o", "gpt-4o-mini"],
      anthropic: ["claude-sonnet-4-5"],
      ollama: ["llama3.2"],
    },
    activeProvider: "gemini",
    activeModel: MODEL,
    theme: params.get("theme") || "dark",
    documents: params.get("docs") === "0" ? [] : documents,
    onboardingComplete: params.get("onboarding") !== "1",
  };

  const M = {
    store,
    callbacks: new Map(),
    listeners: new Map(),
    nextId: 1,
    stream: { chunks: ["Hello."], delay: 40 },
    active: new Map(),
    emit(event, payload) { for (const id of M.listeners.get(event) ?? []) M.callbacks.get(id)?.({ event, id, payload }); },
  };
  window.__DEMO__ = M;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const hotkey = { hotkey: "Alt+Space", registered: true, error: null };

  const handlers = {
    "plugin:event|listen": ({ event, handler }) => { if (!M.listeners.has(event)) M.listeners.set(event, new Set()); M.listeners.get(event).add(handler); return handler; },
    "plugin:event|unlisten": ({ event, eventId }) => { M.listeners.get(event)?.delete(eventId); },
    "plugin:store|load": () => 1,
    "plugin:store|get_store": () => 1,
    "plugin:store|get": ({ key }) => [M.store[key] ?? null, key in M.store],
    "plugin:store|set": ({ key, value }) => { M.store[key] = value; },
    "plugin:store|delete": ({ key }) => { const had = key in M.store; delete M.store[key]; return had; },
    "plugin:store|clear": () => { M.store = {}; },
    "plugin:store|save": () => {},
    "plugin:store|keys": () => Object.keys(M.store),
    "plugin:dialog|open": () => null,
    "plugin:dialog|save": () => null,
    "plugin:clipboard-manager|read_text": () => "",
    "plugin:autostart|is_enabled": () => true,
    "plugin:autostart|enable": () => {},
    "plugin:autostart|disable": () => {},
    get_api_key_secrets: () => ({ gemini: "demo", openai: "demo", anthropic: "demo" }),
    set_api_key_secret: () => {},
    get_hotkey_status: () => hotkey,
    update_hotkey: ({ newHotkey }) => newHotkey,
    set_hotkey_paused: () => {},
    set_blur_hide_suspended: () => {},
    get_supported_extensions: () => ["pdf", "txt", "md", "ts", "py", "json"],
    get_documents_status: ({ documents }) => ({
      documents: documents.map((d) => ({ id: d.id, chars: 2400, error: null, indexedChunks: 6 })),
      contextMode: documents.length ? "full" : "none",
      contextTokens: documents.length * 600,
    }),
    index_document: () => 6,
    remove_document_index: () => {},
    semantic_search: () => [],
    clear_index: () => {},
    get_index_stats: () => ({ chunk_count: 24, indexed: true }),
    test_api_key: ({ provider }) => M.store.fetchedModels[provider] ?? [],
    send_message_stream: async (args) => {
      let stopped = false;
      M.active.set(args.streamId, () => { stopped = true; });
      for (const chunk of M.stream.chunks) {
        await sleep(M.stream.delay);
        if (stopped) return { stopped: true, sources: [], contextMode: "none" };
        M.emit("chat-stream", { streamId: args.streamId, chunk });
      }
      M.active.delete(args.streamId);
      const sources = M.stream.sources ?? [];
      return { stopped: false, sources, contextMode: sources.length ? "full" : "none" };
    },
    stop_generation: () => { M.active.forEach((stop) => stop()); },
    hide_window: () => {},
    toggle_dashboard: () => {},
    minimize_window: () => {},
    toggle_maximize: () => false,
    toggle_fullscreen: () => false,
    reset_backend_data: () => hotkey,
    save_text_file: () => {},
  };

  window.__TAURI_INTERNALS__ = {
    metadata: { currentWindow: { label: "main" }, currentWebview: { label: "main", windowLabel: "main" } },
    transformCallback(cb) { const id = M.nextId++; M.callbacks.set(id, cb); return id; },
    unregisterCallback(id) { M.callbacks.delete(id); },
    async invoke(cmd, args = {}) {
      const h = handlers[cmd];
      if (!h) { console.warn("[demo] unhandled command", cmd); return null; }
      return h(args);
    },
    convertFileSrc: (p) => p,
  };
  window.__TAURI_EVENT_PLUGIN_INTERNALS__ = { unregisterListener() {} };
})();
