import { vi } from "vitest";
import { Excalidraw } from "@excalidraw/excalidraw";
import { serializeAsJSON } from "@excalidraw/excalidraw/data/json";
import { exportScene } from "@excalidraw/excalidraw/scene/export";
import { defaultLang, setLanguage } from "@excalidraw/excalidraw/i18n";
import { Keyboard, UI } from "@excalidraw/excalidraw/tests/helpers/ui";
import { getTextEditor } from "@excalidraw/excalidraw/tests/queries/dom";
import { StrictMode } from "react";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@excalidraw/excalidraw/tests/test-utils";

import ExcalidrawApp from "../App";
import { Companion } from "../components/Companion";
import * as randomness from "../components/companionRandom";

import { mockCompanionEditorGeometry } from "./helpers/companionGeometry";

const transport = vi.hoisted(() => ({
  listeners: new Map<string, (...args: unknown[]) => unknown>(),
  emit: vi.fn(),
}));

vi.mock("socket.io-client", () => ({
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
}));
vi.mock("../data/firebase", () => ({
  loadFromFirebase: async () => null,
  saveToFirebase: async () => {},
  isSavedToFirebase: () => true,
  loadFilesFromFirebase: async () => ({ loadedFiles: [], erroredFiles: [] }),
  saveFilesToFirebase: async () => ({
    savedFiles: [],
    erroredFiles: [],
  }),
}));

const advance = async (milliseconds: number) =>
  act(async () => {
    vi.advanceTimersByTime(milliseconds);
  });
const restart = () => {
  fireEvent.click(screen.getByRole("button", { name: "Hide companion" }));
  fireEvent.click(screen.getByTestId("main-menu-trigger"));
  fireEvent.click(screen.getByRole("menuitem", { name: "Show companion" }));
};
const bubble = () => document.querySelector(".companion__bubble");

