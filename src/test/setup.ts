import { vi } from "vitest";

// In-memory stand-ins for the Tauri IPC surface so store and hook logic can be
// exercised without a native backend.

type Listener = (event: { event: string; id: number; payload: unknown }) => void;

const storeData = new Map<string, unknown>();
const listeners = new Map<string, Set<Listener>>();

export const tauriMock = {
  storeData,
  invoke: vi.fn(async (_cmd: string, _args?: Record<string, unknown>): Promise<unknown> => undefined),
  emit(event: string, payload: unknown) {
    for (const fn of listeners.get(event) ?? []) fn({ event, id: 0, payload });
  },
  reset() {
    storeData.clear();
    listeners.clear();
    tauriMock.invoke.mockReset();
    tauriMock.invoke.mockImplementation(async () => undefined);
  },
};

vi.mock("@tauri-apps/api/core", () => ({
  invoke: (cmd: string, args?: Record<string, unknown>) => tauriMock.invoke(cmd, args),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: async (event: string, fn: Listener) => {
    if (!listeners.has(event)) listeners.set(event, new Set());
    listeners.get(event)!.add(fn);
    return () => listeners.get(event)?.delete(fn);
  },
}));

vi.mock("@tauri-apps/plugin-store", () => ({
  Store: {
    load: async () => ({
      get: async (key: string) => storeData.get(key),
      set: async (key: string, value: unknown) => {
        storeData.set(key, structuredClone(value));
      },
      delete: async (key: string) => storeData.delete(key),
      keys: async () => [...storeData.keys()],
      clear: async () => storeData.clear(),
      save: async () => undefined,
    }),
  },
}));
