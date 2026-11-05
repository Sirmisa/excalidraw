import { vi } from "vitest";

import {
  act,
  fireEvent,
  screen,
  waitFor,
} from "@excalidraw/excalidraw/tests/test-utils";

import type { render } from "@excalidraw/excalidraw/tests/test-utils";

export const transport = {
  listeners: new Map<string, (...args: unknown[]) => unknown>(),
  emit: vi.fn(),
};

export const socketMock = {
  default: () => ({
    id: "local-user",
    on: (event: string, listener: (...args: unknown[]) => unknown) =>
      transport.listeners.set(event, listener),
    once: (event: string, listener: (...args: unknown[]) => unknown) =>
      transport.listeners.set(event, listener),
    off: (event: string) => transport.listeners.delete(event),
    emit: transport.emit,
    close: () => {},
  }),
};

export const firebaseMock = {
  loadFromFirebase: async () => null,
  saveToFirebase: async () => {},
  isSavedToFirebase: () => true,
  loadFilesFromFirebase: async () => ({ loadedFiles: [], erroredFiles: [] }),
  saveFilesToFirebase: async () => ({ savedFiles: [], erroredFiles: [] }),
};

export const sceneMessages = () =>
  transport.emit.mock.calls
    .filter(([event]) => event === "server-broadcast")
    .map(([, , buffer]) => JSON.parse(new TextDecoder().decode(buffer)));

/** Keep the application/collaboration pipeline real; replace service boundaries. */
export const withCompanionCollaboration = async (
  hostDocument: Document,
  renderApplication: () => ReturnType<typeof render>,
  run: () => Promise<void>,
) => {
  const ownerWindow = hostDocument.defaultView!;
  const crypto = ownerWindow.crypto;
  const cryptoDescriptor = Object.getOwnPropertyDescriptor(crypto, "subtle");
  let rendered: Awaited<ReturnType<typeof render>> | undefined;
  Object.defineProperty(crypto, "subtle", {
    configurable: true,
    value: {
      generateKey: async () => ({}),
      exportKey: async () => ({ k: "sTdLvMC_M3V8_vGa3UVRDg" }),
      importKey: async () => ({}),
      encrypt: async (_algorithm: unknown, _key: unknown, data: ArrayBuffer) =>
        data,
    },
  });
  transport.listeners.clear();
  transport.emit.mockClear();
  try {
    rendered = await renderApplication();
    fireEvent.click(
      screen.getAllByRole("button", { name: "Live collaboration..." })[0],
    );
    fireEvent.click(screen.getByRole("button", { name: "Start session" }));
    await waitFor(() =>
      expect(transport.listeners.has("first-in-room")).toBe(true),
    );
    await act(async () => {
      await transport.listeners.get("first-in-room")!();
    });
    const sessionDialog = screen
      .getByRole("button", { name: "Stop session" })
      .closest('[role="dialog"]')!;
    fireEvent.keyDown(sessionDialog, { key: "Escape" });
    await act(async () => {});
    await run();
  } finally {
    try {
      if (rendered) {
        vi.spyOn(ownerWindow, "confirm").mockReturnValue(true);
        const trigger = screen.queryAllByTitle("Live collaboration...")[0];
        if (trigger) {
          fireEvent.click(trigger);
        }
        const stop = screen.queryByRole("button", { name: "Stop session" });
        if (stop) {
          fireEvent.click(stop);
        }
        await act(async () => {});
      }
    } finally {
      try {
        rendered?.unmount();
      } finally {
        ownerWindow.history.replaceState({}, "", "/");
        if (cryptoDescriptor) {
          Object.defineProperty(crypto, "subtle", cryptoDescriptor);
        } else {
          Reflect.deleteProperty(crypto, "subtle");
        }
        transport.listeners.clear();
      }
    }
  }
};