describe("rare application Companion text", () => {
  let reduced = false;
  let motion: EventTarget;
  beforeEach(() => {
    window.localStorage.clear();
    mockCompanionEditorGeometry();
    motion = new EventTarget();
    reduced = false;
    vi.mocked(window.matchMedia).mockImplementation((query) => ({
      get matches() {
        return query === "(prefers-reduced-motion: reduce)" && reduced;
      },
      media: query,
      onchange: null,
      addEventListener: motion.addEventListener.bind(motion),
      removeEventListener: motion.removeEventListener.bind(motion),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
    vi.spyOn(randomness, "companionRandom").mockReturnValue(0);
  });
  afterEach(async () => {
    await act(async () => {});
    vi.useRealTimers();
    await act(async () => setLanguage(defaultLang));
    vi.restoreAllMocks();
    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: false,
    });
  });

  it("keeps the first ten minutes quiet, shows ordinary text at a scheduled opportunity, and silently dismisses after five seconds", async () => {
    await render(<ExcalidrawApp />);
    vi.useFakeTimers();
    restart();
    const menu = screen.getByTestId("main-menu-trigger");
    menu.focus();
    await advance(599_999);
    expect(bubble()).toBeNull();
    await advance(78_001);
    const text = screen.getByText("A tiny snack break for me.");
    expect(bubble()).toBe(text);
    expect(
      text.closest(
        '[aria-hidden="true"], [aria-live], [role="alert"], [role="status"]',
      ),
    ).toBeNull();
    expect(menu).toHaveFocus();
    expect(document.querySelectorAll(".companion__bubble")).toHaveLength(1);
    await advance(4_999);
    expect(text).toBeInTheDocument();
    await advance(1);
    expect(bubble()).toBeNull();
    expect(menu).toHaveFocus();
    await advance(594_999);
    expect(bubble()).toBeNull();
    await advance(86_001);
    expect(screen.getByText("A little sip. No hurry.")).toBeInTheDocument();
  });

  const matureWhileSuspended = async () => {
    await render(<ExcalidrawApp />);
    vi.useFakeTimers();
    act(() => window.h.app.updateScene({ appState: { zenModeEnabled: true } }));
    await advance(600_000);
  };
  const resume = () =>
    act(() =>
      window.h.app.updateScene({ appState: { zenModeEnabled: false } }),
    );
  const samples = (...values: number[]) => {
    vi.mocked(randomness.companionRandom).mockImplementation(
      () => values.shift() ?? 0,
    );
  };

  it.each([
    [0, 0.499999, 0, "A tiny snack break for me."],
    [0.2, 0, 0, "A little sip. No hurry."],
    [0.4, 0, 0, "Resting my eyes for a moment."],
    [0.6, 0, 0, "Working on my tiny masterpiece."],
    [0.8, 0, 0, "Back in a moment."],
    [0, 0.5, 0, "Leave a little room around your ideas."],
    [0, 0.5, 0.4, "A small sketch can be a good place to start."],
    [0, 0.999999, 0.8, "A simple label can make an idea clearer."],
  ] as const)(
    "uses the fixed catalog with equal remark/Tip paths: %s/%s/%s",
    async (routine, kind, tip, text) => {
      await matureWhileSuspended();
      samples(0, routine, 0.199999, kind, tip);
      resume();
      expect(bubble()).toBeNull();
      await advance(90_000);
      expect(screen.getByText(text)).toBe(bubble());
      expect(document.querySelectorAll(".companion__bubble")).toHaveLength(1);
    },
  );

  it("discards a sample at the 20 percent boundary and retries only at the next activity opportunity", async () => {
    await matureWhileSuspended();
    samples(0, 0, 0.2, 0, 0);
    resume();
    await advance(90_000);
    expect(bubble()).toBeNull();
    await advance(97_999);
    expect(bubble()).toBeNull();
    await advance(1);
    expect(screen.getByText("A little sip. No hurry.")).toBe(bubble());
  });

  it("offers only Tips at the normal idle cadence in reduced motion and clears text immediately on live preference changes", async () => {
    reduced = true;
    await render(<ExcalidrawApp />);
    vi.useFakeTimers();
    restart();
    await advance(629_999);
    expect(bubble()).toBeNull();
    samples(0.199999, 0.8, 1);
    await advance(1);
    expect(screen.getByText("A simple label can make an idea clearer.")).toBe(
      bubble(),
    );
    expect(
      screen.queryByText(/Cookie|Cup|Pillow|Sketchbook|Little door/, {
        selector: "title",
      }),
    ).not.toBeInTheDocument();
    act(() => {
      reduced = false;
      motion.dispatchEvent(new Event("change"));
    });
    expect(bubble()).toBeNull();
    await advance(5_000);
    expect(bubble()).toBeNull();
    act(() => {
      reduced = true;
      motion.dispatchEvent(new Event("change"));
    });
    await advance(594_999);
    expect(bubble()).toBeNull();
    await advance(35_001);
    expect(screen.getByText("Leave a little room around your ideas.")).toBe(
      bubble(),
    );
  });

  it("retains the 180-second upper opportunity interval in the reduced-motion still pose", async () => {
    reduced = true;
    await matureWhileSuspended();
    samples(1, 0, 0.4, 0);
    resume();
    await advance(179_999);
    expect(bubble()).toBeNull();
    await advance(1);
    expect(
      screen.getByText("A small sketch can be a good place to start."),
    ).toBe(bubble());
    expect(
      screen.queryByText(/Cookie|Cup|Pillow|Sketchbook|Little door/, {
        selector: "title",
      }),
    ).not.toBeInTheDocument();
  });

  it("clears text and stale dismissal on hide while retaining elapsed quiet time through restoration", async () => {
    await matureWhileSuspended();
    resume();
    await advance(90_000);
    expect(bubble()).toBeInTheDocument();
    await advance(2_000);
    restart();
    expect(bubble()).toBeNull();
    await advance(90_000);
    expect(bubble()).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Hide companion" }));
    await advance(600_000);
    fireEvent.click(screen.getByTestId("main-menu-trigger"));
    fireEvent.click(screen.getByRole("menuitem", { name: "Show companion" }));
    expect(bubble()).toBeNull();
    await advance(89_999);
    expect(bubble()).toBeNull();
    await advance(1);
    expect(bubble()).toBeInTheDocument();
    await advance(4_999);
    expect(bubble()).toBeInTheDocument();
    await advance(1);
    expect(bubble()).toBeNull();
  });

  it("clears active text for loading, editing modes, visibility and modal suspension and resumes without queued text", async () => {
    await matureWhileSuspended();
    resume();
    const { app } = window.h;
    await advance(90_000);
    const exercise = async (suspend: () => void, restore: () => void) => {
      expect(bubble()).toBeInTheDocument();
      suspend();
      await act(async () => {});
      expect(bubble()).toBeNull();
      await advance(600_000);
      restore();
      await act(async () => {});
      expect(bubble()).toBeNull();
      await advance(89_999);
      expect(bubble()).toBeNull();
      await advance(1);
    };
    for (const mode of [
      "isLoading",
      "zenModeEnabled",
      "viewModeEnabled",
    ] as const) {
      await exercise(
        () =>
          act(() =>
            app.updateScene({
              appState: {
                isLoading: mode === "isLoading",
                zenModeEnabled: mode === "zenModeEnabled",
                viewModeEnabled: mode === "viewModeEnabled",
              },
            }),
          ),
        () =>
          act(() =>
            app.updateScene({
              appState: {
                isLoading: false,
                zenModeEnabled: false,
                viewModeEnabled: false,
              },
            }),
          ),
      );
    }
    const setHidden = (hidden: boolean) => {
      Object.defineProperty(document, "hidden", {
        configurable: true,
        value: hidden,
      });
      fireEvent(document, new Event("visibilitychange"));
    };
    await exercise(
      () => setHidden(true),
      () => setHidden(false),
    );
    await exercise(
      () => {
        fireEvent.click(screen.getByTestId("main-menu-trigger"));
        fireEvent.click(screen.getByRole("menuitem", { name: "Help" }));
      },
      () => fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" }),
    );
    expect(bubble()).toBeInTheDocument();
  });

  it("keeps drawing and ongoing text selection focused while text appears, without changing undo, save or SVG export", async () => {
    await matureWhileSuspended();
    resume();
    await advance(45_000);
    const { app, store, history } = window.h;
    UI.createElement("rectangle", { x: 100, y: 100, width: 200, height: 100 });
    UI.createElement("text", { x: 400, y: 200 });
    const editor = await getTextEditor();
    editor.focus();
    fireEvent.input(editor, { target: { value: "My drawing" } });
    editor.setSelectionRange(3, 7);
    const selection = app.state.selectedElementIds;
    await advance(45_000);
    expect(bubble()).toBeInTheDocument();
    expect(editor).toHaveFocus();
    expect([editor.selectionStart, editor.selectionEnd]).toEqual([3, 7]);
    expect(editor).toHaveValue("My drawing");
    expect(app.state.selectedElementIds).toEqual(selection);
    fireEvent.input(editor, { target: { value: "My drawing continues" } });
    act(() => editor.blur());
    await act(async () => {});
    const saved = () =>
      serializeAsJSON(app.getSceneElements(), app.state, app.files, "local");
    const before = saved();
    const svg = () =>
      exportScene({
        type: "svg",
        data: {
          elements: app.getSceneElements(),
          appState: app.state,
          files: app.files,
        },
        config: { environment: app.renderEnvironment },
      });
    const exported = (await svg()).outerHTML;
    const undoLength = history.undoStack.length;
    const increments = vi.fn();
    const unsubscribe = store.onStoreIncrementEmitter.on(increments);
    await advance(5_000);
    expect(bubble()).toBeNull();
    await advance(681_000);
    expect(bubble()).toBeInTheDocument();
    expect(saved()).toBe(before);
    expect((await svg()).outerHTML).toBe(exported);
    expect(history.undoStack).toHaveLength(undoLength);
    expect(increments).not.toHaveBeenCalled();
    unsubscribe();
    Keyboard.undo();
    expect(app.getSceneElements()).toHaveLength(1);
    Keyboard.redo();
    expect(app.getSceneElements()).toHaveLength(2);
    expect(app.getSceneElements()[1]).toEqual(
      expect.objectContaining({ type: "text", text: "My drawing continues" }),
    );
  });

  it("updates mounted text with the language and theme without resetting its dismissal or scene", async () => {
    await matureWhileSuspended();
    resume();
    UI.createElement("rectangle", { x: 100, y: 100, width: 200, height: 100 });
    await advance(90_000);
    const text = screen.getByText("A tiny snack break for me.");
    const { app } = window.h;
    const elements = app.getSceneElements();
    await advance(2_000);
    act(() => app.updateScene({ appState: { theme: "dark" } }));
    await act(async () =>
      setLanguage({ code: "__test__", label: "test language" }),
    );
    expect(bubble()).toBe(text);
    expect(text).toHaveTextContent("[[companion.remarks.eating]]");
    expect(text.closest(".theme--dark")).not.toBeNull();
    expect(app.getSceneElements()).toEqual(elements);
    await advance(2_999);
    expect(text).toBeInTheDocument();
    await advance(1);
    expect(bubble()).toBeNull();
    await act(async () => setLanguage({ code: "de-DE", label: "Deutsch" }));
    await advance(681_000);
    expect(screen.getByText("A little sip. No hurry.")).toBe(bubble());
    expect(app.getSceneElements()).toEqual(elements);
  });

  it("ignores collaborator arrivals and never broadcasts automatic text into an active drawing session", async () => {
    // Crypto and the socket are browser/service boundaries; the application,
    // collaboration pipeline, editor and Companion remain production code.
    const cryptoDescriptor = Object.getOwnPropertyDescriptor(
      window.crypto,
      "subtle",
    );
    Object.defineProperty(window.crypto, "subtle", {
      configurable: true,
      value: {
        generateKey: async () => ({}),
        exportKey: async () => ({ k: "sTdLvMC_M3V8_vGa3UVRDg" }),
        importKey: async () => ({}),
        encrypt: async (
          _algorithm: unknown,
          _key: unknown,
          data: ArrayBuffer,
        ) => data,
      },
    });
    transport.listeners.clear();
    transport.emit.mockClear();
    const rendered = await render(<ExcalidrawApp />);
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
    const { app, store, history } = window.h;
    vi.useFakeTimers();
    UI.createElement("rectangle", { x: 100, y: 100, width: 200, height: 100 });
    await advance(20_001);
    const sceneMessages = () =>
      transport.emit.mock.calls
        .filter(([event]) => event === "server-broadcast")
        .map(([, , buffer]) => JSON.parse(new TextDecoder().decode(buffer)));
    expect(sceneMessages()).toContainEqual(
      expect.objectContaining({
        type: "SCENE_UPDATE",
        payload: { elements: [expect.objectContaining({ type: "rectangle" })] },
      }),
    );
    restart();
    act(() => app.updateScene({ appState: { zenModeEnabled: true } }));
    await advance(600_000);
    act(() => app.updateScene({ appState: { zenModeEnabled: false } }));
    const saved = serializeAsJSON(
      app.getSceneElements(),
      app.state,
      app.files,
      "local",
    );
    const undoLength = history.undoStack.length;
    transport.emit.mockClear();
    await advance(45_000);
    await act(async () => {
      transport.listeners.get("room-user-change")!([
        "local-user",
        "remote-user",
      ]);
    });
    expect(app.state.collaborators.size).toBe(2);
    const increments = vi.fn();
    const unsubscribe = store.onStoreIncrementEmitter.on(increments);
    await advance(44_999);
    expect(
      screen.queryByText("Cookie", { selector: "title" }),
    ).not.toBeInTheDocument();
    await advance(1);
    expect(
      screen.getByText("Cookie", { selector: "title" }),
    ).toBeInTheDocument();
    expect(bubble()).toBeInTheDocument();
    await advance(8_000);
    expect(bubble()).toBeNull();
    expect(sceneMessages()).toEqual([]);
    expect(increments).not.toHaveBeenCalled();
    expect(
      serializeAsJSON(app.getSceneElements(), app.state, app.files, "local"),
    ).toBe(saved);
    expect(history.undoStack).toHaveLength(undoLength);
    unsubscribe();
    vi.spyOn(window, "confirm").mockReturnValue(true);
    fireEvent.click(screen.getAllByTitle("Live collaboration...")[0]);
    fireEvent.click(screen.getByRole("button", { name: "Stop session" }));
    await act(async () => {});
    rendered.unmount();
    window.history.replaceState({}, "", "/");
    if (cryptoDescriptor) {
      Object.defineProperty(window.crypto, "subtle", cryptoDescriptor);
    } else {
      Reflect.deleteProperty(window.crypto, "subtle");
    }
  });

  it("keeps Strict Mode instances and owned clocks independent, cancels owned bubble deadlines and resets quiet time on remount", async () => {
    reduced = true;
    const application = await render(<ExcalidrawApp />);
    const iframe = document.createElement("iframe");
    document.body.append(iframe);
    const ownerDocument = iframe.contentDocument!;
    const ownerWindow = iframe.contentWindow! as Window & typeof globalThis;
    mockCompanionEditorGeometry(ownerWindow);
    const mountNode = ownerDocument.createElement("div");
    ownerDocument.body.append(mountNode);
    const ownedNow = vi.fn(() => window.Date.now() + 3_600_000);
    class OwnedDate extends Date {
      static now = ownedNow;
    }
    const ownedTimeout = vi.fn((callback: TimerHandler, delay?: number) =>
      window.setTimeout(callback, delay),
    );
    const ownedClear = vi.fn((id: number) => window.clearTimeout(id));
    Object.defineProperties(ownerWindow, {
      Date: { value: OwnedDate },
      matchMedia: { value: window.matchMedia },
      requestAnimationFrame: {
        value: window.requestAnimationFrame.bind(window),
      },
      cancelAnimationFrame: { value: window.cancelAnimationFrame.bind(window) },
      ResizeObserver: { value: window.ResizeObserver },
      setTimeout: { value: ownedTimeout },
      clearTimeout: { value: ownedClear },
    });
    Object.defineProperty(ownerDocument, "fonts", { value: document.fonts });
    Object.defineProperty(
      ownerWindow.HTMLCanvasElement.prototype,
      "getContext",
      {
        value: window.HTMLCanvasElement.prototype.getContext,
      },
    );
    const ownedEditor = () => (
      <StrictMode>
        <Excalidraw ownerDocument={ownerDocument}>
          <Companion enabled onHide={() => {}} />
        </Excalidraw>
      </StrictMode>
    );
    let owned = await render(ownedEditor(), {
      container: mountNode,
      baseElement: ownerDocument.body,
    });
    vi.useFakeTimers();
    restart();
    const setOwnedHidden = (hidden: boolean) => {
      Object.defineProperty(ownerDocument, "hidden", {
        configurable: true,
        value: hidden,
      });
      fireEvent(ownerDocument, new ownerWindow.Event("visibilitychange"));
    };
    setOwnedHidden(true);
    setOwnedHidden(false);
    await advance(300_000);
    setOwnedHidden(true);
    await advance(300_000);
    setOwnedHidden(false);
    expect(
      owned.queryByText("Leave a little room around your ideas."),
    ).not.toBeInTheDocument();
    await advance(30_000);
    expect(
      application.getByText("Leave a little room around your ideas."),
    ).toBeInTheDocument();
    expect(
      owned.queryByText("Leave a little room around your ideas."),
    ).not.toBeInTheDocument();
    await advance(59_999);
    expect(
      owned.queryByText("Leave a little room around your ideas."),
    ).not.toBeInTheDocument();
    await advance(1);
    expect(
      owned.getAllByText("Leave a little room around your ideas."),
    ).toHaveLength(1);
    expect(ownedNow).toHaveBeenCalled();
    const dismissalIndex = ownedTimeout.mock.calls
      .map(([, delay]) => delay)
      .lastIndexOf(5_000);
    const dismissalId = ownedTimeout.mock.results[dismissalIndex].value;
    owned.unmount();
    expect(ownedClear).toHaveBeenCalledWith(dismissalId);
    const callCount = ownedTimeout.mock.calls.length;
    await advance(1_000_000);
    setOwnedHidden(true);
    setOwnedHidden(false);
    expect(ownedTimeout).toHaveBeenCalledTimes(callCount);
    vi.useRealTimers();
    const remountNode = ownerDocument.createElement("div");
    ownerDocument.body.append(remountNode);
    owned = await render(ownedEditor(), {
      container: remountNode,
      baseElement: ownerDocument.body,
    });
    vi.useFakeTimers();
    setOwnedHidden(true);
    setOwnedHidden(false);
    await advance(599_999);
    expect(
      owned.queryByText("Leave a little room around your ideas."),
    ).not.toBeInTheDocument();
    await advance(30_001);
    expect(
      owned.getAllByText("Leave a little room around your ideas."),
    ).toHaveLength(1);
    owned.unmount();
    iframe.remove();
  });
});
